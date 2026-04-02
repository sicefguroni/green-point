import type { LucideIcon } from "lucide-react";

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
}

export interface TimelinePlan {
  objective: string;
  locationLabel: string;
  generatedAt: Date;
  constraints: string[];
  phases: TimelinePhase[];
}
