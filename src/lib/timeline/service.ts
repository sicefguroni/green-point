import { getTimelineSwarmEnv } from "./env";
import type {
  TimelineApproveResponse,
  TimelineGenerateRequest,
  TimelineGenerateResponse,
  TimelineRegenerateRequest,
  TimelineRegenerateResponse,
  TimelineRecord,
} from "@/types/timeline";

export class TimelineServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TimelineServiceError";
    this.status = status;
  }
}

async function callTimelineSwarm<TResponse>(
  path: string,
  payload: object,
): Promise<TResponse> {
  const { baseUrl } = getTimelineSwarmEnv();

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TimelineServiceError(
        "Timeline generation timed out after 120 seconds. The Python service may be overloaded or slow.",
        504,
      );
    }
    throw new Error(
      `Timeline swarm service is unreachable at ${baseUrl}. Start the Python service or update TIMELINE_SWARM_SERVICE_URL.`,
    );
  }

  const body = (await response.json().catch(() => null)) as
    | { detail?: string; error?: string }
    | TResponse
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "detail" in body && body.detail
        ? body.detail
        : body && typeof body === "object" && "error" in body && body.error
          ? body.error
          : `Timeline swarm request failed with status ${response.status}.`;
    throw new TimelineServiceError(message, response.status);
  }

  return body as TResponse;
}

export async function generateTimelineRecord(
  input: TimelineGenerateRequest,
): Promise<TimelineRecord> {
  const response = await callTimelineSwarm<TimelineGenerateResponse>(
    "/timeline/generate",
    input,
  );
  return response.data;
}

export async function regenerateTimelineRecord(
  input: TimelineRegenerateRequest,
): Promise<TimelineRecord> {
  const response = await callTimelineSwarm<TimelineRegenerateResponse>(
    "/timeline/regenerate",
    input,
  );
  return response.data;
}

export async function approveTimelineRecord(
  threadId: string,
  reviewerNotes?: string,
): Promise<TimelineRecord> {
  const response = await callTimelineSwarm<TimelineApproveResponse>(
    "/timeline/approve",
    { threadId, reviewerNotes },
  );
  return response.data;
}