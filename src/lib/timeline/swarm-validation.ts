import type {
  ApproveAgentTimelineRequest,
  GenerateAgentTimelineRequest,
} from "@/types/agent-timeline";

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseGenerateAgentTimelineRequest(
  value: unknown,
): ParseResult<GenerateAgentTimelineRequest> {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  if (!isNonEmptyString(value.threadId)) {
    return { ok: false, error: "threadId must be a non-empty string." };
  }

  if (!isRecord(value.ragMetadata)) {
    return { ok: false, error: "ragMetadata must be a JSON object." };
  }

  if (
    value.requestedStartDate !== undefined &&
    value.requestedStartDate !== null &&
    !isNonEmptyString(value.requestedStartDate)
  ) {
    return {
      ok: false,
      error: "requestedStartDate must be a non-empty string when provided.",
    };
  }

  return {
    ok: true,
    value: {
      threadId: value.threadId,
      ragMetadata: value.ragMetadata,
      requestedStartDate:
        typeof value.requestedStartDate === "string"
          ? value.requestedStartDate
          : undefined,
    },
  };
}

export function parseApproveAgentTimelineRequest(
  value: unknown,
): ParseResult<ApproveAgentTimelineRequest> {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  if (!isNonEmptyString(value.threadId)) {
    return { ok: false, error: "threadId must be a non-empty string." };
  }

  if (
    value.reviewAction !== undefined &&
    value.reviewAction !== "approve" &&
    value.reviewAction !== "regenerate"
  ) {
    return {
      ok: false,
      error: "reviewAction must be either 'approve' or 'regenerate'.",
    };
  }

  if (
    value.reviewerNotes !== undefined &&
    value.reviewerNotes !== null &&
    !isNonEmptyString(value.reviewerNotes)
  ) {
    return {
      ok: false,
      error: "reviewerNotes must be a non-empty string when provided.",
    };
  }

  return {
    ok: true,
    value: {
      threadId: value.threadId,
      reviewAction:
        value.reviewAction === "regenerate" ? "regenerate" : "approve",
      reviewerNotes:
        typeof value.reviewerNotes === "string"
          ? value.reviewerNotes
          : undefined,
    },
  };
}