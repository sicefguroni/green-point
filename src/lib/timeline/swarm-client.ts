import "server-only";

import type {
  AgentPhaseCategory,
  AgentProjectTimeline,
  AgentTimelineBridgeResponse,
  ApproveAgentTimelineRequest,
  GenerateAgentTimelineRequest,
} from "@/types/agent-timeline";
import type { TimelinePhaseIconKey, TimelinePlanSnapshot } from "@/types/timeline";

const DEFAULT_SWARM_SERVICE_URL = "http://127.0.0.1:8001";

interface PythonPhase {
  id: string;
  name: string;
  reasoning_for_duration: string;
  start_week: number;
  duration_weeks: number;
  dependencies: string[];
  category: AgentPhaseCategory;
}

interface PythonProjectTimeline {
  project_title: string;
  total_duration_weeks: number;
  phases: PythonPhase[];
  risks: string[];
  strategy_summary: string;
}

interface PythonTimelineResponse {
  thread_id: string;
  status: "awaiting_human_review" | "approved" | "needs_revision";
  revision_count: number;
  rag_metadata: Record<string, unknown>;
  timeline: PythonProjectTimeline;
  pending_risks: string[];
}

const ICON_BY_CATEGORY: Record<AgentPhaseCategory, TimelinePhaseIconKey> = {
  planning: "LAYOUT_PANEL_TOP",
  legal: "LAYOUT_PANEL_TOP",
  procurement: "WRENCH",
  construction: "SPROUT",
};

function buildServiceUrl(pathname: string) {
  const baseUrl =
    process.env.TIMELINE_SWARM_SERVICE_URL?.trim() || DEFAULT_SWARM_SERVICE_URL;

  return `${baseUrl.replace(/\/+$/, "")}${pathname}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addWeeks(date: Date, weeks: number) {
  return addDays(date, weeks * 7);
}

function resolveLocationLabel(ragMetadata: Record<string, unknown>) {
  const barangayName = ragMetadata.barangay_name;
  if (typeof barangayName === "string" && barangayName.trim()) {
    return `Barangay ${barangayName.trim()}, Mandaue City`;
  }

  return "Mandaue City";
}

function mapPythonTimeline(timeline: PythonProjectTimeline): AgentProjectTimeline {
  return {
    projectTitle: timeline.project_title,
    totalDurationWeeks: timeline.total_duration_weeks,
    phases: timeline.phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      reasoningForDuration: phase.reasoning_for_duration,
      startWeek: phase.start_week,
      durationWeeks: phase.duration_weeks,
      dependencies: [...phase.dependencies],
      category: phase.category,
    })),
    risks: [...timeline.risks],
    strategySummary: timeline.strategy_summary,
  };
}

export function toTimelinePlanSnapshot(
  timeline: AgentProjectTimeline,
  ragMetadata: Record<string, unknown>,
  requestedStartDate?: string,
): TimelinePlanSnapshot {
  const generatedAt = new Date();
  const baseDate = requestedStartDate ? new Date(requestedStartDate) : generatedAt;

  return {
    objective: timeline.projectTitle,
    locationLabel: resolveLocationLabel(ragMetadata),
    generatedAt: generatedAt.toISOString(),
    constraints: [...timeline.risks],
    phases: timeline.phases.map((phase) => {
      const phaseStart = addWeeks(baseDate, Math.max(phase.startWeek - 1, 0));
      const phaseEnd = addDays(
        phaseStart,
        Math.max(phase.durationWeeks * 7 - 1, 0),
      );

      const dependencyText =
        phase.dependencies.length > 0
          ? ` Dependencies: ${phase.dependencies.join(", ")}.`
          : "";

      return {
        id: phase.id,
        title: phase.name,
        subtitle: phase.reasoningForDuration,
        iconKey: ICON_BY_CATEGORY[phase.category],
        startDate: phaseStart.toISOString(),
        endDate: phaseEnd.toISOString(),
        tasks: [
          {
            id: `${phase.id}-task`,
            title: phase.name,
            description: `${phase.reasoningForDuration}${dependencyText}`,
            phaseId: phase.id,
            startDate: phaseStart.toISOString(),
            endDate: phaseEnd.toISOString(),
          },
        ],
      };
    }),
  };
}

async function postSwarmJson<TBody>(
  pathname: string,
  body: TBody,
): Promise<PythonTimelineResponse> {
  const response = await fetch(buildServiceUrl(pathname), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const responseJson = (await response.json().catch(() => ({}))) as
    | PythonTimelineResponse
    | { detail?: string };

  if (!response.ok) {
    const message =
      typeof responseJson === "object" &&
      responseJson !== null &&
      "detail" in responseJson &&
      typeof responseJson.detail === "string"
        ? responseJson.detail
        : `Timeline swarm request failed with ${response.status}`;

    throw new Error(message);
  }

  return responseJson as PythonTimelineResponse;
}

export async function generateAgentTimeline(
  input: GenerateAgentTimelineRequest,
): Promise<AgentTimelineBridgeResponse> {
  const raw = await postSwarmJson("/timelines/generate", {
    thread_id: input.threadId,
    rag_metadata: input.ragMetadata,
    requested_start_date: input.requestedStartDate,
  });

  const timeline = mapPythonTimeline(raw.timeline);

  return {
    threadId: raw.thread_id,
    status: raw.status,
    revisionCount: raw.revision_count,
    ragMetadata: raw.rag_metadata,
    timeline,
    pendingRisks: [...raw.pending_risks],
    uiSnapshot: toTimelinePlanSnapshot(
      timeline,
      raw.rag_metadata,
      input.requestedStartDate,
    ),
  };
}

export async function approveAgentTimeline(
  input: ApproveAgentTimelineRequest,
): Promise<AgentTimelineBridgeResponse> {
  const raw = await postSwarmJson("/timelines/approve", {
    thread_id: input.threadId,
    review_action: input.reviewAction ?? "approve",
    reviewer_notes: input.reviewerNotes,
  });

  const timeline = mapPythonTimeline(raw.timeline);

  return {
    threadId: raw.thread_id,
    status: raw.status,
    revisionCount: raw.revision_count,
    ragMetadata: raw.rag_metadata,
    timeline,
    pendingRisks: [...raw.pending_risks],
    uiSnapshot: toTimelinePlanSnapshot(timeline, raw.rag_metadata),
  };
}