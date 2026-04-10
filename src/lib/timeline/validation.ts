import {
  type CreateProjectTimelineRequest,
  type CreateTimelineVersionRequest,
  type TimelinePhaseSnapshot,
  type TimelinePlanSnapshot,
  type TimelineRecommendationInput,
  type TimelineTaskSnapshot,
} from "@/types/timeline";

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDateString(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isTaskSnapshot(value: unknown): value is TimelineTaskSnapshot {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    typeof value.description === "string" &&
    isNonEmptyString(value.phaseId) &&
    isIsoDateString(value.startDate) &&
    isIsoDateString(value.endDate)
  );
}

function isPhaseSnapshot(value: unknown): value is TimelinePhaseSnapshot {
  if (!isRecord(value) || !Array.isArray(value.tasks)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    typeof value.subtitle === "string" &&
    (value.iconKey === "LAYOUT_PANEL_TOP" ||
      value.iconKey === "SPROUT" ||
      value.iconKey === "WRENCH") &&
    isIsoDateString(value.startDate) &&
    isIsoDateString(value.endDate) &&
    value.tasks.every(isTaskSnapshot)
  );
}

function isTimelineRecommendationInput(
  value: unknown,
): value is TimelineRecommendationInput {
  if (!isRecord(value)) return false;

  if (!isNonEmptyString(value.recommendationKey)) return false;
  if (!isNonEmptyString(value.title)) return false;
  if (!isNonEmptyString(value.description)) return false;

  if (value.id !== undefined && value.id !== null && !isNonEmptyString(value.id)) {
    return false;
  }
  if (
    value.interventionType !== undefined &&
    value.interventionType !== null &&
    !isNonEmptyString(value.interventionType)
  ) {
    return false;
  }
  if (
    value.source !== undefined &&
    value.source !== null &&
    !isNonEmptyString(value.source)
  ) {
    return false;
  }
  if (
    value.priority !== undefined &&
    value.priority !== null &&
    !isNonEmptyString(value.priority)
  ) {
    return false;
  }

  const numericFields = [
    value.relevancy,
    value.efficiencyScore,
    value.estimatedCost,
    value.equityIndex,
  ];

  if (
    numericFields.some(
      (field) => field !== undefined && field !== null && typeof field !== "number",
    )
  ) {
    return false;
  }

  if (value.costUnit !== undefined && value.costUnit !== null && !isNonEmptyString(value.costUnit)) {
    return false;
  }

  if (value.hasBudget !== undefined && typeof value.hasBudget !== "boolean") {
    return false;
  }

  return true;
}

export function isTimelinePlanSnapshot(
  value: unknown,
): value is TimelinePlanSnapshot {
  if (!isRecord(value) || !Array.isArray(value.constraints) || !Array.isArray(value.phases)) {
    return false;
  }

  return (
    isNonEmptyString(value.objective) &&
    isNonEmptyString(value.locationLabel) &&
    isIsoDateString(value.generatedAt) &&
    value.constraints.every((constraint) => typeof constraint === "string") &&
    value.phases.length > 0 &&
    value.phases.every(isPhaseSnapshot)
  );
}

export function parseCreateProjectTimelineRequest(
  value: unknown,
): ParseResult<CreateProjectTimelineRequest> {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  if (
    value.recommendationId !== undefined &&
    value.recommendationId !== null &&
    !isNonEmptyString(value.recommendationId)
  ) {
    return { ok: false, error: "recommendationId must be a non-empty string." };
  }

  if (
    value.recommendationKey !== undefined &&
    value.recommendationKey !== null &&
    !isNonEmptyString(value.recommendationKey)
  ) {
    return { ok: false, error: "recommendationKey must be a non-empty string." };
  }

  if (!value.recommendationId && !value.recommendationKey && !value.recommendation) {
    return {
      ok: false,
      error:
        "recommendationId, recommendationKey, or recommendation metadata is required.",
    };
  }

  if (
    value.recommendation !== undefined &&
    value.recommendation !== null &&
    !isTimelineRecommendationInput(value.recommendation)
  ) {
    return { ok: false, error: "recommendation metadata is malformed." };
  }

  if (!isTimelinePlanSnapshot(value.snapshot)) {
    return { ok: false, error: "snapshot is malformed." };
  }

  if (value.status !== undefined && !isNonEmptyString(value.status)) {
    return { ok: false, error: "status must be a non-empty string." };
  }

  if (value.changeReason !== undefined && value.changeReason !== null && !isNonEmptyString(value.changeReason)) {
    return { ok: false, error: "changeReason must be a non-empty string when provided." };
  }

  return {
    ok: true,
    value: {
      recommendationId:
        typeof value.recommendationId === "string"
          ? value.recommendationId
          : undefined,
      recommendationKey:
        typeof value.recommendationKey === "string"
          ? value.recommendationKey
          : undefined,
      recommendation: isTimelineRecommendationInput(value.recommendation)
        ? value.recommendation
        : undefined,
      snapshot: value.snapshot,
      status: typeof value.status === "string" ? value.status : undefined,
      changeReason:
        typeof value.changeReason === "string" ? value.changeReason : undefined,
    },
  };
}

export function parseCreateTimelineVersionRequest(
  value: unknown,
): ParseResult<CreateTimelineVersionRequest> {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  if (!isTimelinePlanSnapshot(value.snapshot)) {
    return { ok: false, error: "snapshot is malformed." };
  }

  if (value.status !== undefined && !isNonEmptyString(value.status)) {
    return { ok: false, error: "status must be a non-empty string." };
  }

  if (value.changeReason !== undefined && value.changeReason !== null && !isNonEmptyString(value.changeReason)) {
    return { ok: false, error: "changeReason must be a non-empty string when provided." };
  }

  return {
    ok: true,
    value: {
      snapshot: value.snapshot,
      status: typeof value.status === "string" ? value.status : undefined,
      changeReason:
        typeof value.changeReason === "string" ? value.changeReason : undefined,
    },
  };
}