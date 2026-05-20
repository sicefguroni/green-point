from __future__ import annotations

import json
import os
from contextlib import ExitStack
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, TypedDict
from typing_extensions import Annotated

from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
try:
    from langgraph.checkpoint.postgres import PostgresSaver
except ImportError:
    PostgresSaver = None
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import LastValue
from langgraph.types import Command

from .models import (
    CriticResult,
    GenerateTimelineRequest,
    Phase,
    PlannerDraft,
    ProjectTimeline,
    ReviewTimelineRequest,
    TimelineServiceResponse,
)

VALID_CATEGORIES = {"planning", "procurement", "construction", "legal"}
MANDAUE_WET_MONTHS = {6, 7, 8, 9, 10, 11}
CHECKPOINT_DB_ENV_KEYS = (
    "LANGGRAPH_CHECKPOINT_DATABASE_URL",
    "TIMELINE_SWARM_DATABASE_URL",
    "DATABASE_URL",
)

_SWARM_APP = None
_CHECKPOINTER_STACK: ExitStack | None = None

class TimelineSwarmState(TypedDict, total=False):
    rag_metadata: Dict[str, Any]
    timeline: Dict[str, Any]
    revision_count: int
    previous_risks: List[str]
    review_action: Annotated[str, LastValue(str)]
    review_status: str
    reviewer_notes: Annotated[str | None, LastValue(str)]
    requested_start_date: str | None

def _maybe_get_openai_llm():
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    
    return ChatOpenAI(
        model=os.getenv("OPENAI_TIMELINE_MODEL", "gpt-4o-mini"), 
        api_key=api_key,
        temperature=0.2,
    )

def _dedupe(items: List[str]) -> List[str]:
    seen: set[str] = set()
    ordered: List[str] = []
    for item in items:
        normalized = item.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            ordered.append(normalized)
    return ordered

