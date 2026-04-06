from __future__ import annotations

import atexit
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, TypedDict
from uuid import uuid4

from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from .models import Phase, ProjectTimeline, TimelineGenerateRequest, TimelineRecord


WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(WORKSPACE_ROOT / ".env")
load_dotenv(WORKSPACE_ROOT / ".env.local")


class SwarmState(TypedDict, total=False):
    thread_id: str
    generated_at: str
    recommendation: dict[str, Any]
    location: dict[str, Any] | None
    metrics: dict[str, Any] | None
    chat_history: list[dict[str, Any]]
    rag_metadata: dict[str, Any]
    location_label: str
    timeline: ProjectTimeline
    previous_risks: list[str]
    revision_count: int
    reviewer_notes: str | None
    approved_at: str | None
    review_status: str


class PlannerOutput(BaseModel):
    strategy_summary: str
    phases: list[Phase] = Field(default_factory=list)


class EstimatorOutput(BaseModel):
    strategy_summary: str
    phases: list[Phase] = Field(default_factory=list)


class CriticOutput(BaseModel):
    risks: list[str] = Field(default_factory=list)


checkpointer: PostgresSaver | None = None
graph = None
_checkpointer_context = None


def _checkpoint_conn_string() -> str:
    conn_string = (
        os.getenv("TIMELINE_SWARM_CHECKPOINT_DB_URL")
        or os.getenv("DIRECT_URL")
        or os.getenv("DATABASE_URL")
    )
    if not conn_string:
        raise RuntimeError(
            "TIMELINE_SWARM_CHECKPOINT_DB_URL, DIRECT_URL, or DATABASE_URL is required for durable timeline checkpoints."
        )

    if "supabase.com" in conn_string and "sslmode=" not in conn_string:
        separator = "&" if "?" in conn_string else "?"
        conn_string = f"{conn_string}{separator}sslmode=require"

    return conn_string


def initialize_swarm():
    global checkpointer, graph, _checkpointer_context

    if graph is not None:
        return graph

    _checkpointer_context = PostgresSaver.from_conn_string(_checkpoint_conn_string())
    checkpointer = _checkpointer_context.__enter__()
    checkpointer.setup()
    graph = build_graph(checkpointer)
    return graph


def shutdown_swarm() -> None:
    global checkpointer, graph, _checkpointer_context

    if _checkpointer_context is not None:
        _checkpointer_context.__exit__(None, None, None)

    checkpointer = None
    graph = None
    _checkpointer_context = None


atexit.register(shutdown_swarm)


def _get_llm(temperature: float = 0.15) -> ChatOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required for timeline swarm orchestration.")

    return ChatOpenAI(
        model=os.getenv("TIMELINE_SWARM_MODEL", "gpt-4o-mini"),
        api_key=api_key,
        temperature=temperature,
    )


def _location_label(location: dict[str, Any] | None) -> str:
    barangay = (location or {}).get("barangay")
    if barangay:
        return f"Barangay {barangay}, Mandaue City"
    return (location or {}).get("name") or "Mandaue City"


def _metrics_block(state: SwarmState) -> str:
    metrics = state.get("metrics") or {}
    rag_context = (state.get("rag_metadata") or {}).get("context") or {}
    merged = {**rag_context, **metrics}
    rows = [
        f"Area: {merged.get('areaName') or state.get('location_label')}",
        f"NDVI: {merged.get('ndvi', 'N/A')}",
        f"LST: {merged.get('lst', 'N/A')}",
        f"Tree canopy: {merged.get('treeCanopy', 'N/A')}",
        f"Greenery Index: {merged.get('greeneryIndex', 'N/A')}",
        f"Flood hazard: {merged.get('floodHazard', 'N/A')}",
        f"Storm hazard: {merged.get('stormHazard', 'N/A')}",
        f"AQI: {merged.get('aqi', 'N/A')}",
    ]
    return "\n".join(rows)


def _rag_block(state: SwarmState) -> str:
    rag_metadata = state.get("rag_metadata") or {}
    chunks = rag_metadata.get("chunks") or []
    if not chunks:
        return "No retrieved studies were supplied. Use conservative urban greening best practices."

    formatted: list[str] = []
    for index, chunk in enumerate(chunks[:6], start=1):
        similarity = chunk.get("similarity")
        similarity_text = f" similarity={similarity:.2f}" if isinstance(similarity, (int, float)) else ""
        formatted.append(
            f"[SOURCE {index}] {chunk.get('studyTitle', 'Untitled Study')} ({chunk.get('studyID', 'unknown')}){similarity_text}\n{chunk.get('content', '')}"
        )
    return "\n\n---\n\n".join(formatted)


