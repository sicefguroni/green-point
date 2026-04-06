import type { LucideIcon } from "lucide-react";

export interface TimelineBadge {
  label: string;
  tone: "neutral" | "info" | "success" | "warning";
}

export interface TimelineTask {
  id: string;
  title: string;
  description: string;
  phaseId: string;
  startDate: Date;
  endDate: Date;
}

export interface TimelinePhase {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  startDate: Date;
  endDate: Date;
  tasks: TimelineTask[];
  badges?: TimelineBadge[];
  approvalNote?: string;
}

export interface TimelinePlan {
  objective: string;
  locationLabel: string;
  generatedAt: Date;
  constraints: string[];
  phases: TimelinePhase[];
  reviewStatus?: string;
  approvedAt?: Date;
  reviewerNotes?: string | null;
  threadId?: string;
}
