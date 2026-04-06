from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, TypedDict
from uuid import uuid4

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from .models import Phase, ProjectTimeline, TimelineGenerateRequest, TimelineRecord

WEEK = timedelta(weeks=1)


class SwarmState(TypedDict, total=False):
    thread_id: str
    generated_at: str
    recommendation: dict[str, Any]
    location: dict[str, Any] | None
    chat_history: list[dict[str, Any]]
    rag_metadata: dict[str, Any]
    location_label: str
    timeline: ProjectTimeline
    previous_risks: list[str]
    revision_count: int
    reviewer_notes: str | None
    approved_at: str | None
    review_status: str


checkpointer = MemorySaver()


def _normalized_context(state: SwarmState) -> str:
    return " ".join(message["content"] for message in state.get("chat_history", [])).lower()


def _location_label(location: dict[str, Any] | None) -> str:
    barangay = (location or {}).get("barangay")
    if barangay:
        return f"Barangay {barangay}, Mandaue City"
    return (location or {}).get("name") or "Mandaue City"


def _signals(state: SwarmState) -> dict[str, bool]:
    recommendation = state["recommendation"]
    context = _normalized_context(state)
    intervention = f"{recommendation['interventionType']} {recommendation['solutionTitle']}".lower()
    return {
        "budget_sensitive": any(token in context for token in ["budget", "cost", "cheap", "afford"]),
        "flood_sensitive": any(token in context for token in ["rain", "flood", "drainage", "storm"]),
        "heat_sensitive": any(token in context for token in ["heat", "shade", "temperature"]),
        "community_sensitive": any(token in context for token in ["community", "resident", "volunteer", "participation"]),
        "permits_sensitive": any(token in context for token in ["permit", "approval", "lgu", "barangay hall"]),
        "tree_focused": any(token in intervention for token in ["tree", "canopy", "shade", "plant"]),
        "corridor_scale": any(token in intervention for token in ["corridor", "wetland", "pavement", "garden"]),
    }


def _current_month(state: SwarmState) -> int:
    return datetime.fromisoformat(state["generated_at"]).month


def _compute_start_buffer(state: SwarmState) -> int:
    previous_risks = " ".join(state.get("previous_risks", [])).lower()
    month = _current_month(state)
    if "wet-season" not in previous_risks and "typhoon" not in previous_risks:
        return 1
    if month <= 5:
        return 30
    if month <= 10:
        return 10
    return 1


def _next_start_week(phases: list[Phase], explicit_start: int | None = None) -> int:
    if explicit_start is not None:
        return explicit_start
    if not phases:
        return 1
    last = phases[-1]
    return last.start_week + last.duration_weeks


def _append_phase(
    phases: list[Phase],
    *,
    phase_id: str,
    name: str,
    reasoning: str,
    duration_weeks: int,
    dependencies: list[str],
    category: str,
    start_week: int | None = None,
) -> None:
    phases.append(
        Phase(
            id=phase_id,
            name=name,
            reasoning_for_duration=reasoning,
            start_week=_next_start_week(phases, start_week),
            duration_weeks=duration_weeks,
            dependencies=dependencies,
            category=category,  # type: ignore[arg-type]
        )
    )


def _phase_end_date(state: SwarmState, phase: Phase) -> datetime:
    generated_at = datetime.fromisoformat(state["generated_at"])
    start = generated_at + timedelta(weeks=phase.start_week - 1)
    return start + timedelta(weeks=phase.duration_weeks)


def planner_node(state: SwarmState) -> SwarmState:
    recommendation = state["recommendation"]
    draft_phases = [
        Phase(
            id="phase-planning",
            name="Site assessment and implementation planning",
            reasoning_for_duration=f"Draft planning scope for {recommendation['solutionTitle']} using barangay constraints and environmental inputs.",
            start_week=0,
            duration_weeks=0,
            dependencies=[],
            category="planning",
        ),
        Phase(
            id="phase-legal",
            name="Permits and LGU coordination",
            reasoning_for_duration="Draft the legal and administrative sequence needed before procurement starts.",
            start_week=0,
            duration_weeks=0,
            dependencies=["phase-planning"],
            category="legal",
        ),
        Phase(
            id="phase-procurement",
            name="Procurement and supplier mobilization",
            reasoning_for_duration="Draft procurement around species, material, and contractor lead times.",
            start_week=0,
            duration_weeks=0,
            dependencies=["phase-legal"],
            category="procurement",
        ),
        Phase(
            id="phase-construction",
            name="Field installation and quality checks",
            reasoning_for_duration="Draft field deployment sequencing with safety and quality checkpoints.",
            start_week=0,
            duration_weeks=0,
            dependencies=["phase-procurement"],
            category="construction",
        ),
        Phase(
            id="phase-establishment",
            name="Establishment and early maintenance",
            reasoning_for_duration="Draft stabilization and early maintenance after installation.",
            start_week=0,
            duration_weeks=0,
            dependencies=["phase-construction"],
            category="construction",
        ),
    ]

    return {
        "timeline": ProjectTimeline(
            project_title=f"{recommendation['solutionTitle']} Delivery Timeline",
            total_duration_weeks=0,
            phases=draft_phases,
            risks=[],
            strategy_summary="Draft generated by planner; estimator will assign durations and sequencing.",
        )
    }