def _normalize_category(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized in VALID_CATEGORIES:
        return normalized
    return "planning"

def _project_title_from_rag(rag_metadata: Dict[str, Any]) -> str:
    for key in ("project_title", "recommendation_title", "intervention_name", "title"):
        value = rag_metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "GreenPoint Environmental Intervention Timeline"

def _fallback_planner_draft(
    rag_metadata: Dict[str, Any],
    reviewer_notes: str | None,
    revision_count: int,
) -> PlannerDraft:
    title = _project_title_from_rag(rag_metadata)
    intervention_type = str(rag_metadata.get("intervention_type", "urban greening")).strip()
    site_count = int(rag_metadata.get("site_count", 1) or 1)
    revision_suffix = f" (Rev {revision_count + 1})" if revision_count > 0 else ""
    notes = (reviewer_notes or "").strip()
    notes_lower = notes.lower()
    emphasize_weather = any(
        keyword in notes_lower
        for keyword in ("wet", "rain", "typhoon", "storm", "monsoon")
    )

    phases = [
        Phase(
            id="phase-1",
            name=f"Site Assessment and Stakeholder Alignment{revision_suffix}",
            reasoning_for_duration=(
                "Needs baseline verification, barangay coordination, and scope confirmatoin "
                f"for a {intervention_type} project across {site_count} site(s)."
            ),
            start_week=0,
            duration_weeks=0,
            dependencies=[],
            category="planning",
        ),
        Phase(
            id="phase-2",
            name=f"LGU and Regulatory Clearance{revision_suffix}",
            reasoning_for_duration=(
                "Requires internal review, barangay endorsement, and city permitting before field execution."
            ),
            start_week=0,
            duration_weeks=0,
            dependencies=["phase-1"],
            category="legal",
        ),
        Phase(
            id="phase-3",
            name=f"Procurement of Materials and Field Mobilization{revision_suffix}",
            reasoning_for_duration=(
                "Needs supplier confirmation, purchase requests, delivery coordination, and mobilization planning."
            ),
            start_week=0,
            duration_weeks=0,
            dependencies=["phase-2"],
            category="procurement",
        ),
        Phase(
            id="phase-4",
            name=(
                f"Implementation and Field Execution{revision_suffix}"
                if not emphasize_weather
                else f"Weather-Adjusted Field Execution{revision_suffix}"
            ),
            reasoning_for_duration=(
                "Includes on-site deployment, supervision, quality checks, and post-install stabilization."
                if not emphasize_weather
                else "Schedules field work around wet-season windows and adds weather mitigation buffers."
            ),
            start_week=0,
            duration_weeks=0,
            dependencies=["phase-3"],
            category="construction",
        ),
    ]

    return PlannerDraft(
        project_title=title,
        phases=phases,
        strategy_summary=(
            "Front-load planning and legal clearance, secure materials before field work, "
            "then execute in a weather-aware sequence for Mandaue City."
            if not notes
            else f"Incorporate reviewer feedback: {notes}"
        ),
    )

def _normalize_planner_draft(draft: PlannerDraft) -> PlannerDraft:
    seen_ids: set[str] = set()
    normalized_phases: List[Phase] = []

    for index, phase in enumerate(draft.phases, start=1):
        phase_id = phase.id.strip() or f"phase-{index}"
        if phase_id in seen_ids:
            phase_id = f"{phase_id}-{index}"
        seen_ids.add(phase_id)

        normalized_phases.append(
            Phase(
                id=phase_id,
                name=phase.name.strip() or f"Phase {index}",
                reasoning_for_duration=phase.reasoning_for_duration.strip() or "Duration requires detailed implementation sequencing.",
                start_week=0,
                duration_weeks=0,
                dependencies=[],
                category=_normalize_category(phase.category),
            )
        )
    
    valid_ids = {phase.id for phase in normalized_phases}
    final_phases: List[Phase] = []

    for index, phase in enumerate(normalized_phases):
        proposed_dependencies = draft.phases[index].dependencies if index < len(draft.phases) else []
        filtered_dependencies = [dep for dep in proposed_dependencies if dep in valid_ids and dep != phase.id]

        final_phases.append(
            Phase(
                id=phase.id,
                name=phase.name,
                reasoning_for_duration=phase.reasoning_for_duration,
                start_week=0,
                duration_weeks=0,
                dependencies=filtered_dependencies,
                category=phase.category,
            )
        )

    if not final_phases:
        return _fallback_planner_draft({})
    
    return PlannerDraft(
        project_title=draft.project_title.strip() or "GreenPoint Environmental Intervention Timeline",
        phases=final_phases,
        strategy_summary=draft.strategy_summary.strip()
        or "Deliver the intervention through a legally compliant, procurement-ready, weather-aware sequence.",
    )

def _plan_with_llm(
    rag_metadata: Dict[str, Any],
    reviewer_notes: str | None,
    previous_risks: List[str],
    revision_count: int,
    previous_timeline: Dict[str, Any] | None,
) -> PlannerDraft:
    llm = _maybe_get_openai_llm()
    if llm is None:
        raise RuntimeError(
            "LLM_UNAVAILABLE: OPENAI_API_KEY is missing or the OpenAI client is unavailable."
        )
    
    structured_llm = llm.with_structured_output(PlannerDraft)
    risk_context = "; ".join(previous_risks) if previous_risks else "None"
    reviewer_context = reviewer_notes.strip() if reviewer_notes else "None"

    previous_plan_context = (
        json.dumps(previous_timeline, indent=2, default=str)
        if previous_timeline
        else "None"
    )

    prompt = f"""
You are the Planner agent for GreenPoint, an urban analytics platform in Mandaue City.

Revision context:
- Revision attempt: {revision_count}
- Reviewer notes: {reviewer_context}
- Previous risks: {risk_context}
- Previous timeline: {previous_plan_context}

Task:
- Produce an initial project timeline draft from the provided RAG metadata.
- Output only phases and strategic summary.
- Every phase must have start_week=0 and duration_weeks=0.
- category must be one of: planning, procurement, construction, legal.
- Include dependencies only when necessary.
- Make the plan realistic for local government delivery in Mandaue City.
- When reviewer notes are present, adjust phase names, sequencing, or reasoning to reflect the requested changes.
- If a previous timeline is provided, ensure the revised plan changes at least two phase names or reasoning lines.

RAG metadata:
{json.dumps(rag_metadata, indent=2, default=str)}
    """.strip()

    try:
        draft = structured_llm.invoke(prompt)
        return _normalize_planner_draft(draft)
    except Exception as exc:
        raise RuntimeError(
            "LLM_FAILED: Planner generation failed. Check the OpenAI configuration."
        ) from exc
    
def _parse_start_date(value: str | None) -> date:
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.strip()).date()
        except ValueError:
            pass
    return date.today()

