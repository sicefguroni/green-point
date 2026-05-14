from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


PhaseCategory = Literal["planning", "procurement", "construction", "legal"]
ReviewAction = Literal["approve", "regenerate"]
TimelineStatus = Literal["awaiting_human_review", "approved", "needs_revision"]


class Phase(StrictModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    reasoning_for_duration: str = Field(min_length=1)
    start_week: int = Field(ge=0)
    duration_weeks: int = Field(ge=0)
    dependencies: List[str] = Field(default_factory=list)
    category: PhaseCategory


class ProjectTimeline(StrictModel):
    project_title: str = Field(min_length=1)
    total_duration_weeks: int = Field(ge=0)
    phases: List[Phase] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    strategy_summary: str = Field(min_length=1)

class PlannerDraft(StrictModel):
    project_title: str = Field(min_length=1)
    phases: List[Phase] = Field(default_factory=list)
    strategy_summary: str = Field(min_length=1)

class CriticResult(StrictModel):
    risks: List[str] = Field(default_factory=list)

class GenerateTimelineRequest(StrictModel):
    thread_id: str = Field(min_length=1)
    rag_metadata: Dict[str, Any] = Field(default_factory=dict)
    requested_start_date: Optional[str] = None

class ReviewTimelineRequest(StrictModel):
    thread_id: str = Field(min_length=1)
    review_action: ReviewAction = "approve"
    reviewer_notes: Optional[str] = None

class TimelineServiceResponse(StrictModel):
    thread_id: str
    status: TimelineStatus
    revision_count: int = Field(ge=0)
    rag_metadata: Dict[str, Any] = Field(default_factory=dict)
    timeline: ProjectTimeline
    pending_risks: List[str] = Field(default_factory=list)