def estimator_node(state: SwarmState) -> SwarmState:
    recommendation = state["recommendation"]
    location = state.get("location") or {}
    signals = _signals(state)
    barangay = location.get("barangay") or "the target barangay"
    base_start = _compute_start_buffer(state)
    phases: list[Phase] = []

    planning_weeks = 2 + int(signals["community_sensitive"]) + int(signals["heat_sensitive"])
    legal_weeks = 2 + int(signals["permits_sensitive"])
    procurement_weeks = 2 + int(signals["tree_focused"]) + int(signals["flood_sensitive"])
    construction_weeks = (6 if signals["corridor_scale"] else 4) + int(signals["flood_sensitive"])
    establishment_weeks = (8 if signals["tree_focused"] else 6) + int(signals["community_sensitive"])

    _append_phase(
        phases,
        phase_id="phase-planning",
        name="Site assessment and implementation planning",
        reasoning=f"Allocate {planning_weeks} weeks for barangay walk-throughs, heat and drainage baseline checks, and scope definition in {barangay}.",
        duration_weeks=planning_weeks,
        dependencies=[],
        category="planning",
        start_week=base_start,
    )
    _append_phase(
        phases,
        phase_id="phase-legal",
        name="Permits and LGU coordination",
        reasoning=f"Allocate {legal_weeks} weeks to secure barangay coordination, document site access, and clear local permit dependencies before procurement begins.",
        duration_weeks=legal_weeks,
        dependencies=["phase-planning"],
        category="legal",
    )
    _append_phase(
        phases,
        phase_id="phase-procurement",
        name="Procurement and supplier mobilization",
        reasoning=f"Allocate {procurement_weeks} weeks for sourcing plants or construction inputs, canvassing vendors, and aligning contractor availability for {recommendation['solutionTitle']}.",
        duration_weeks=procurement_weeks,
        dependencies=["phase-legal"],
        category="procurement",
    )
    _append_phase(
        phases,
        phase_id="phase-construction",
        name="Field installation and quality checks",
        reasoning=f"Allocate {construction_weeks} weeks for staged field work, traffic-safe deployment, inspection, and quality assurance on site.",
        duration_weeks=construction_weeks,
        dependencies=["phase-procurement"],
        category="construction",
    )
    _append_phase(
        phases,
        phase_id="phase-establishment",
        name="Establishment and early maintenance",
        reasoning=f"Allocate {establishment_weeks} weeks for watering, replacement, inspection, and stabilization before the intervention is treated as operational.",
        duration_weeks=establishment_weeks,
        dependencies=["phase-construction"],
        category="construction",
    )

    strategy_summary = " ".join(
        [
            f"Sequence the project around {'heat mitigation' if signals['heat_sensitive'] else 'stormwater resilience' if signals['flood_sensitive'] else 'site readiness'}, then lock permits and supplier readiness before field work starts.",
            f"Start the planning track at week {base_start} so construction avoids avoidable weather or approval conflicts.",
            "Keep procurement, LGU coordination, and establishment maintenance explicit so the draft is reviewable before final sign-off.",
        ]
    )

    return {
        "timeline": ProjectTimeline(
            project_title=f"{recommendation['solutionTitle']} Delivery Timeline",
            total_duration_weeks=sum(phase.duration_weeks for phase in phases),
            phases=phases,
            risks=[],
            strategy_summary=strategy_summary,
        )
    }


def critic_node(state: SwarmState) -> SwarmState:
    signals = _signals(state)
    timeline = state["timeline"]
    risks: list[str] = []

    construction_phases = [phase for phase in timeline.phases if phase.category == "construction"]
    if any(5 <= _phase_end_date(state, phase).month <= 10 for phase in construction_phases):
        risks.append("Construction and establishment activities overlap Mandaue's wet-season window; delay field work or add stronger drainage and typhoon contingencies.")

    if signals["budget_sensitive"]:
        risks.append("Budget-sensitive context may force phased procurement or substitutions; confirm spend caps before locking supplier commitments.")

    if not (state.get("location") or {}).get("barangay"):
        risks.append("Site specificity is incomplete; validate the exact barangay and access conditions before permit filing and contractor deployment.")

    if signals["community_sensitive"] and state.get("revision_count", 0) == 0:
        risks.append("Community-facing work will need a communication window to avoid resistance during installation and early maintenance.")

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


def build_graph():
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

    return graph.compile(checkpointer=checkpointer, interrupt_before=["human_review"])


graph = build_graph()


def start_timeline(request: TimelineGenerateRequest) -> TimelineRecord:
    generated_at = datetime.now(UTC).isoformat()
    thread_id = str(uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    initial_state: SwarmState = {
        "thread_id": thread_id,
        "generated_at": generated_at,
        "recommendation": request.recommendation.model_dump(),
        "location": request.location.model_dump() if request.location else None,
        "chat_history": [message.model_dump() for message in request.chatHistory],
        "rag_metadata": {
            "location_label": _location_label(request.location.model_dump() if request.location else None),
            "message_count": len(request.chatHistory),
            "priority": request.recommendation.priority,
        },
        "location_label": _location_label(request.location.model_dump() if request.location else None),
        "previous_risks": [],
        "revision_count": 0,
        "reviewer_notes": None,
        "review_status": "draft",
    }

    result = graph.invoke(initial_state, config=config)
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
    config = {"configurable": {"thread_id": thread_id}}
    snapshot = graph.get_state(config)
    if snapshot is None or snapshot.values is None:
        return None

    state = snapshot.values
    continued = graph.invoke(
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