def _week_to_date(start_date: date, week_number: int) -> date:
    safe_week = max(1, week_number)
    return start_date + timedelta(weeks=safe_week - 1)

def _phase_overlaps_wet_season(start_date: date, start_week: int, duration_weeks: int) -> bool:
    for offset in range(max(duration_weeks, 1)):
        month = _week_to_date(start_date, start_week + offset).month
        if month in MANDAUE_WET_MONTHS:
            return True
    return False

def _estimate_duration_weeks(
    phase: Phase,
    rag_metadata: Dict[str, Any],
    previous_risks: List[str],
) -> int:
    base_by_category = {
        "planning": 2,
        "legal": 4,
        "procurement": 3,
        "construction": 6,
    }
    duration = base_by_category.get(phase.category, 2)

    reasoning = phase.reasoning_for_duration.lower()
    intervention_type = str(rag_metadata.get("intervention_type", "")).lower()
    site_count = int(rag_metadata.get("site_count", 1) or 1)
    labor_intensity = str(rag_metadata.get("labor_intensity", "")).lower()
    budget_cycle = str(rag_metadata.get("budget_cycle", "")).lower()
    supplier_distance = str(rag_metadata.get("supplier_distance", "")).lower()
    needs_city_permit = bool(rag_metadata.get("needs_city_permit", True))
    requires_ecc = bool(rag_metadata.get("requires_ecc", False))

    if site_count > 1:
        duration += min(site_count - 1, 3)

    if any(keyword in reasoning for keyword in ("community", "stakeholder", "coordination", "survey")):
        duration += 1

    if phase.category == "legal":
        if needs_city_permit:
            duration += 2
        if requires_ecc:
            duration += 2

    if phase.category == "procurement":
        if budget_cycle in {"annual", "deliberative"}:
            duration += 2
        if supplier_distance in {"regional", "national"}:
            duration += 1

    if phase.category == "construction":
        if any(keyword in intervention_type for keyword in ("drainage", "retrofitting", "civil works")):
            duration += 2
        if labor_intensity == "high":
            duration += 1
        if any("typhoon" in risk.lower() or "wet season" in risk.lower() for risk in previous_risks):
            duration += 1

    return max(duration, 1)

def _estimate_timeline(state: TimelineSwarmState) -> TimelineSwarmState:
    previous_risks = state.get("previous_risks", [])
    rag_metadata = state["rag_metadata"]
    start_date = _parse_start_date(state.get("requested_start_date"))
    draft = ProjectTimeline.model_validate(state["timeline"])

    scheduled_phases: List[Phase] = []
    end_by_phase_id: Dict[str, int] = {}
    next_available_week = 1

    for phase in draft.phases:
        dependency_end = max(
            (end_by_phase_id.get(dep, 0) for dep in phase.dependencies),
            default=0,
        )
        proposed_start_week = max(next_available_week, dependency_end + 1)
        duration_weeks = _estimate_duration_weeks(phase, rag_metadata, previous_risks)

        if phase.category == "construction" and _phase_overlaps_wet_season(
            start_date, proposed_start_week, duration_weeks
        ):
            guard = 0
            while _phase_overlaps_wet_season(start_date, proposed_start_week, duration_weeks) and guard < 26:
                proposed_start_week += 1
                guard += 1

        estimated_phase = Phase(
            id=phase.id,
            name=phase.name,
            reasoning_for_duration=phase.reasoning_for_duration,
            start_week=proposed_start_week,
            duration_weeks=duration_weeks,
            dependencies=phase.dependencies,
            category=phase.category,
        )
        scheduled_phases.append(estimated_phase)
        phase_end_week = proposed_start_week + duration_weeks - 1
        end_by_phase_id[phase.id] = phase_end_week
        next_available_week = phase_end_week + 1

    total_duration_weeks = max(end_by_phase_id.values(), default=0)
    estimated_timeline = ProjectTimeline(
        project_title=draft.project_title,
        total_duration_weeks=total_duration_weeks,
        phases=scheduled_phases,
        risks=[],
        strategy_summary=draft.strategy_summary,
    )

    return {
        "timeline": estimated_timeline.model_dump(),
        "revision_count": state.get("revision_count", 0) + 1,
    }

