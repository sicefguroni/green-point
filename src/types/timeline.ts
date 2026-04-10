export type TimelinePhaseIconKey =
  | "LAYOUT_PANEL_TOP"
  | "SPROUT"
  | "WRENCH";

export interface TimelineTaskSnapshot {
  id: string;
  title: string;
  description: string;
  phaseId: string;
  startDate: string;
  endDate: string;
}

export interface TimelinePhaseSnapshot {
  id: string;
  title: string;
  subtitle: string;
  iconKey: TimelinePhaseIconKey;
  startDate: string;
  endDate: string;
  tasks: TimelineTaskSnapshot[];
}

export interface TimelinePlanSnapshot {
  objective: string;
  locationLabel: string;
  generatedAt: string;
  constraints: string[];
  phases: TimelinePhaseSnapshot[];
}

export interface TimelineVersionSummary {
  id: string;
  versionNumber: number;
  basedOnVersionId?: string | null;
  changeReason?: string | null;
  createdBySupabaseUserId: string;
  createdAt: string;
}

export interface TimelineVersionRecord extends TimelineVersionSummary {
  snapshot: TimelinePlanSnapshot;
}

export interface TimelineRecommendationInput {
  id?: string;
  recommendationKey: string;
  title: string;
  description: string;
  interventionType?: string | null;
  source?: string | null;
  relevancy?: number | null;
  efficiencyScore?: number | null;
  estimatedCost?: number | null;
  costUnit?: string | null;
  equityIndex?: number | null;
  priority?: string | null;
  hasBudget?: boolean;
}

export interface ProjectTimelineRecord {
  id: string;
  recommendationId: string;
  status: string;
  createdBySupabaseUserId: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: TimelineVersionRecord;
  versions: TimelineVersionSummary[];
}

export interface CreateProjectTimelineRequest {
  recommendationId?: string;
  recommendationKey?: string;
  recommendation?: TimelineRecommendationInput;
  snapshot: TimelinePlanSnapshot;
  status?: string;
  changeReason?: string;
}

export interface CreateTimelineVersionRequest {
  snapshot: TimelinePlanSnapshot;
  status?: string;
  changeReason?: string;
}