"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  FileClock,
  FileText,
  ChartNoAxesGantt,
  LayoutPanelTop,
  ListChecks,
  PencilLine,
  RotateCcw,
  Save,
  Sprout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type ChatHistoryMessage,
  type TimelineViewMode,
} from "@/types/green_solutions";
import { type UIRecommendation } from "@/lib/recommendations";
import { type SelectedFeature } from "@/types/metrics";
import RoadmapView from "./TimelineTab/views/RoadmapView";
import GanttView from "./TimelineTab/views/GanttView";
import PdfPreviewView from "./TimelineTab/views/PdfPreviewView";
import { type TimelinePlan, type TimelinePhase } from "./TimelineTab/types";
import {
  buildTimelinePlan,
  daysBetween,
  deserializeTimelinePlan,
  serializeTimelinePlan,
} from "@/lib/timeline/plan";
import { isDraftStale } from "@/lib/timeline/draft";
import PhaseDetailModal from "./TimelineTab/PhaseDetailModal";
import {
  type CreateProjectTimelineRequest,
  type ProjectTimelineRecord,
} from "@/types/timeline";
import type {
  AgentTimelineBridgeResponse,
  AgentTimelineStatus,
} from "@/types/agent-timeline";
import { toast } from "sonner";

type ViewMode = TimelineViewMode;

interface TimelineTabProps {
  selectedRecommendation: UIRecommendation;
  selectedFeature?: SelectedFeature;
  chatHistory?: ChatHistoryMessage[];
  viewMode?: ViewMode;
  onViewModeChange?: Dispatch<SetStateAction<ViewMode>>;
  isFullscreen?: boolean;
}

const VIEW_OPTIONS: {
  id: ViewMode;
  label: string;
  Icon: React.ElementType;
}[] = [
  { id: "DEFAULT", label: "Step-by-Step", Icon: ListChecks },
  { id: "GANTT", label: "Gantt Chart", Icon: CalendarDays },
  { id: "PDF", label: "PDF Preview", Icon: FileText },
];

