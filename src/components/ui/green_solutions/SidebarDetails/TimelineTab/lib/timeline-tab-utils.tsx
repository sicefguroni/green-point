import { daysBetween } from "@/lib/timeline/plan";
import {
  CalendarDays,
  FileText,
  ListChecks,
} from "lucide-react";
import type { TimelinePlan } from "../types";
import type { TimelineViewMode } from "@/types/green_solutions";
import type { UIRecommendation } from "@/lib/recommendations";
import type { SelectedFeature } from "@/types/metrics";
import { serializeTimelinePlan } from "@/lib/timeline/plan";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export { daysBetween } from "@/lib/timeline/plan";

export type ViewMode = TimelineViewMode;

export const VIEW_OPTIONS: {
  id: ViewMode;
  label: string;
  Icon: React.ElementType;
}[] = [
  { id: "DEFAULT", label: "Step-by-Step", Icon: ListChecks },
  { id: "GANTT", label: "Gantt Chart", Icon: CalendarDays },
  { id: "PDF", label: "PDF Preview", Icon: FileText },
];

export function buildThreadId(recommendationKey: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${recommendationKey}-${Date.now()}`;
}

export function buildRagMetadata(
  selectedRecommendation: UIRecommendation,
  selectedFeature?: SelectedFeature,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    project_title: selectedRecommendation.solutionTitle,
    intervention_type:
      selectedRecommendation.interventionType ?? "urban greening",
    site_count: 1,
    needs_city_permit: true,
    budget_cycle: "annual",
    supplier_distance: "regional",
    labor_intensity: "medium",
  };
  if (selectedFeature?.barangay) {
    metadata.barangay_name = selectedFeature.barangay;
  }
  return metadata;
}

export function buildRegenerationNotes(draftPlan: TimelinePlan): string {
  const constraintNotes = draftPlan.constraints.length
    ? `Constraints: ${draftPlan.constraints.join("; ")}.`
    : "Constraints: none.";
  const phaseNotes = draftPlan.phases
    .map(
      (phase) =>
        `${phase.title} (${phase.startDate.toISOString()} - ${phase.endDate.toISOString()})`,
    )
    .join("; ");
  return `User edits summary. ${constraintNotes} Phases: ${phaseNotes}.`;
}

export function computeDurationDays(draftPlan: TimelinePlan): number {
  const first = draftPlan.phases[0]?.startDate;
  const last = draftPlan.phases[draftPlan.phases.length - 1]?.endDate;
  if (!first || !last) return 0;
  return daysBetween(first, last);
}

export function computeRecommendationKey(
  selectedRecommendation: UIRecommendation,
  selectedFeature?: SelectedFeature,
): string {
  const locationToken = [
    selectedFeature?.barangay,
    selectedFeature?.name,
    selectedFeature?.coords?.lat?.toFixed(4),
    selectedFeature?.coords?.lng?.toFixed(4),
  ]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${selectedRecommendation.recommendationID}-${locationToken || "general"}`;
}

export function computeBaseFileName(
  selectedRecommendation: UIRecommendation,
): string {
  return selectedRecommendation.solutionTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}


export function computeAgentDraftStorageKey(
  recommendationKey: string,
): string {
  return `timeline-agent-draft:${recommendationKey}`;
}

export function computeBaselineSnapshot(
  timelineRecord: { currentVersion: { snapshot: unknown } } | null,
  generatedPlan: TimelinePlan,
): string {
  if (timelineRecord) {
    return JSON.stringify(timelineRecord.currentVersion.snapshot);
  }
  return JSON.stringify(serializeTimelinePlan(generatedPlan));
}

export async function exportNodeAsPdf(
  viewRef: HTMLDivElement | null,
  viewMode: ViewMode,
  baseFileName: string,
): Promise<void> {
  if (!viewRef) return;

  const exportTarget =
    viewMode === "GANTT"
      ? viewRef.querySelector<HTMLElement>(
          '[data-export-node="timeline-gantt"]',
        ) ?? viewRef
      : viewRef;

  const captureWidth = Math.max(
    exportTarget.scrollWidth,
    exportTarget.clientWidth,
  );
  const captureHeight = Math.max(
    exportTarget.scrollHeight,
    exportTarget.clientHeight,
  );

  const canvas = await html2canvas(exportTarget, {
    backgroundColor: "#ffffff",
    scale: 2,
    width: captureWidth,
    height: captureHeight,
    windowWidth: captureWidth,
    windowHeight: captureHeight,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDocument) => {
      const root = clonedDocument.querySelector(
        '[data-export-root="timeline"]',
      );
      if (!root) return;

      const probe = clonedDocument.createElement("span");
      probe.style.position = "fixed";
      probe.style.opacity = "0";
      probe.style.pointerEvents = "none";
      probe.style.color = "#000";
      clonedDocument.body.appendChild(probe);

      const resolveColorToken = (token: string) => {
        probe.style.color = token.trim();
        return (
          clonedDocument.defaultView?.getComputedStyle(probe).color ?? token
        );
      };

      const replaceUnsupportedColors = (value: string) =>
        value.replace(
          /oklch\([^)]*\)|color-mix\([^)]*\)/gi,
          (match) => resolveColorToken(match),
        );

      const elements = [
        clonedDocument.documentElement,
        clonedDocument.body,
        root,
        ...Array.from(root.querySelectorAll("*")),
      ];
      const props = [
        "color",
        "background",
        "background-color",
        "border",
        "border-top",
        "border-right",
        "border-bottom",
        "border-left",
        "border-color",
        "border-top-color",
        "border-right-color",
        "border-bottom-color",
        "border-left-color",
        "outline-color",
        "text-decoration-color",
        "box-shadow",
        "text-shadow",
        "fill",
        "stroke",
      ];

      elements.forEach((element) => {
        if (
          !(element instanceof HTMLElement || element instanceof SVGElement)
        ) {
          return;
        }
        const computed =
          clonedDocument.defaultView?.getComputedStyle(element);
        if (!computed) return;
        props.forEach((prop) => {
          const value = computed.getPropertyValue(prop);
          if (
            !value ||
            (!value.includes("oklch") && !value.includes("color-mix"))
          ) {
            return;
          }
          const sanitized = replaceUnsupportedColors(value);
          if (sanitized !== value) {
            element.style.setProperty(prop, sanitized);
          }
        });
      });

      probe.remove();
    },
  });

  const imageData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(imageData, "PNG", 0, 0, canvas.width, canvas.height);
  const suffix =
    viewMode === "GANTT"
      ? "gantt"
      : viewMode === "PDF"
        ? "pdf-preview"
        : "roadmap";
  pdf.save(`${baseFileName}-${suffix}.pdf`);
}
