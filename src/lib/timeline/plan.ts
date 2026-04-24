import {
  LayoutPanelTop,
  Sprout,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { type UIRecommendation } from "@/lib/recommendations";
import { type ChatHistoryMessage } from "@/types/green_solutions";
import { type SelectedFeature } from "@/types/metrics";
import {
  type TimelinePhaseIconKey,
  type TimelinePlanSnapshot,
} from "@/types/timeline";
import {
  type TimelinePhase,
  type TimelinePlan,
  type TimelineTask,
} from "@/components/ui/green_solutions/SidebarDetails/TimelineTab/types";

const DAY_MS = 1000 * 60 * 60 * 24;

const PHASE_ICONS: Record<TimelinePhaseIconKey, LucideIcon> = {
  LAYOUT_PANEL_TOP: LayoutPanelTop,
  SPROUT: Sprout,
  WRENCH: Wrench,
};

const PHASE_ICON_KEYS = new Map<LucideIcon, TimelinePhaseIconKey>([
  [LayoutPanelTop, "LAYOUT_PANEL_TOP"],
  [Sprout, "SPROUT"],
  [Wrench, "WRENCH"],
]);

function addDays(start: Date, days: number) {
  const value = new Date(start);
  value.setDate(value.getDate() + days);
  return value;
}

function normalizeText(messages: ChatHistoryMessage[] = []) {
  return messages
    .map((message) => message.content)
    .join(" ")
    .toLowerCase();
}

function extractConstraints(messages: ChatHistoryMessage[] = []) {
  const context = normalizeText(messages);
  const constraints: string[] = [];

  if (/budget|cost|cheap|afford/i.test(context)) {
    constraints.push(
      "Prioritize budget-sensitive materials and phased roll-out.",
    );
  }
  if (/rain|flood|drainage|storm/i.test(context)) {
    constraints.push(
      "Account for drainage and flood resilience in placement and maintenance.",
    );
  }
  if (/heat|shade|temperature/i.test(context)) {
    constraints.push("Focus on canopy coverage and heat-mitigation zones.");
  }
  if (/community|resident|volunteer|participation/i.test(context)) {
    constraints.push(
      "Include community engagement milestones before and after planting.",
    );
  }
  if (/permit|approval|lgu|barangay hall/i.test(context)) {
    constraints.push(
      "Schedule local permits and barangay coordination as early dependencies.",
    );
  }

  return constraints;
}

function createPhaseTasks(
  phaseId: string,
  phaseTitle: string,
  startDate: Date,
  durationDays: number,
  recommendation: UIRecommendation,
): TimelineTask[] {
  const taskStart = startDate;
  const half = Math.max(4, Math.floor(durationDays / 2));
  const taskMid = addDays(startDate, half);
  const endDate = addDays(startDate, durationDays);

  return [
    {
      id: `${phaseId}-task-1`,
      phaseId,
      title: `${phaseTitle} kickoff`,
      description: `Align scope, site conditions, and resource needs for ${recommendation.solutionTitle}.`,
      startDate: taskStart,
      endDate: addDays(taskStart, Math.max(3, Math.floor(half * 0.7))),
    },
    {
      id: `${phaseId}-task-2`,
      phaseId,
      title: `${phaseTitle} execution`,
      description: `Deliver field activities and quality checks for ${recommendation.solutionTitle}.`,
      startDate: taskMid,
      endDate,
    },
  ];
}

export function buildTimelinePlan(
  recommendation: UIRecommendation,
  chatHistory: ChatHistoryMessage[] = [],
  selectedFeature?: SelectedFeature,
): TimelinePlan {
  const constraints = extractConstraints(chatHistory);
  const kickoff = new Date();

  const phaseBlueprints = [
    {
      id: "P1",
      title: "Preparation",
      subtitle: "Permits, baseline checks, and implementation planning",
      icon: LayoutPanelTop,
      days: 14,
    },
    {
      id: "P2",
      title: "Planting and Installation",
      subtitle: "Execute site work and intervention deployment",
      icon: Sprout,
      days: 28,
    },
    {
      id: "P3",
      title: "Maintenance and Monitoring",
      subtitle: "Stabilize outcomes through routine care and tracking",
      icon: Wrench,
      days: 60,
    },
  ] as const;

  const phases: TimelinePhase[] = [];
  let cursor = kickoff;

  phaseBlueprints.forEach((phase) => {
    const phaseStart = cursor;
    const phaseEnd = addDays(phaseStart, phase.days);
    phases.push({
      id: phase.id,
      title: phase.title,
      subtitle: phase.subtitle,
      icon: phase.icon,
      startDate: phaseStart,
      endDate: phaseEnd,
      tasks: createPhaseTasks(
        phase.id,
        phase.title,
        phaseStart,
        phase.days,
        recommendation,
      ),
    });

    cursor = addDays(phaseEnd, 1);
  });

  return {
    objective: recommendation.solutionTitle,
    locationLabel: selectedFeature?.customSelectionGeometry
      ? selectedFeature.barangay
        ? selectedFeature.customSelectionAreaHectares !== undefined &&
          selectedFeature.customSelectionAreaHectares !== null
          ? `Custom Area in Barangay ${selectedFeature.barangay}, Mandaue City (${selectedFeature.customSelectionAreaHectares.toFixed(2)} ha)`
          : `Custom Area in Barangay ${selectedFeature.barangay}, Mandaue City`
        : selectedFeature.customSelectionAreaHectares !== undefined &&
            selectedFeature.customSelectionAreaHectares !== null
          ? `Custom Area, Mandaue City (${selectedFeature.customSelectionAreaHectares.toFixed(2)} ha)`
          : "Custom Area, Mandaue City"
      : selectedFeature?.barangay
        ? `Barangay ${selectedFeature.barangay}, Mandaue City`
        : selectedFeature?.name || "Mandaue City",
    generatedAt: new Date(),
    constraints,
    phases,
  };
}

function getIconKey(icon: LucideIcon): TimelinePhaseIconKey {
  return PHASE_ICON_KEYS.get(icon) ?? "LAYOUT_PANEL_TOP";
}

export function serializeTimelinePlan(plan: TimelinePlan): TimelinePlanSnapshot {
  return {
    objective: plan.objective,
    locationLabel: plan.locationLabel,
    generatedAt: plan.generatedAt.toISOString(),
    constraints: [...plan.constraints],
    phases: plan.phases.map((phase) => ({
      id: phase.id,
      title: phase.title,
      subtitle: phase.subtitle,
      iconKey: getIconKey(phase.icon),
      startDate: phase.startDate.toISOString(),
      endDate: phase.endDate.toISOString(),
      tasks: phase.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        phaseId: task.phaseId,
        startDate: task.startDate.toISOString(),
        endDate: task.endDate.toISOString(),
      })),
    })),
  };
}

export function deserializeTimelinePlan(
  snapshot: TimelinePlanSnapshot,
): TimelinePlan {
  return {
    objective: snapshot.objective,
    locationLabel: snapshot.locationLabel,
    generatedAt: new Date(snapshot.generatedAt),
    constraints: [...snapshot.constraints],
    phases: snapshot.phases.map((phase) => ({
      id: phase.id,
      title: phase.title,
      subtitle: phase.subtitle,
      icon: PHASE_ICONS[phase.iconKey] ?? LayoutPanelTop,
      startDate: new Date(phase.startDate),
      endDate: new Date(phase.endDate),
      tasks: phase.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        phaseId: task.phaseId,
        startDate: new Date(task.startDate),
        endDate: new Date(task.endDate),
      })),
    })),
  };
}

export function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
}