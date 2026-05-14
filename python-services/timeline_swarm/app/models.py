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