def _critic_with_rules(state: TimelineSwarmState) -> TimelineSwarmState:
    start_date = _parse_start_date(state.get("requested_start_date"))
    timeline = ProjectTimeline.model_validate(state["timeline"])
    phases_by_id = {phase.id: phase for phase in timeline.phases}
    risks: List[str] = []

    for phase in timeline.phases:
        if phase.start_week <= 0:
            risks.append(f"{phase.name}: start_week must be greater than 0 after estimation.")

        if phase.duration_weeks <= 0:
            risks.append(f"{phase.name}: duration_weeks must be greater than 0 after estimation.")

        for dependency in phase.dependencies:
            if dependency not in phases_by_id:
                risks.append(f"{phase.name}: dependency '{dependency}' does not exist.")
                continue

            dependency_phase = phases_by_id[dependency]
            dependency_end = dependency_phase.start_week + dependency_phase.duration_weeks - 1
            if phase.start_week <= dependency_end:
                risks.append(
                    f"{phase.name}: starts before dependency '{dependency_phase.name}' has finished."
                )

        if phase.category == "construction" and _phase_overlaps_wet_season(
            start_date, phase.start_week, phase.duration_weeks
        ):
            risks.append(
                f"{phase.name}: overlaps Mandaue's wet and typhoon-prone months; shift field execution or add weather mitigation."
            )

    legal_phases = [phase for phase in timeline.phases if phase.category == "legal"]
    construction_phases = [phase for phase in timeline.phases if phase.category == "construction"]
    procurement_phases = [phase for phase in timeline.phases if phase.category == "procurement"]

    if legal_phases and construction_phases:
        latest_legal_end = max(
            phase.start_week + phase.duration_weeks - 1 for phase in legal_phases
        )
        earliest_construction_start = min(phase.start_week for phase in construction_phases)
        if earliest_construction_start <= latest_legal_end:
            risks.append(
                "Construction begins before all legal and permitting work has finished."
            )

    if procurement_phases and construction_phases:
        latest_procurement_end = max(
            phase.start_week + phase.duration_weeks - 1 for phase in procurement_phases
        )
        earliest_construction_start = min(phase.start_week for phase in construction_phases)
        if earliest_construction_start <= latest_procurement_end:
            risks.append(
                "Construction begins before procurement and mobilization are fully complete."
            )

    critic_result = CriticResult(risks=_dedupe(risks))
    updated_timeline = timeline.model_copy(update={"risks": critic_result.risks})

    return {
        "timeline": updated_timeline.model_dump(),
        "previous_risks": critic_result.risks,
    }

def planner_node(state: TimelineSwarmState) -> TimelineSwarmState:
    draft = _plan_with_llm(
        state["rag_metadata"],
        state.get("reviewer_notes"),
        state.get("previous_risks", []),
        state.get("revision_count", 0),
        state.get("timeline"),
    )
    project_timeline = ProjectTimeline(
        project_title=draft.project_title,
        total_duration_weeks=0,
        phases=draft.phases,
        risks=[],
        strategy_summary=draft.strategy_summary,
    )

    return {
        "timeline": project_timeline.model_dump(),
        "revision_count": 0,
        "previous_risks": [],
        "review_status": "awaiting_human_review",
    }

def estimator_node(state: TimelineSwarmState) -> TimelineSwarmState:
    return _estimate_timeline(state)


def critic_node(state: TimelineSwarmState) -> TimelineSwarmState:
    return _critic_with_rules(state)

def human_review_node(state: TimelineSwarmState) -> TimelineSwarmState:
    return {}

def finalize_node(state: TimelineSwarmState) -> TimelineSwarmState:
    action = state.get("review_action", "approve")
    if action == "regenerate":
        return {"review_status": "needs_revision"}
    return {"review_status": "approved"}

def decide_to_loop(state: TimelineSwarmState) -> str:
    timeline = ProjectTimeline.model_validate(state["timeline"])
    if timeline.risks and state.get("revision_count", 0) < 3:
        return "estimator"
    return "human_review"

def route_after_human_review(state: TimelineSwarmState) -> str:
    if state.get("review_action") == "regenerate":
        reviewer_notes = (state.get("reviewer_notes") or "").strip()
        previous_risks = list(state.get("previous_risks", []))
        if reviewer_notes:
            previous_risks.append(f"Human reviewer requested revision: {reviewer_notes}")
        state["previous_risks"] = _dedupe(previous_risks)
        return "planner"
    return "finalize"

