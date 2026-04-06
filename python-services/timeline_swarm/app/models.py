from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


TimelineCategory = Literal["planning", "procurement", "construction", "legal"]
TimelineReviewStatus = Literal["draft", "approved"]
MessageRole = Literal["user", "assistant"]


class Phase(BaseModel):
    id: str
    name: str
    reasoning_for_duration: str
    start_week: int
    duration_weeks: int
    dependencies: list[str] = Field(default_factory=list)
    category: TimelineCategory


class ProjectTimeline(BaseModel):
    project_title: str
    total_duration_weeks: int
    phases: list[Phase]
    risks: list[str] = Field(default_factory=list)
    strategy_summary: str


class TimelineRecommendationInput(BaseModel):
    id: str
    recommendationId: str | None = None
    solutionTitle: str
    solutionDescription: str
    interventionType: str
    priority: str | None = None
    efficiencyLevel: str | None = None
    impact: float | None = None
    equityIndex: float | None = None


class TimelineLocationInput(BaseModel):
    name: str | None = None
    address: str | None = None
    barangay: str | None = None


class TimelineLocationMetrics(BaseModel):
    ndvi: float | None = None
    lst: float | None = None
    treeCanopy: float | None = None
    greeneryIndex: float | None = None
    greeneryLevel: str | None = None
    floodHazard: float | None = None
    stormHazard: float | None = None
    aqi: float | None = None


class TimelineRagChunk(BaseModel):
    id: str
    studyID: str
    studyTitle: str
    content: str
    similarity: float


class TimelineRagMetadata(BaseModel):
    query: str
    context: dict[str, float | str | None] = Field(default_factory=dict)
    chunks: list[TimelineRagChunk] = Field(default_factory=list)


class TimelineMessageInput(BaseModel):
    role: MessageRole
    content: str
    timestamp: str | None = None


class TimelineGenerateRequest(BaseModel):
    recommendation: TimelineRecommendationInput
    location: TimelineLocationInput | None = None
    metrics: TimelineLocationMetrics | None = None
    chatHistory: list[TimelineMessageInput] = Field(default_factory=list)
    ragMetadata: TimelineRagMetadata | None = None


class TimelineRecord(BaseModel):
    threadId: str
    reviewStatus: TimelineReviewStatus
    revisionCount: int
    generatedAt: str
    approvedAt: str | None = None
    locationLabel: str
    reviewerNotes: str | None = None
    timeline: ProjectTimeline


class TimelineGenerateResponse(BaseModel):
    success: Literal[True] = True
    data: TimelineRecord


class TimelineApproveRequest(BaseModel):
    threadId: str
    reviewerNotes: str | None = None


class TimelineApproveResponse(BaseModel):
    success: Literal[True] = True
    data: TimelineRecord
