export type TimelineCategory = "planning" | "procurement" | "construction" | "legal";

export type TimelineReviewStatus = "draft" | "approved";

export interface Phase {
  id: string;
  name: string;
  reasoning_for_duration: string;
  start_week: number;
  duration_weeks: number;
  dependencies: string[];
  category: TimelineCategory;
}

export interface ProjectTimeline {
  project_title: string;
  total_duration_weeks: number;
  phases: Phase[];
  risks: string[];
  strategy_summary: string;
}

export interface TimelineRecommendationInput {
  id: string;
  recommendationId?: string;
  solutionTitle: string;
  solutionDescription: string;
  interventionType: string;
  priority?: string;
  efficiencyLevel?: string;
  impact?: number;
  equityIndex?: number;
}

export interface TimelineLocationInput {
  name?: string;
  address?: string;
  barangay?: string;
}

export interface TimelineLocationMetrics {
  ndvi?: number;
  lst?: number;
  treeCanopy?: number;
  greeneryIndex?: number;
  greeneryLevel?: string;
  floodHazard?: number;
  stormHazard?: number;
  aqi?: number;
}

export interface TimelineRagChunk {
  id: string;
  studyID: string;
  studyTitle: string;
  content: string;
  similarity: number;
}

export interface TimelineRagMetadata {
  query: string;
  context: TimelineLocationMetrics & { areaName?: string };
  chunks: TimelineRagChunk[];
}

export interface TimelineMessageInput {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface TimelineGenerateRequest {
  recommendation: TimelineRecommendationInput;
  location?: TimelineLocationInput;
  metrics?: TimelineLocationMetrics;
  chatHistory?: TimelineMessageInput[];
  ragMetadata?: TimelineRagMetadata;
}

export interface TimelineRecord {
  threadId: string;
  reviewStatus: TimelineReviewStatus;
  revisionCount: number;
  generatedAt: string;
  approvedAt?: string;
  locationLabel: string;
  reviewerNotes?: string | null;
  timeline: ProjectTimeline;
}

export interface TimelineGenerateResponse {
  success: true;
  data: TimelineRecord;
}

export interface TimelineApproveRequest {
  threadId: string;
  reviewerNotes?: string;
}

export interface TimelineApproveResponse {
  success: true;
  data: TimelineRecord;
}