def build_swarm(checkpointer):
    graph = StateGraph(TimelineSwarmState)

    graph.add_node("planner", planner_node)
    graph.add_node("estimator", estimator_node)
    graph.add_node("critic", critic_node)
    graph.add_node("human_review", human_review_node)
    graph.add_node("finalize", finalize_node)

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "estimator")
    graph.add_edge("estimator", "critic")
    graph.add_conditional_edges(
        "critic",
        decide_to_loop,
        {
            "estimator": "estimator",
            "human_review": "human_review",
        },
    )
    graph.add_conditional_edges(
        "human_review",
        route_after_human_review,
        {
            "planner": "planner",
            "estimator": "estimator",
            "finalize": "finalize",
        },
    )
    graph.add_edge("finalize", END)

    return graph.compile(
        checkpointer=checkpointer,
        interrupt_before=["human_review"],
    )

def _resolve_checkpoint_database_url() -> str | None:
    for env_key in CHECKPOINT_DB_ENV_KEYS:
        value = os.getenv(env_key, "").strip()
        if value:
            return value
    return None

def initialize_swarm():
    global _SWARM_APP, _CHECKPOINTER_STACK

    if _SWARM_APP is not None:
        return _SWARM_APP

    checkpoint_database_url = _resolve_checkpoint_database_url()

    if checkpoint_database_url:
        if PostgresSaver is None:
            raise RuntimeError(
                "Postgres checkpointing requires langgraph-checkpoint-postgres to be installed."
            )

        stack = ExitStack()
        checkpointer = stack.enter_context(
            PostgresSaver.from_conn_string(checkpoint_database_url)
        )
        checkpointer.setup()

        _CHECKPOINTER_STACK = stack
        _SWARM_APP = build_swarm(checkpointer)
        return _SWARM_APP

    _SWARM_APP = build_swarm(MemorySaver())
    return _SWARM_APP

def shutdown_swarm():
    global _SWARM_APP, _CHECKPOINTER_STACK

    _SWARM_APP = None

    if _CHECKPOINTER_STACK is not None:
        _CHECKPOINTER_STACK.close()
        _CHECKPOINTER_STACK = None

def _thread_config(thread_id: str) -> Dict[str, Any]:
    return {"configurable": {"thread_id": thread_id}}

def _build_response(values: Dict[str, Any], thread_id: str) -> TimelineServiceResponse:
    if not values or "timeline" not in values:
        raise ValueError("No timeline state was found for the supplied thread_id.")

    timeline = ProjectTimeline.model_validate(values["timeline"])
    review_status = values.get("review_status", "awaiting_human_review")

    if review_status not in {"awaiting_human_review", "approved", "needs_revision"}:
        review_status = "awaiting_human_review"

    return TimelineServiceResponse(
        thread_id=thread_id,
        status=review_status,
        revision_count=int(values.get("revision_count", 0) or 0),
        rag_metadata=values.get("rag_metadata", {}),
        timeline=timeline,
        pending_risks=timeline.risks,
    )

def start_timeline(request: GenerateTimelineRequest) -> TimelineServiceResponse:
    swarm_app = initialize_swarm()
    initial_state: TimelineSwarmState = {
        "rag_metadata": request.rag_metadata,
        "requested_start_date": request.requested_start_date,
        "review_status": "awaiting_human_review",
        "revision_count": 0,
        "previous_risks": [],
    }
    config = _thread_config(request.thread_id)
    swarm_app.invoke(initial_state, config=config)
    snapshot = swarm_app.get_state(config)
    return _build_response(snapshot.values, request.thread_id)

def resume_timeline(request: ReviewTimelineRequest) -> TimelineServiceResponse:
    swarm_app = initialize_swarm()
    config = _thread_config(request.thread_id)
    current_state = swarm_app.get_state(config)

    if not current_state.values:
        raise ValueError("Unknown thread_id. Generate a timeline first.")

    swarm_app.invoke(
        Command(
            update={
                "review_action": request.review_action,
                "reviewer_notes": request.reviewer_notes,
            },
            resume=request.review_action,
        ),
        config=config,
    )

    snapshot = swarm_app.get_state(config)
    return _build_response(snapshot.values, request.thread_id)