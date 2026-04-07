from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


TimelineCategory = Literal["planning", "procurement", "construction", "legal"]
TimelineReviewStatus = Literal["draft", "approved"]
MessageRole = Literal["user", "assistant"]
TechnicalPhaseHint = Literal["planning", "legal", "procurement", "construction", "operations"]
CostConfidence = Literal["low", "medium", "high"]


class Phase(BaseModel):
    id: str
    name: str
    reasoning_for_duration: str
    start_week: int
    duration_weeks: int
    dependencies: list[str] = Field(default_factory=list)
    category: TimelineCategory

    @field_validator("id")
    @classmethod
    def id_must_be_nonempty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Phase id must be a non-empty string")
        return v.strip()

    @field_validator("start_week")
    @classmethod
    def start_week_non_negative(cls, v: int) -> int:
        return max(0, v)

    @field_validator("duration_weeks")
    @classmethod
    def duration_weeks_non_negative(cls, v: int) -> int:
        return max(0, v)


class ProjectTimeline(BaseModel):
    project_title: str
    total_duration_weeks: int
    phases: list[Phase]
    risks: list[str] = Field(default_factory=list)
    strategy_summary: str

    @model_validator(mode="after")
    def phases_must_be_nonempty(self) -> "ProjectTimeline":
        if not self.phases:
            raise ValueError("ProjectTimeline must contain at least one phase")
        return self


class TechnicalConsideration(BaseModel):
    title: str
    detail: str
    phaseHint: TechnicalPhaseHint
    sourceStudy: str | None = None


class CostLineItem(BaseModel):
    category: Literal["materials", "labor", "permits", "maintenance", "contingency", "other"]
    label: str
    estimatedCost: float
    rationale: str | None = None
    sourceStudy: str | None = None


class CostMarketReference(BaseModel):
    title: str
    url: str
    snippet: str
    score: float | None = None
    locality: str | None = None


class CostBreakdown(BaseModel):
    materials: float
    labor: float
    contingency: float
    permits: float | None = None
    maintenance: float | None = None
    other: float | None = None


class CostEstimate(BaseModel):
    interventionType: str
    basePrice: float
    totalEstimate: float
    currencyUnit: str
    perUnit: str
    area: float | None = None
    locationMultiplier: float
    breakdown: CostBreakdown
    estimateBasis: str | None = None
    confidence: CostConfidence | None = None
    assumptions: list[str] = Field(default_factory=list)
    costDrivers: list[str] = Field(default_factory=list)
    technicalConsiderations: list[TechnicalConsideration] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    lineItems: list[CostLineItem] = Field(default_factory=list)
    marketReferences: list[CostMarketReference] = Field(default_factory=list)
    sourceContext: dict[str, object] = Field(default_factory=dict)


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
    rationale: str | None = None
    sourceStudy: str | None = None


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
    costEstimate: CostEstimate | None = None


class TimelineRegenerateRequest(TimelineGenerateRequest):
    threadId: str
    userProvidedContext: str | None = None


class TimelineRecord(BaseModel):
    threadId: str
    reviewStatus: TimelineReviewStatus
    revisionCount: int
    generatedAt: str
    approvedAt: str | None = None
    locationLabel: str
    reviewerNotes: str | None = None
    timeline: ProjectTimeline
    costEstimate: CostEstimate | None = None


class TimelineGenerateResponse(BaseModel):
    success: Literal[True] = True
    data: TimelineRecord


class TimelineRegenerateResponse(BaseModel):
    success: Literal[True] = True
    data: TimelineRecord


class TimelineApproveRequest(BaseModel):
    threadId: str
    reviewerNotes: str | None = None


class TimelineApproveResponse(BaseModel):
    success: Literal[True] = True
    data: TimelineRecord
