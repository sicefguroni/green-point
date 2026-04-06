import { getTimelineSwarmEnv } from "./env";
import type {
  TimelineApproveResponse,
  TimelineGenerateRequest,
  TimelineGenerateResponse,
  TimelineRecord,
} from "@/types/timeline";

async function callTimelineSwarm<TResponse>(
  path: string,
  payload: object,
): Promise<TResponse> {
  const { baseUrl } = getTimelineSwarmEnv();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
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
    throw new Error(message);
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