export default function TimelineTab({
  selectedRecommendation,
  selectedFeature,
  chatHistory = [],
  viewMode: controlledViewMode,
  onViewModeChange,
  isFullscreen = false,
}: TimelineTabProps) {
  const [localViewMode, setLocalViewMode] = useState<ViewMode>("DEFAULT");
  const [isExporting, setIsExporting] = useState(false);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [isTimelineSaving, setIsTimelineSaving] = useState(false);
  const [timelineRecord, setTimelineRecord] =
    useState<ProjectTimelineRecord | null>(null);
  const [agentThreadId, setAgentThreadId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentTimelineStatus | "idle">(
    "idle",
  );
  const [agentRisks, setAgentRisks] = useState<string[]>([]);
  const [agentRevisionCount, setAgentRevisionCount] = useState(0);
  const [hasRegenerated, setHasRegenerated] = useState(false);
  const [isAgentBusy, setIsAgentBusy] = useState(false);
  const [isRestoringDraft, setIsRestoringDraft] = useState(true);
  const [agentAction, setAgentAction] = useState<
    "generate" | "regenerate" | "approve" | null
  >(null);
  const [draftPlan, setDraftPlan] = useState<TimelinePlan>(() =>
    buildTimelinePlan(selectedRecommendation, chatHistory, selectedFeature),
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [opensUpward, setOpensUpward] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  const viewMode = controlledViewMode ?? localViewMode;
  const setViewMode = onViewModeChange ?? setLocalViewMode;
  const activeViewOption =
    VIEW_OPTIONS.find((option) => option.id === viewMode) ?? VIEW_OPTIONS[0];

  const generatedPlan = useMemo(
    () =>
      buildTimelinePlan(selectedRecommendation, chatHistory, selectedFeature),
    [selectedRecommendation, chatHistory, selectedFeature],
  );

  const generatedPlanRef = useRef(generatedPlan);
  generatedPlanRef.current = generatedPlan;

  const recommendationKey = useMemo(() => {
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
  }, [selectedFeature, selectedRecommendation.recommendationID]);

  const agentDraftStorageKey = useMemo(
    () => `timeline-agent-draft:${recommendationKey}`,
    [recommendationKey],
  );

  const baselineSnapshot = useMemo(() => {
    if (timelineRecord) {
      return JSON.stringify(timelineRecord.currentVersion.snapshot);
    }

    return JSON.stringify(serializeTimelinePlan(generatedPlan));
  }, [generatedPlan, timelineRecord]);

  const draftSnapshot = useMemo(
    () => JSON.stringify(serializeTimelinePlan(draftPlan)),
    [draftPlan],
  );

  const isDirty = baselineSnapshot !== draftSnapshot;
  const hasTimelineDraft = Boolean(timelineRecord) || Boolean(agentThreadId);
  const showEmptyState = !hasTimelineDraft && !isRestoringDraft;
  const canRegenerate = Boolean(agentThreadId) && !timelineRecord;
  const showRevisionBadge = hasRegenerated;
  const showAgentLoadingOverlay =
    agentAction === "generate" ||
    agentAction === "regenerate" ||
    agentAction === "approve";
  const showTimelineLoadingOverlay =
    showAgentLoadingOverlay || (isRestoringDraft && !hasTimelineDraft);

  useEffect(() => {
    if (!isViewMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!viewMenuRef.current?.contains(event.target as Node)) {
        setIsViewMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsViewMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isViewMenuOpen]);

  useEffect(() => {
    if (!isViewMenuOpen || !viewMenuRef.current) return;

    const viewportSpacing = 16;
    const estimatedMenuHeight = 188;
    const menuBounds = viewMenuRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - menuBounds.bottom;
    const spaceAbove = menuBounds.top;

    setOpensUpward(
      spaceBelow < estimatedMenuHeight + viewportSpacing &&
        spaceAbove > spaceBelow,
    );
  }, [isViewMenuOpen]);

  useEffect(() => {
    if (isFullscreen) {
      setIsViewMenuOpen(false);
    }
  }, [isFullscreen]);

  useEffect(() => {
    let ignore = false;

    const loadTimeline = async () => {
      setIsTimelineLoading(true);
      try {
        const response = await fetch(
          `/api/timelines?recommendationKey=${encodeURIComponent(recommendationKey)}`,
          {
            credentials: "same-origin",
          },
        );

        if (ignore) return;

        if (response.status === 404 || response.status === 401) {
          setTimelineRecord(null);
          setDraftPlan(
            deserializeTimelinePlan(
              serializeTimelinePlan(generatedPlanRef.current),
            ),
          );
          setIsEditMode(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load timeline (${response.status})`);
        }

        const payload = (await response.json()) as {
          data: ProjectTimelineRecord;
        };
        setTimelineRecord(payload.data);
        setDraftPlan(
          deserializeTimelinePlan(payload.data.currentVersion.snapshot),
        );
        setIsEditMode(false);
      } catch (error) {
        console.error("Failed to load timeline:", error);
        setTimelineRecord(null);
        setDraftPlan(
          deserializeTimelinePlan(
            serializeTimelinePlan(generatedPlanRef.current),
          ),
        );
      } finally {
        if (!ignore) {
          setIsTimelineLoading(false);
        }
      }
    };

    void loadTimeline();

    return () => {
      ignore = true;
    };
  }, [recommendationKey]);

  useEffect(() => {
    setIsRestoringDraft(true);

    if (timelineRecord) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(agentDraftStorageKey);
      }
      setAgentThreadId(null);
      setAgentStatus("idle");
      setAgentRisks([]);
      setAgentRevisionCount(0);
      setHasRegenerated(false);
      setIsRestoringDraft(false);
      return;
    }

    if (typeof window === "undefined") {
      setIsRestoringDraft(false);
      return;
    }

    const raw = sessionStorage.getItem(agentDraftStorageKey);
    if (!raw) {
      setAgentThreadId(null);
      setAgentStatus("idle");
      setAgentRisks([]);
      setAgentRevisionCount(0);
      setHasRegenerated(false);
      setIsRestoringDraft(false);
      return;
    }

    try {
      const restored = JSON.parse(raw) as {
        threadId?: string;
        status?: AgentTimelineStatus;
        pendingRisks?: string[];
        revisionCount?: number;
        hasRegenerated?: boolean;
        savedAt?: number;
        uiSnapshot?: ReturnType<typeof serializeTimelinePlan>;
      };

      const baselineSnapshot = serializeTimelinePlan(generatedPlanRef.current);
      if (
        isDraftStale({
          baselineGeneratedAt: baselineSnapshot.generatedAt,
          draftSavedAt: restored.savedAt,
          draftGeneratedAt: restored.uiSnapshot?.generatedAt,
        })
      ) {
        // Ignore stale drafts when the baseline snapshot is newer.
        sessionStorage.removeItem(agentDraftStorageKey);
        setAgentThreadId(null);
        setAgentStatus("idle");
        setAgentRisks([]);
        setAgentRevisionCount(0);
        setHasRegenerated(false);
        setDraftPlan(deserializeTimelinePlan(baselineSnapshot));
        setIsRestoringDraft(false);
        return;
      }

      if (restored.uiSnapshot) {
        setDraftPlan(deserializeTimelinePlan(restored.uiSnapshot));
      }

      setAgentThreadId(restored.threadId ?? null);
      setAgentStatus(restored.status ?? "awaiting_human_review");
      setAgentRisks(restored.pendingRisks ?? []);
      setAgentRevisionCount(restored.revisionCount ?? 0);
      setHasRegenerated(Boolean(restored.hasRegenerated));
    } catch {
      sessionStorage.removeItem(agentDraftStorageKey);
      setAgentThreadId(null);
      setAgentStatus("idle");
      setAgentRisks([]);
      setAgentRevisionCount(0);
      setHasRegenerated(false);
    } finally {
      setIsRestoringDraft(false);
    }
  }, [agentDraftStorageKey, timelineRecord]);

  useEffect(() => {
    if (!agentThreadId || timelineRecord) return;
    if (typeof window === "undefined") return;

    const payload = {
      threadId: agentThreadId,
      status: agentStatus === "idle" ? "awaiting_human_review" : agentStatus,
      pendingRisks: agentRisks,
      revisionCount: agentRevisionCount,
      hasRegenerated,
      savedAt: Date.now(),
      uiSnapshot: serializeTimelinePlan(draftPlan),
    };

    sessionStorage.setItem(agentDraftStorageKey, JSON.stringify(payload));
  }, [
    agentDraftStorageKey,
    agentRisks,
    agentStatus,
    agentThreadId,
    draftPlan,
    timelineRecord,
  ]);

  const durationDays = useMemo(() => {
    const first = draftPlan.phases[0]?.startDate;
    const last = draftPlan.phases[draftPlan.phases.length - 1]?.endDate;
    if (!first || !last) return 0;
    return daysBetween(first, last);
  }, [draftPlan]);

  const selectedPhase = useMemo(
    () =>
      draftPlan.phases.find((phase) => phase.id === selectedPhaseId) ?? null,
    [draftPlan, selectedPhaseId],
  );

  const handleOpenPhase = (phaseId: string, taskId?: string) => {
    setSelectedPhaseId(phaseId);
    setSelectedTaskId(taskId ?? null);
  };

  const handleClosePhaseModal = () => {
    setSelectedPhaseId(null);
    setSelectedTaskId(null);
  };

  const handleSavePhase = (updatedPhase: TimelinePhase) => {
    setDraftPlan((currentPlan) => ({
      ...currentPlan,
      phases: currentPlan.phases.map((phase) =>
        phase.id === updatedPhase.id ? updatedPhase : phase,
      ),
    }));
  };

  const resetDraftPlan = () => {
    if (timelineRecord) {
      setDraftPlan(
        deserializeTimelinePlan(timelineRecord.currentVersion.snapshot),
      );
    } else {
      setDraftPlan(
        deserializeTimelinePlan(serializeTimelinePlan(generatedPlan)),
      );
    }
    setIsEditMode(false);
  };

  const buildRegenerationNotes = () => {
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
  };

  const handlePrimaryTimelineAction = async () => {
    if (!hasTimelineDraft) {
      await generateAgentTimeline();
      return;
    }

    if (agentThreadId && agentStatus === "awaiting_human_review") {
      await reviewAgentTimeline("approve");
    }

    await persistTimeline();
  };

  const handleResetAction = async () => {
    if (canRegenerate) {
      await reviewAgentTimeline("regenerate", buildRegenerationNotes());
      return;
    }

    resetDraftPlan();
  };

  const buildThreadId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }

    return `${recommendationKey}-${Date.now()}`;
  };

  const buildRagMetadata = () => {
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
  };

  const applyAgentTimeline = (payload: AgentTimelineBridgeResponse) => {
    setDraftPlan(deserializeTimelinePlan(payload.uiSnapshot));
    setAgentStatus(payload.status);
    setAgentRisks(payload.pendingRisks);
    setAgentRevisionCount(payload.revisionCount);
    setIsEditMode(false);

    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        agentDraftStorageKey,
        JSON.stringify({
          threadId: payload.threadId,
          status: payload.status,
          pendingRisks: payload.pendingRisks,
          revisionCount: payload.revisionCount,
          hasRegenerated,
          savedAt: Date.now(),
          uiSnapshot: payload.uiSnapshot,
        }),
      );
    }
  };

  const generateAgentTimeline = async () => {
    if (isAgentBusy) return;

    setIsAgentBusy(true);
    setAgentAction("generate");
    try {
      const threadId = buildThreadId();

      const response = await fetch("/api/timeline/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          threadId,
          ragMetadata: buildRagMetadata(),
        }),
      });

      if (response.status === 401) {
        toast.error("Sign in first to generate an AI timeline.");
        return;
      }

      const responseJson = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: AgentTimelineBridgeResponse;
        error?: string;
      };

      if (!response.ok || !responseJson.success || !responseJson.data) {
        throw new Error(
          responseJson.error ?? "AI timeline generation failed.",
        );
      }

      setAgentThreadId(responseJson.data.threadId);
      applyAgentTimeline(responseJson.data);
      toast.success("AI timeline generated.");
    } catch (error) {
      console.error("AI timeline generation failed:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "AI timeline generation failed.",
      );
    } finally {
      setAgentAction(null);
      setIsAgentBusy(false);
    }
  };

  const reviewAgentTimeline = async (
    action: "approve" | "regenerate",
    reviewerNotes?: string,
  ) => {
    if (!agentThreadId) {
      toast.error("Generate a timeline before approving or regenerating.");
      return;
    }

    if (isAgentBusy) return;

    setIsAgentBusy(true);
    setAgentAction(action);
    try {
      const response = await fetch("/api/timeline/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          threadId: agentThreadId,
          reviewAction: action,
          reviewerNotes,
        }),
      });

      if (response.status === 401) {
        toast.error("Sign in first to approve or regenerate.");
        return;
      }

      const responseJson = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: AgentTimelineBridgeResponse;
        error?: string;
      };

      if (!response.ok || !responseJson.success || !responseJson.data) {
        throw new Error(responseJson.error ?? "AI timeline review failed.");
      }

      applyAgentTimeline(responseJson.data);

      if (action === "approve") {
        toast.success("AI timeline approved.");
      } else {
        setHasRegenerated(true);
        toast.success("AI timeline regenerated.");
      }
    } catch (error) {
      console.error("AI timeline review failed:", error);
      toast.error(
        error instanceof Error ? error.message : "AI timeline review failed.",
      );
    } finally {
      setAgentAction(null);
      setIsAgentBusy(false);
    }
  };

  const persistTimeline = async () => {
    if (isTimelineSaving) return;

    setIsTimelineSaving(true);
    try {
      const recommendationPayload: CreateProjectTimelineRequest = {
        recommendationKey,
        recommendation: {
          id: selectedRecommendation.id,
          recommendationKey,
          title: selectedRecommendation.solutionTitle,
          description: selectedRecommendation.solutionDescription,
          interventionType: selectedRecommendation.interventionType,
          source: selectedRecommendation.source,
          relevancy: selectedRecommendation.relevancy,
          efficiencyScore: selectedRecommendation.value,
          estimatedCost:
            selectedRecommendation.costEstimate?.totalEstimate ??
            selectedRecommendation.cost ??
            null,
          costUnit:
            selectedRecommendation.costEstimate?.currencyUnit ??
            selectedRecommendation.costUnit ??
            null,
          equityIndex: selectedRecommendation.equityIndex,
          priority: selectedRecommendation.priority,
          hasBudget: selectedRecommendation.hasBudget,
        },
        snapshot: serializeTimelinePlan(draftPlan),
        changeReason: timelineRecord
          ? "Manual amendment from timeline tab"
          : "Initial project timeline",
      };

      const response = timelineRecord
        ? await fetch(`/api/timelines/${timelineRecord.id}/versions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              snapshot: recommendationPayload.snapshot,
              changeReason: recommendationPayload.changeReason,
            }),
          })
        : await fetch("/api/timelines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(recommendationPayload),
          });

      if (response.status === 401) {
        toast.error("Sign in first to save or amend project timelines.");
        return;
      }

      const responseJson = (await response.json().catch(() => ({}))) as {
        data?: ProjectTimelineRecord;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          responseJson.error ?? "Could not save project timeline.",
        );
      }

      const refreshed = await fetch(
        `/api/timelines?recommendationKey=${encodeURIComponent(recommendationKey)}`,
        { credentials: "same-origin" },
      );

      if (!refreshed.ok) {
        throw new Error("Timeline saved, but refresh failed.");
      }

      const refreshedPayload = (await refreshed.json()) as {
        data: ProjectTimelineRecord;
      };

      setTimelineRecord(refreshedPayload.data);
      setDraftPlan(
        deserializeTimelinePlan(refreshedPayload.data.currentVersion.snapshot),
      );
      setIsEditMode(false);
      toast.success(
        timelineRecord
          ? "Timeline amendment saved."
          : "Project timeline created.",
      );
    } catch (error) {
      console.error("Failed to persist timeline:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save project timeline.",
      );
    } finally {
      setIsTimelineSaving(false);
    }
  };

  const baseFileName = selectedRecommendation.solutionTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const exportNodeAsPdf = async (fileName: string) => {
    if (!viewRef.current) return;

    const canvas = await html2canvas(viewRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
      onclone: (clonedDocument) => {
        const root = clonedDocument.querySelector(
          "[data-export-root=\"timeline\"]",
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
          if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
            return;
          }

          const computed = clonedDocument.defaultView?.getComputedStyle(element);
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
    pdf.save(fileName);
  };

  const exportCurrentView = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      const suffix =
        viewMode === "GANTT"
          ? "gantt"
          : viewMode === "PDF"
            ? "pdf-preview"
            : "roadmap";
      await exportNodeAsPdf(`${baseFileName}-${suffix}.pdf`);
      toast.success("Exported timeline view.");
    } catch (error) {
      console.error("Timeline export failed:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Timeline export failed. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sm:px-2 lg:px-6 shrink-0 border-b border-neutral-100 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          {hasTimelineDraft ? (
            <div className="flex items-center gap-4 text-xs font-semibold text-neutral-400">
              <div className="flex items-center gap-2">
                <LayoutPanelTop size={14} />
                View Strategy
              </div>
              <p className="bg-gray-200 py-1 px-2 rounded-md mt-1 text-xs font-semibold text-neutral-900">
                {isTimelineLoading
                  ? "Draft Only"
                  : timelineRecord
                    ? `Saved version ${timelineRecord.currentVersion.versionNumber}`
                    : "Draft Only"}
              </p>
            </div>
          ) : null}

          {hasTimelineDraft
            ? isFullscreen
              ? (
                  <div className="hidden lg:flex items-center justify-end gap-2">
                    {VIEW_OPTIONS.map(({ id, label, Icon }) => (
                      <Button
                        key={id}
                        variant="outline"
                        size="sm"
                        onClick={() => setViewMode(id)}
                        className={`shrink-0 whitespace-nowrap rounded-full text-xs sm:text-sm px-2.5 sm:px-3 transition-all ${
                          viewMode === id
                            ? "bg-primary-green text-white border-primary-green shadow-md shadow-green-200 hover:bg-primary-green/90 hover:text-white"
                            : "text-neutral-500 border-neutral-200 hover:bg-neutral-100"
                        }`}
                      >
                        <Icon size={13} />
                        {label}
                      </Button>
                    ))}
                  </div>
                )
              : (
                  <div ref={viewMenuRef} className="relative shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsViewMenuOpen((open) => !open)}
                      aria-expanded={isViewMenuOpen}
                      aria-haspopup="menu"
                      className="rounded-full border-neutral-200 bg-white px-3 text-xs text-neutral-600 shadow-sm hover:bg-neutral-50"
                    >
                      <activeViewOption.Icon size={13} />
                      {activeViewOption.label}
                      <ChevronDown
                        size={13}
                        className={`transition-transform ${isViewMenuOpen ? "rotate-180" : ""}`}
                      />
                    </Button>

                    {isViewMenuOpen ? (
                      <div
                        role="menu"
                        className={`absolute right-0 z-20 min-w-[12rem] overflow-hidden rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl shadow-neutral-200/70 ${
                          opensUpward ? "bottom-full mb-2" : "top-full mt-2"
                        }`}
                      >
                        {VIEW_OPTIONS.map(({ id, label, Icon }) => (
                          <button
                            key={id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={viewMode === id}
                            onClick={() => {
                              setViewMode(id);
                              setIsViewMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                              viewMode === id
                                ? "bg-primary-green/10 text-primary-green"
                                : "text-neutral-600 hover:bg-neutral-100"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Icon size={14} />
                              {label}
                            </span>
                            {viewMode === id ? <Check size={14} /> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
            : null}
        </div>

        {isFullscreen && hasTimelineDraft ? (
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide lg:hidden">
            <div className="flex items-center gap-2 min-w-max pb-1">
              {VIEW_OPTIONS.map(({ id, label, Icon }) => (
                <Button
                  key={id}
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(id)}
                  className={`shrink-0 whitespace-nowrap rounded-full text-xs sm:text-sm px-2.5 sm:px-3 transition-all ${
                    viewMode === id
                      ? "bg-primary-green text-white border-primary-green shadow-md shadow-green-200 hover:bg-primary-green/90 hover:text-white"
                      : "text-neutral-500 border-neutral-200 hover:bg-neutral-100"
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {hasTimelineDraft ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2">
              <p className="text-neutral-500">Est. Duration</p>
              <p className="font-bold text-neutral-800">{durationDays} Days</p>
            </div>
            <div className="flex justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2">
              <p className="text-neutral-500">Phases</p>
              <p className="font-bold text-neutral-800">
                {draftPlan.phases.length} Major Phases
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="sm:px-2 lg:px-6 flex-1 min-h-0 overflow-y-auto py-2 scrollbar-hide">
        {showEmptyState ? (
          <div className="h-full rounded-2xl border border-dashed border-neutral-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-neutral-700">
              No timeline created yet.
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Generate an AI timeline to unlock the roadmap, Gantt, and PDF views.
            </p>
            <div className="mt-5 flex justify-center">
              <Button
                variant="default"
                size="sm"
                onClick={generateAgentTimeline}
                disabled={isAgentBusy || isTimelineLoading}
                className="rounded-full px-4"
              >
                {isAgentBusy ? "Creating..." : "Create Timeline"}
              </Button>
            </div>
          </div>
        ) : (
          <div
            ref={viewRef}
            data-export-root="timeline"
            className="rounded-2xl bg-white p-4"
          >
            {viewMode === "DEFAULT" && (
              <RoadmapView
                plan={draftPlan}
                onOpenPhase={handleOpenPhase}
                showRevisionBadge={showRevisionBadge}
              />
            )}
            {viewMode === "GANTT" && (
              <GanttView plan={draftPlan} onOpenPhase={handleOpenPhase} />
            )}
            {viewMode === "PDF" && <PdfPreviewView plan={draftPlan} />}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-100 bg-white px-4 py-3 sm:p-4">
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:px-0">
          <div className="flex min-w-max items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCurrentView}
              disabled={isExporting || !hasTimelineDraft}
              title="Export current view as PDF"
              aria-label="Export current view as PDF"
              className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
            >
              <Download size={13} />
              {isFullscreen ? "Export (.pdf)" : null}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode((value) => !value)}
                title={
                  isEditMode
                    ? timelineRecord
                      ? "View timeline"
                      : "View draft"
                    : timelineRecord
                      ? "Edit timeline"
                      : "Edit draft"
                }
                aria-label={
                  isEditMode
                    ? timelineRecord
                      ? "View timeline"
                      : "View draft"
                    : timelineRecord
                      ? "Edit timeline"
                      : "Edit draft"
                }
                className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
                disabled={!hasTimelineDraft}
              >
                <PencilLine size={13} />
                {isFullscreen
                  ? isEditMode
                    ? timelineRecord
                      ? "View Timeline"
                      : "View Draft"
                    : timelineRecord
                      ? "Edit Timeline"
                      : "Edit Draft"
                  : null}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetAction}
                disabled={
                  !hasTimelineDraft ||
                  (!canRegenerate && !isDirty && !isEditMode) ||
                  isAgentBusy
                }
                title={canRegenerate ? "Regenerate" : "Reset changes"}
                aria-label={canRegenerate ? "Regenerate" : "Reset changes"}
                className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
              >
                <RotateCcw size={13} />
                {isFullscreen
                  ? canRegenerate
                    ? "Regenerate"
                    : "Reset Changes"
                  : null}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handlePrimaryTimelineAction}
                disabled={
                  isTimelineSaving ||
                  isTimelineLoading ||
                  (timelineRecord ? !isDirty : false) ||
                  isAgentBusy
                }
                className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
              >
                {timelineRecord ? (
                  <FileClock size={13} />
                ) : hasTimelineDraft ? (
                  <Check size={13} />
                ) : (
                  <ChartNoAxesGantt size={13} />
                )}
                {isTimelineSaving
                  ? timelineRecord
                    ? "Saving Amendment..."
                    : hasTimelineDraft
                      ? "Approving..."
                      : "Creating Timeline..."
                  : timelineRecord
                    ? "Save Amendment"
                    : hasTimelineDraft
                      ? "Approve"
                      : "Create Timeline"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PhaseDetailModal
        phase={selectedPhase}
        selectedTaskId={selectedTaskId}
        editable={isEditMode}
        onSavePhase={handleSavePhase}
        onClose={handleClosePhaseModal}
      />

      {showTimelineLoadingOverlay ? (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md animate-in fade-in duration-500">
          <div className="flex flex-col items-center gap-6 rounded-[3rem] border border-neutral-100 bg-white p-10 shadow-3xl animate-in zoom-in-95 duration-500">
            <div className="relative">
              <div className="h-24 w-24 animate-spin rounded-full border-[6px] border-primary-green/10 border-t-primary-green shadow-sm" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sprout size={36} className="text-primary-green animate-bounce" />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-black tracking-tight text-neutral-900">
                Preparing Project Timeline
              </h2>
              <p className="max-w-xs text-sm font-medium leading-relaxed text-neutral-500">
                Our AI planner is synthesizing research and local constraints to
                build your timeline.
              </p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-green" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-green delay-150" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-green delay-300" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