def _chat_block(state: SwarmState) -> str:
    history = state.get("chat_history") or []
    if not history:
        return "No extra user chat constraints were provided."
    return "\n".join(
        f"- {message['role']}: {message['content']}" for message in history[-8:]
    )


def _wet_season_safe_start_week(state: SwarmState) -> int:
    generated_at = datetime.fromisoformat(state["generated_at"])
    current_year = generated_at.year
    safe_start = datetime(current_year, 11, 1, tzinfo=generated_at.tzinfo)
    if safe_start <= generated_at:
        safe_start = datetime(current_year + 1, 11, 1, tzinfo=generated_at.tzinfo)

    delta_days = (safe_start - generated_at).days
    return max(1, delta_days // 7 + 1)


def _build_project_timeline(title: str, strategy_summary: str, phases: list[Phase], risks: list[str]) -> ProjectTimeline:
    return ProjectTimeline(
        project_title=title,
        total_duration_weeks=sum(phase.duration_weeks for phase in phases),
        phases=phases,
        risks=risks,
        strategy_summary=strategy_summary,
    )


def planner_node(state: SwarmState) -> SwarmState:
    recommendation = state["recommendation"]
    planner_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are the Planner agent in GreenPoint's LangGraph swarm. Draft a reviewable project delivery structure for an urban greening intervention in Mandaue City. Return 4 to 6 phases using the Phase schema. For every phase set start_week=0 and duration_weeks=0 because scheduling is handled later by the Estimator. IDs must be stable kebab-case strings. Categories must be one of planning, procurement, construction, or legal. Dependencies must reference prior phase IDs. Include legal or permit work when relevant and always include a maintenance or establishment phase for planted or landscape interventions.",
            ),
            (
                "human",
                "Recommendation:\n{recommendation}\n\nLocation and metrics:\n{metrics}\n\nChat constraints:\n{chat_history}\n\nRetrieved research:\n{rag_sources}\n\nReturn a concise strategy summary plus the draft phases.",
            ),
        ]
    )
    planner_chain = planner_prompt | _get_llm(temperature=0.2).with_structured_output(PlannerOutput)
    output = planner_chain.invoke(
        {
            "recommendation": recommendation,
            "metrics": _metrics_block(state),
            "chat_history": _chat_block(state),
            "rag_sources": _rag_block(state),
        }
    )

    return {
        "timeline": _build_project_timeline(
            f"{recommendation['solutionTitle']} Delivery Timeline",
            output.strategy_summary,
            output.phases,
            [],
        )
    }


def estimator_node(state: SwarmState) -> SwarmState:
    recommendation = state["recommendation"]
    planner_phases = state["timeline"].phases
    previous_risks = state.get("previous_risks") or []
    estimator_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are the Estimator agent in GreenPoint's LangGraph swarm. Convert the draft phase plan into a sequenced timeline using the Phase schema. Assign realistic start_week and duration_weeks values, preserve IDs, categories, and dependencies, and update reasoning_for_duration so it explains the duration clearly. Respect Mandaue City conditions: permitting and barangay coordination can delay work, procurement for planting or construction inputs takes time, and field construction or planting should avoid the wet or typhoon season when practical. If previous review risks mention wet-season or typhoon conflicts, ensure the first construction-phase start_week is no earlier than {safe_construction_start_week}. Output only the phased schedule and strategy summary.",
            ),
            (
                "human",
                "Recommendation:\n{recommendation}\n\nLocation and metrics:\n{metrics}\n\nDraft phases from planner:\n{planner_phases}\n\nPrevious critic risks:\n{previous_risks}\n\nRetrieved research:\n{rag_sources}\n\nChat constraints:\n{chat_history}",
            ),
        ]
    )
    estimator_chain = estimator_prompt | _get_llm(temperature=0.1).with_structured_output(EstimatorOutput)
    output = estimator_chain.invoke(
        {
            "recommendation": recommendation,
            "metrics": _metrics_block(state),
            "planner_phases": [phase.model_dump() for phase in planner_phases],
            "previous_risks": previous_risks or ["None"],
            "rag_sources": _rag_block(state),
            "chat_history": _chat_block(state),
            "safe_construction_start_week": _wet_season_safe_start_week(state),
        }
    )

    return {
        "timeline": _build_project_timeline(
            f"{recommendation['solutionTitle']} Delivery Timeline",
            output.strategy_summary,
            output.phases,
            [],
        )
    }


