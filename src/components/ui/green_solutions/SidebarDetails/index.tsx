"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeft,
  Bookmark,
  CalendarRange,
  Download,
  Info,
  Maximize2,
  MessageSquare,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { type BarangayData } from "@/context/BarangayContext";
import {
  type DetailTab,
  type ChatHistoryMessage,
  type TimelineViewMode,
  type CostEstimate,
} from "@/types/green_solutions";
import { type UIRecommendation } from "@/lib/recommendations";
import { type SelectedFeature } from "@/types/metrics";
import { resolveStrategyKey } from "@/lib/simulation/cost-model";
import { COEFFICIENTS, CANONICAL_CANOPY_TARGET_PCT } from "@/lib/simulation/coefficients";
import { exportElementToMultiPagePdf } from "@/lib/export/html-to-pdf";
import InfoTab from "./InfoTab";
import ChatTab from "./ChatTab";
import TimelineTab from "./TimelineTab";
import GreenSolutionExportDocument from "./GreenSolutionExportDocument";
import type { TimelinePlan } from "./TimelineTab/types";

interface SidebarDetailProps {
  recommendation: UIRecommendation;
  selectedFeature: SelectedFeature;
  selectedBarangayData: BarangayData | null;
  onBack: () => void;
  currentTab?: DetailTab;
  onCurrentTabChange?: Dispatch<SetStateAction<DetailTab>>;
  chatMessages?: ChatHistoryMessage[];
  onChatMessagesChange?: Dispatch<SetStateAction<ChatHistoryMessage[]>>;
  chatInput?: string;
  onChatInputChange?: Dispatch<SetStateAction<string>>;
  isChatLoading?: boolean;
  onChatLoadingChange?: Dispatch<SetStateAction<boolean>>;
  timelineViewMode?: TimelineViewMode;
  onTimelineViewModeChange?: Dispatch<SetStateAction<TimelineViewMode>>;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
}

const TABS: { id: DetailTab; label: string; Icon: React.ElementType }[] = [
  { id: "INFO", label: "Technical Info", Icon: Info },
  { id: "CHAT", label: "AI Assistant", Icon: MessageSquare },
  { id: "TIMELINE", label: "Timeline", Icon: CalendarRange },
];

