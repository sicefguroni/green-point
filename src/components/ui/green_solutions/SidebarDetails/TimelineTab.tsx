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
  FileDown,
  FileText,
  LayoutPanelTop,
  ListChecks,
  PencilLine,
  RotateCcw,
  Save,
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
import PhaseDetailModal from "./TimelineTab/PhaseDetailModal";
import {
  type CreateProjectTimelineRequest,
  type ProjectTimelineRecord,
} from "@/types/timeline";
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

  const exportNodeAsImage = async (fileName: string) => {
    if (!viewRef.current) return;

    const canvas = await html2canvas(viewRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
    });
    const href = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    link.click();
  };

  const exportNodeAsPdf = async (fileName: string) => {
    if (!viewRef.current) return;

    const canvas = await html2canvas(viewRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
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
      if (viewMode === "GANTT") {
        await exportNodeAsImage(`${baseFileName}-gantt.png`);
      } else {
        await exportNodeAsPdf(`${baseFileName}-report.pdf`);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const exportPdf = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      await exportNodeAsPdf(`${baseFileName}-timeline.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportPng = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      await exportNodeAsImage(`${baseFileName}-timeline.png`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="sm:px-2 lg:px-6 shrink-0 border-b border-neutral-100 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs font-semibold text-neutral-400">
            <div className="flex items-center gap-2">
              <LayoutPanelTop size={14} />
              View Strategy
            </div>
            <p className="bg-gray-200 py-1 px-2 rounded-md mt-1 text-xs font-semibold text-neutral-900">
              {isTimelineLoading
                ? "Fetching..."
                : timelineRecord
                  ? `Saved version ${timelineRecord.currentVersion.versionNumber}`
                  : "Draft Only"}
            </p>
          </div>

          {isFullscreen ? (
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
          ) : (
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
          )}
        </div>

        {isFullscreen ? (
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
      </div>

      <div className="sm:px-2 lg:px-6 flex-1 overflow-y-auto py-2 scrollbar-hide">
        <div ref={viewRef} className="rounded-2xl bg-white p-4">
          {viewMode === "DEFAULT" && (
            <RoadmapView plan={draftPlan} onOpenPhase={handleOpenPhase} />
          )}
          {viewMode === "GANTT" && (
            <GanttView plan={draftPlan} onOpenPhase={handleOpenPhase} />
          )}
          {viewMode === "PDF" && <PdfPreviewView plan={draftPlan} />}
        </div>
      </div>

      <div className="shrink-0 border-t border-neutral-100 bg-white px-4 py-3 sm:p-4">
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:px-0">
          <div className="flex min-w-max items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCurrentView}
              disabled={isExporting}
              title={
                viewMode === "GANTT"
                  ? "Export current view as PNG"
                  : "Export current view as PDF"
              }
              aria-label={
                viewMode === "GANTT"
                  ? "Export current view as PNG"
                  : "Export current view as PDF"
              }
              className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
            >
              <Download size={13} />
              {isFullscreen
                ? viewMode === "GANTT"
                  ? "Export (.png)"
                  : "Export (.pdf)"
                : null}
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
                onClick={resetDraftPlan}
                disabled={!isDirty && !isEditMode}
                title="Reset changes"
                aria-label="Reset changes"
                className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
              >
                <RotateCcw size={13} />
                {isFullscreen ? "Reset Changes" : null}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={persistTimeline}
                disabled={
                  isTimelineSaving ||
                  isTimelineLoading ||
                  (timelineRecord ? !isDirty : false)
                }
                className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
              >
                {timelineRecord ? <FileClock size={13} /> : <Save size={13} />}
                {isTimelineSaving
                  ? timelineRecord
                    ? "Saving Amendment..."
                    : "Creating Timeline..."
                  : timelineRecord
                    ? "Save Amendment"
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
    </div>
  );
}