def critic_node(state: SwarmState) -> SwarmState:
    timeline = state["timeline"]
    critic_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are the Critic or Risk agent in GreenPoint's LangGraph swarm. Review the estimated timeline for logical flaws, missing dependencies, unrealistic legal or procurement coverage, lack of maintenance, and seasonal problems such as planting or site work during the wet or typhoon season in Mandaue City. Return only the material risks that should trigger another estimation pass. If the plan is acceptable for human review, return an empty list.",
            ),
            (
                "human",
                "Timeline under review:\n{timeline}\n\nLocation and metrics:\n{metrics}\n\nRetrieved research:\n{rag_sources}\n\nChat constraints:\n{chat_history}",
            ),
        ]
    )
    critic_chain = critic_prompt | _get_llm(temperature=0).with_structured_output(CriticOutput)
    assessment = critic_chain.invoke(
        {
            "timeline": timeline.model_dump(),
            "metrics": _metrics_block(state),
            "rag_sources": _rag_block(state),
            "chat_history": _chat_block(state),
        }
    )

    risks = assessment.risks
    return {
        "timeline": timeline.model_copy(update={"risks": risks}),
        "previous_risks": risks,
        "revision_count": state.get("revision_count", 0) + (1 if risks else 0),
    }


def human_review_node(state: SwarmState) -> SwarmState:
    return {"review_status": "draft"}


def finalize_node(state: SwarmState) -> SwarmState:
    return state


def decide_to_loop(state: SwarmState) -> str:
    risks = state["timeline"].risks
    revisions = state.get("revision_count", 0)
    if risks and revisions < 3:
        return "estimator"
    return "human_review"


def build_graph(active_checkpointer: PostgresSaver):
    graph = StateGraph(SwarmState)
    graph.add_node("planner", planner_node)
    graph.add_node("estimator", estimator_node)
    graph.add_node("critic", critic_node)
    graph.add_node("human_review", human_review_node)
    graph.add_node("finalize", finalize_node)

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "estimator")
    graph.add_edge("estimator", "critic")
    graph.add_conditional_edges("critic", decide_to_loop, {"estimator": "estimator", "human_review": "human_review"})
    graph.add_edge("human_review", "finalize")
    graph.add_edge("finalize", END)

    return graph.compile(checkpointer=active_checkpointer, interrupt_before=["human_review"])


def start_timeline(request: TimelineGenerateRequest) -> TimelineRecord:
    swarm_graph = initialize_swarm()
    generated_at = datetime.now(UTC).isoformat()
    thread_id = str(uuid4())
    location = request.location.model_dump() if request.location else None
    config = {"configurable": {"thread_id": thread_id}}
    initial_state: SwarmState = {
        "thread_id": thread_id,
        "generated_at": generated_at,
        "recommendation": request.recommendation.model_dump(),
        "location": location,
        "metrics": request.metrics.model_dump() if request.metrics else None,
        "chat_history": [message.model_dump() for message in request.chatHistory],
        "rag_metadata": request.ragMetadata.model_dump() if request.ragMetadata else {},
        "location_label": _location_label(location),
        "previous_risks": [],
        "revision_count": 0,
        "reviewer_notes": None,
        "review_status": "draft",
    }

    result = swarm_graph.invoke(initial_state, config=config)
    timeline = result["timeline"]
    return TimelineRecord(
        threadId=thread_id,
        reviewStatus="draft",
        revisionCount=result.get("revision_count", 0),
        generatedAt=generated_at,
        locationLabel=result["location_label"],
        reviewerNotes=None,
        timeline=timeline,
    )


def approve_timeline(thread_id: str, reviewer_notes: str | None = None) -> TimelineRecord | None:
    swarm_graph = initialize_swarm()
    config = {"configurable": {"thread_id": thread_id}}
    snapshot = swarm_graph.get_state(config)
    if snapshot is None or snapshot.values is None:
        return None

    continued = swarm_graph.invoke(
        {
            "review_status": "approved",
            "reviewer_notes": reviewer_notes,
            "approved_at": datetime.now(UTC).isoformat(),
        },
        config=config,
    )

    timeline = continued["timeline"]
    return TimelineRecord(
        threadId=thread_id,
        reviewStatus="approved",
        revisionCount=continued.get("revision_count", 0),
        generatedAt=continued["generated_at"],
        approvedAt=continued.get("approved_at"),
        locationLabel=continued["location_label"],
        reviewerNotes=continued.get("reviewer_notes"),
        timeline=timeline,
    )