export default function SidebarDetail({
  recommendation,
  selectedFeature,
  selectedBarangayData,
  onBack,
  currentTab: controlledCurrentTab,
  onCurrentTabChange,
  chatMessages: controlledChatMessages,
  onChatMessagesChange,
  chatInput: controlledChatInput,
  onChatInputChange,
  isChatLoading: controlledIsChatLoading,
  onChatLoadingChange,
  timelineViewMode,
  onTimelineViewModeChange,
  isFullscreen = false,
  onToggleFullscreen,
  isSaved = false,
  onToggleSave,
}: SidebarDetailProps) {
  const [localCurrentTab, setLocalCurrentTab] = useState<DetailTab>("INFO");
  const [localChatHistory, setLocalChatHistory] = useState<
    ChatHistoryMessage[]
  >([]);
  const [localChatInput, setLocalChatInput] = useState("");
  const [localIsChatLoading, setLocalIsChatLoading] = useState(false);

  const currentTab = controlledCurrentTab ?? localCurrentTab;
  const setCurrentTab = onCurrentTabChange ?? setLocalCurrentTab;
  const chatHistory = controlledChatMessages ?? localChatHistory;
  const setChatHistory = onChatMessagesChange ?? setLocalChatHistory;
  const chatInput = controlledChatInput ?? localChatInput;
  const setChatInput = onChatInputChange ?? setLocalChatInput;
  const isChatLoading = controlledIsChatLoading ?? localIsChatLoading;
  const setIsChatLoading = onChatLoadingChange ?? setLocalIsChatLoading;

  const [isTimelineReady, setIsTimelineReady] = useState(false);
  const [timelineExportContext, setTimelineExportContext] = useState<{
    plan: TimelinePlan;
    risks: string[];
  } | null>(null);
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [exportCostEstimate, setExportCostEstimate] =
    useState<CostEstimate | null>(recommendation.costEstimate ?? null);
  const exportDocumentRef = useRef<HTMLDivElement>(null);

  const interventionType =
    recommendation.interventionType || recommendation.solutionTitle;

  // Compute realistic treatment footprint (same logic as InfoTab) so the
  // export cost estimate matches the explore sidebar — not the full site area.
  const canonicalStrategyKey = resolveStrategyKey(interventionType);
  const coeffs = COEFFICIENTS[canonicalStrategyKey];
  const treatedFraction = (coeffs?.treatedFractionPerCanopyPoint?.mid ?? 0.01) * CANONICAL_CANOPY_TARGET_PCT;
  const selectedAreaSqm =
    selectedFeature.customSelectionAreaHectares !== undefined &&
    selectedFeature.customSelectionAreaHectares !== null
      ? selectedFeature.customSelectionAreaHectares * 10000 * treatedFraction
      : null;
  const selectedBarangayId =
    selectedFeature.barangay?.trim().length > 0
      ? selectedFeature.barangay
      : null;

  useEffect(() => {
    setIsTimelineReady(false);
    setTimelineExportContext(null);
  }, [recommendation.recommendationID, selectedFeature.name]);

  useEffect(() => {
    if (recommendation.costEstimate) {
      setExportCostEstimate(recommendation.costEstimate);
      return;
    }

    const fetchCostEstimate = async () => {
      try {
        const params = new URLSearchParams({
          interventionType,
          ...(selectedAreaSqm !== null && { area: selectedAreaSqm.toString() }),
          ...(selectedBarangayId && { barangayId: selectedBarangayId }),
        });

        const response = await fetch(`/api/cost-estimate?${params}`);
        const result = await response.json();

        if (result.success) {
          setExportCostEstimate(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch cost estimate for export:", error);
      }
    };

    void fetchCostEstimate();
  }, [
    interventionType,
    recommendation.costEstimate,
    selectedAreaSqm,
    selectedBarangayId,
  ]);

  const baseFileName = recommendation.solutionTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const exportFullReport = async () => {
    if (!isTimelineReady || !timelineExportContext) {
      toast.error("Generate a timeline in the Timeline tab before exporting.");
      return;
    }

    if (isExportingReport) return;

    // Start rendering the export div so the ref becomes available
    setIsExportingReport(true);

    try {
      // Wait a frame for React to commit the export div to the DOM
      await new Promise((resolve) => requestAnimationFrame(resolve));

      if (!exportDocumentRef.current) {
        throw new Error("Export document not ready in DOM");
      }

      await exportElementToMultiPagePdf(exportDocumentRef.current, {
        fileName: `${baseFileName}-greening-solution-report.pdf`,
        title: "GreenPoint Greening Solution Report",
        subtitle: `${recommendation.solutionTitle} · ${selectedFeature.name ?? "Selected site"} · ${new Date().toLocaleString()}`,
        rootSelector: '[data-export-root="green-solution-report"]',
      });
      toast.success("Exported complete greening solution report.");
    } catch (error) {
      console.error("Greening solution export failed:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Export failed. Please try again.",
      );
    } finally {
      setIsExportingReport(false);
    }
  };

  const canExportFullReport = isTimelineReady && Boolean(timelineExportContext);

  return (
    <div className="relative flex flex-1 min-h-0">
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div
          className={`border-b border-neutral-100 shrink-0 bg-white/50 ${
            isFullscreen
              ? "px-4 sm:px-6 py-2 space-y-2"
              : "p-2 space-y-2"
          }`}
        >
          <div className={`flex items-start justify-between gap-4 ${isFullscreen ? "py-1.5" : "py-1"}`}>
            <div className={`flex flex-col min-w-0 ${isFullscreen ? "gap-1.5" : "gap-2"}`}>
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-xs font-semibold 
                text-neutral-500 hover:text-primary-green 
                transition-colors group w-fit cursor-pointer"
              >
                <ArrowLeft
                  size={12}
                  className="group-hover:-translate-x-0.5 transition-transform duration-150"
                />
                Back to Discovery
              </button>

              <h2 className={`font-bold text-neutral-900 font-poppins tracking-tight leading-tight ${
                isFullscreen ? "text-xl" : "text-2xl"
              }`}>
                {recommendation.solutionTitle}
              </h2>
            </div>

            {onToggleFullscreen ? (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="hidden lg:inline-flex shrink-0 rounded-full border border-neutral-200 bg-white p-2 text-neutral-500 shadow-sm transition-colors hover:border-primary-green/30 hover:text-primary-green"
                aria-label={
                  isFullscreen
                    ? "Exit fullscreen detail view"
                    : "Open fullscreen detail view"
                }
                title={isFullscreen ? "Exit fullscreen" : "Open fullscreen"}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            ) : null}
          </div>

          {/* Action buttons — hidden on CHAT tab (not relevant), and in fullscreen on TIMELINE tab (timeline has its own export) */}
          <div className={`flex items-center gap-2 ${currentTab === "CHAT" ? "hidden" : isFullscreen ? (currentTab === "TIMELINE" ? "hidden" : "") : ""}`}>
            {onToggleSave && (
              <button
                type="button"
                onClick={onToggleSave}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-xs font-semibold tracking-wide transition-all ${
                  isSaved
                    ? "border-primary-green/40 bg-primary-green/5 text-primary-green"
                    : "border-neutral-200 bg-white text-neutral-500 hover:border-primary-green/30 hover:text-primary-green"
                }`}
                title={isSaved ? "Remove from saved" : "Save this solution"}
              >
                <Bookmark size={14} className={isSaved ? "fill-current" : ""} />
                {isSaved ? "Saved" : "Save"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void exportFullReport()}
              disabled={!canExportFullReport || isExportingReport}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-2.5 px-4 text-xs font-semibold tracking-wide text-neutral-500 transition-all hover:border-neutral-300 hover:text-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                canExportFullReport
                  ? "Export technical info and timeline as PDF"
                  : "Generate a timeline in the Timeline tab to export the full report"
              }
            >
              <Download size={14} />
              {isExportingReport ? "Exporting…" : "Export"}
            </button>
          </div>

          <div className="flex items-center p-1 bg-neutral-100/50 rounded-2xl">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setCurrentTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                  currentTab === id
                    ? "bg-white text-primary-green shadow-sm ring-1 ring-black/[0.05]"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                <Icon
                  size={14}
                  className={currentTab === id ? "text-primary-green" : ""}
                />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          {currentTab === "INFO" ? (
            <InfoTab
              recommendation={recommendation}
              selectedFeature={selectedFeature}
              selectedBarangayData={selectedBarangayData}
              isFullscreen={isFullscreen}
            />
          ) : null}

          {currentTab === "CHAT" ? (
            <ChatTab
              recommendation={recommendation}
              selectedFeature={selectedFeature}
              messages={chatHistory}
              onMessagesChange={setChatHistory}
              inputValue={chatInput}
              onInputChange={setChatInput}
              isLoading={isChatLoading}
              onLoadingChange={setIsChatLoading}
              onHistoryChange={
                controlledChatMessages === undefined ? setChatHistory : undefined
              }
              selectedBarangayData={selectedBarangayData}
              isFullscreen={isFullscreen}
            />
          ) : null}

          {currentTab === "TIMELINE" ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              <TimelineTab
                selectedRecommendation={recommendation}
                selectedFeature={selectedFeature}
                chatHistory={chatHistory}
                viewMode={timelineViewMode}
                onViewModeChange={onTimelineViewModeChange}
                isFullscreen={isFullscreen}
                onTimelineReadyChange={setIsTimelineReady}
                onExportContextChange={setTimelineExportContext}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Only render the export document during actual export to keep the
          DOM tree identical before and after timeline generation. This
          prevents Chrome flex layout reflow from the hidden div appearing. */}
      {isExportingReport && timelineExportContext ? (
        <div
          className="pointer-events-none absolute top-0 left-0 -z-10 w-[720px] opacity-0"
          aria-hidden
        >
          <GreenSolutionExportDocument
            ref={exportDocumentRef}
            recommendation={recommendation}
            selectedFeature={selectedFeature}
            selectedBarangayData={selectedBarangayData}
            timelinePlan={timelineExportContext.plan}
            timelineRisks={timelineExportContext.risks}
            costEstimate={exportCostEstimate}
          />
        </div>
      ) : null}
    </div>
  );
}
