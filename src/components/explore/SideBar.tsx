"use client";

import React, { type Dispatch, type SetStateAction } from "react";
import { MapPin, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { SelectedFeature } from "@/types/metrics";
import type { BarangayData } from "@/context/BarangayContext";
import type {
  SidebarView,
  DetailTab,
  ChatHistoryMessage,
  TimelineViewMode,
  SavePayload,
} from "@/types/green_solutions";
import { type UIRecommendation } from "@/lib/recommendations";
import { type LocationSelectionMode } from "@/types/maplayers";
import { type SavedSolutionRow } from "@/hooks/useSavedSolutions";
import type { VisionContext } from "@/lib/vision/context";

import SidebarDetail from "@/components/ui/green_solutions/SidebarDetails";
import ExploreMetricsDashboard from "@/components/explore/ExploreMetricsDashboard";
import ExploreDesktopListInterventions from "@/components/explore/ExploreDesktopListInterventions";

export interface SideBarProps {
  core: {
    isOpen: boolean;
    activeView: SidebarView;
    selectedFeature: SelectedFeature | null;
    clearSelection: () => void;
    activeBarangayData: BarangayData | null;
    locationSelectionMode: LocationSelectionMode;
  };
  detail: {
    isFullscreen: boolean;
    setIsFullscreen: Dispatch<SetStateAction<boolean>>;
    recommendation: UIRecommendation | null;
    handleBack: () => void;
    currentTab: DetailTab;
    setTab: Dispatch<SetStateAction<DetailTab>>;
    chatMessages: ChatHistoryMessage[];
    setChatMessages: Dispatch<SetStateAction<ChatHistoryMessage[]>>;
    chatInput: string;
    setChatInput: Dispatch<SetStateAction<string>>;
    isChatLoading: boolean;
    setIsChatLoading: Dispatch<SetStateAction<boolean>>;
    timelineView: TimelineViewMode;
    setTimelineView: Dispatch<SetStateAction<TimelineViewMode>>;
  };
  vision: {
    context: VisionContext | null;
    tags: string[];
    isAnalyzing: boolean;
    imageUrl: string | null;
    hasUsableContext: boolean;
    statusMessage: string | null;
  };
  generation: {
    ragRecommendations: UIRecommendation[] | null;
    error: string | null;
    isGenerating: boolean;
    step: string | null;
    handleGenerate: () => void;
    handleRegenerate: () => void;
    handleClearRecommendations: () => void | Promise<void>;
    openRecommendationDetail: (rec: UIRecommendation) => void;
  };
  saving: {
    saves: SavedSolutionRow[];
    savedLocationPayload: Omit<
      SavePayload,
      "solutionSnapshot" | "contextSnapshot"
    > | null;
    handleToggleSave: (e: React.MouseEvent, rec: UIRecommendation) => void;
    matchingSavedSolutions: SavedSolutionRow[];
  };
  mobile: {
    bottomExpanded: boolean;
    setBottomExpanded: (expanded: boolean) => void;
  };
}

export default function SideBar({
  core,
  detail,
  vision,
  generation,
  saving,
  mobile,
}: SideBarProps) {
  const {
    isOpen: isSidebarOpen,
    activeView,
    selectedFeature,
    clearSelection,
    activeBarangayData,
    locationSelectionMode,
  } = core;
  const {
    isFullscreen: isDetailFullscreen,
    setIsFullscreen: setIsDetailFullscreen,
    recommendation: selectedRecommendation,
    handleBack: handleDetailBack,
    currentTab: detailCurrentTab,
    setTab: setDetailCurrentTab,
    chatMessages: detailChatMessages,
    setChatMessages: setDetailChatMessages,
    chatInput: detailChatInput,
    setChatInput: setDetailChatInput,
    isChatLoading: isDetailChatLoading,
    setIsChatLoading: setIsDetailChatLoading,
    timelineView: detailTimelineView,
    setTimelineView: setDetailTimelineView,
  } = detail;
  const {
    context: visionContext,
    tags: visionTags,
    isAnalyzing: isVisionAnalyzing,
    imageUrl,
    hasUsableContext: hasUsableVisionContext,
    statusMessage: visionStatusMessage,
  } = vision;
  const {
    ragRecommendations,
    error: generateError,
    isGenerating,
    step: generatingStep,
    handleGenerate,
    handleRegenerate,
    handleClearRecommendations,
    openRecommendationDetail,
  } = generation;
  const {
    saves,
    savedLocationPayload,
    handleToggleSave,
    matchingSavedSolutions,
  } = saving;
  const { bottomExpanded } = mobile;
  // Determine if the current recommendation is saved
  const isSaved = (rec: UIRecommendation) =>
    saves.some(
      (s) =>
        String(s.solutionSnapshot.solutionTitle) === rec.solutionTitle &&
        s.locationType === savedLocationPayload?.locationType &&
        (s.locationId === savedLocationPayload?.locationId ||
          s.locationName === savedLocationPayload?.locationName),
    );

  const portalContent =
    isDetailFullscreen && selectedRecommendation && selectedFeature ? (
      <div
        className="hidden lg:flex fixed inset-0 z-[120] bg-neutral-900/45 backdrop-blur-sm p-6"
        onClick={() => setIsDetailFullscreen(false)}
      >
        <div
          className="mx-auto flex h-full w-full max-w-[1440px] overflow-hidden rounded-[2rem] border border-white/50 bg-white/95 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950/95 dark:shadow-black/40"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex w-full h-full flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-100 bg-white/70 p-6 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/60">
              <div className="flex items-center gap-4 min-w-0">
                <div className="shrink-0 rounded-2xl bg-primary-green/10 p-3.5 text-primary-green shadow-inner dark:bg-primary-green/20 dark:text-primary-green/80">
                  <MapPin size={28} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-lg font-bold leading-tight text-neutral-900 dark:text-neutral-50">
                    {selectedFeature.name || "Target Area"}
                  </h4>
                  <p className="mt-0.5 text-xs font-bold text-neutral-500 opacity-70 dark:text-neutral-400">
                    {selectedFeature.address || "Analyzing location..."}
                  </p>
                </div>
              </div>

              <button
                onClick={clearSelection}
                className="rounded-full p-2.5 text-neutral-400 transition-all hover:rotate-90 hover:bg-neutral-100 hover:text-red-500 dark:text-neutral-500 dark:hover:bg-neutral-800"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              <SidebarDetail
                recommendation={selectedRecommendation}
                selectedFeature={selectedFeature}
                selectedBarangayData={activeBarangayData ?? null}
                onBack={handleDetailBack}
                currentTab={detailCurrentTab}
                onCurrentTabChange={setDetailCurrentTab}
                chatMessages={detailChatMessages}
                onChatMessagesChange={setDetailChatMessages}
                chatInput={detailChatInput}
                onChatInputChange={setDetailChatInput}
                isChatLoading={isDetailChatLoading}
                onChatLoadingChange={setIsDetailChatLoading}
                timelineViewMode={detailTimelineView}
                onTimelineViewModeChange={setDetailTimelineView}
                isFullscreen
                onToggleFullscreen={() => setIsDetailFullscreen(false)}
                isSaved={isSaved(selectedRecommendation)}
                onToggleSave={
                  savedLocationPayload
                    ? (e) => handleToggleSave(e, selectedRecommendation)
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-500 ease-out 
          lg:absolute lg:top-8 lg:bottom-8 lg:left-24 lg:z-20 lg:w-[min(28rem,calc(100vw-5.5rem))] lg:flex lg:flex-col
          ${
            bottomExpanded
              ? "translate-y-0"
              : "translate-y-full lg:translate-y-0"
          }
          ${
            isSidebarOpen && !(isDetailFullscreen && activeView === "DETAIL")
              ? "lg:translate-x-0 lg:opacity-100"
              : "lg:-translate-x-full lg:opacity-0 lg:pointer-events-none"
          }
        `}
      >
        <div className="flex h-[85vh] lg:h-full w-full flex-col overflow-hidden rounded-t-[2.5rem] lg:rounded-[2rem] border-t lg:border border-white/50 bg-white/95 lg:bg-white/90 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] lg:shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-2xl lg:backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/95 dark:shadow-black/50">
          <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-800 lg:hidden" />

          <div className="shrink-0 flex items-center justify-between border-b border-neutral-100 px-4 py-3 lg:px-6 lg:py-4 dark:border-neutral-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 rounded-xl bg-primary-green/10 p-2.5 text-primary-green dark:bg-primary-green/20 dark:text-primary-green/80">
                <MapPin size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="truncate font-bold text-neutral-900 dark:text-neutral-50">
                  {selectedFeature
                    ? selectedFeature.name
                    : "No Location Selected"}
                </h4>
                {selectedFeature && (
                  <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {selectedFeature.address}
                  </p>
                )}
              </div>
            </div>
            {selectedFeature && (
              <button
                onClick={clearSelection}
                className="shrink-0 rounded-full p-2 text-neutral-400 transition-all hover:rotate-90 hover:bg-neutral-100 hover:text-red-500 dark:text-neutral-500 dark:hover:bg-neutral-800"
              >
                <X size={20} />
              </button>
            )}
          </div>

          <div
            className={`scrollbar-hide flex-1 p-4 lg:p-6 lg:pt-0 ${
              activeView === "DETAIL"
                ? "flex flex-col min-h-0 overflow-hidden"
                : "overflow-y-auto"
            }`}
          >
            {activeView === "DETAIL" &&
            selectedRecommendation &&
            selectedFeature ? (
              isDetailFullscreen ? null : (
                <SidebarDetail
                  recommendation={selectedRecommendation}
                  selectedFeature={selectedFeature}
                  selectedBarangayData={activeBarangayData ?? null}
                  onBack={handleDetailBack}
                  currentTab={detailCurrentTab}
                  onCurrentTabChange={setDetailCurrentTab}
                  chatMessages={detailChatMessages}
                  onChatMessagesChange={setDetailChatMessages}
                  chatInput={detailChatInput}
                  onChatInputChange={setDetailChatInput}
                  isChatLoading={isDetailChatLoading}
                  onChatLoadingChange={setIsDetailChatLoading}
                  timelineViewMode={detailTimelineView}
                  onTimelineViewModeChange={setDetailTimelineView}
                  isSaved={isSaved(selectedRecommendation)}
                  onToggleSave={
                    savedLocationPayload
                      ? (e) => handleToggleSave(e, selectedRecommendation)
                      : undefined
                  }
                  isFullscreen={false}
                  onToggleFullscreen={() => setIsDetailFullscreen(true)}
                />
              )
            ) : (
              <div className="flex w-full flex-col space-y-5">
                <ExploreMetricsDashboard
                  feature={selectedFeature}
                  selectionMode={locationSelectionMode}
                  activeBarangayData={activeBarangayData}
                />

                <ExploreDesktopListInterventions
                  visionContext={visionContext}
                  visionTags={visionTags}
                  isVisionAnalyzing={isVisionAnalyzing}
                  imageUrl={imageUrl}
                  selectedFeature={selectedFeature}
                  clearSelection={clearSelection}
                  hasUsableVisionContext={hasUsableVisionContext}
                  visionStatusMessage={visionStatusMessage}
                  ragRecommendations={ragRecommendations}
                  generateError={generateError}
                  isGenerating={isGenerating}
                  generatingStep={generatingStep}
                  handleGenerate={handleGenerate}
                  handleRegenerate={handleRegenerate}
                  handleClearRecommendations={handleClearRecommendations}
                  openRecommendationDetail={openRecommendationDetail}
                  savedLocationPayload={savedLocationPayload}
                  savedSolutions={matchingSavedSolutions}
                  handleToggleSave={handleToggleSave}
                  saves={saves}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {typeof document !== "undefined" && portalContent
        ? createPortal(portalContent, document.body)
        : null}
    </>
  );
}
