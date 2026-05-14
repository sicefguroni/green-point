import type { TimelinePlanSnapshot } from "./timeline";

export type AgentPhaseCategory =
  | "planning"
  | "procurement"
  | "construction"
  | "legal";

export type AgentTimelineStatus =
  | "awaiting_human_review"
  | "approved"
  | "needs_revision";

export interface AgentTimelinePhase {
  id: string;
  name: string;
  reasoningForDuration: string;
  startWeek: number;
  durationWeeks: number;
  dependencies: string[];
  category: AgentPhaseCategory;
}

export interface AgentProjectTimeline {
  projectTitle: string;
  totalDurationWeeks: number;
  phases: AgentTimelinePhase[];
  risks: string[];
  strategySummary: string;
}

export interface GenerateAgentTimelineRequest {
  threadId: string;
  ragMetadata: Record<string, unknown>;
  requestedStartDate?: string;
}

export interface ApproveAgentTimelineRequest {
  threadId: string;
  reviewAction?: "approve" | "regenerate";
  reviewerNotes?: string;
}

export interface AgentTimelineBridgeResponse {
  threadId: string;
  status: AgentTimelineStatus;
  revisionCount: number;
  ragMetadata: Record<string, unknown>;
  timeline: AgentProjectTimeline;
  pendingRisks: string[];
  uiSnapshot: TimelinePlanSnapshot;
}