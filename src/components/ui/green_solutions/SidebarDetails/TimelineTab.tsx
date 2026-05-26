"use client";

import type { Dispatch, SetStateAction } from "react";
import type {
  ChatHistoryMessage,
  TimelineViewMode,
} from "@/types/green_solutions";
import type { UIRecommendation } from "@/lib/recommendations";
import type { SelectedFeature } from "@/types/metrics";
import type { TimelinePlan } from "./TimelineTab/types";
import { useTimelineTab } from "./TimelineTab/hooks/useTimelineTab";
import { type ViewMode } from "./TimelineTab/lib/timeline-tab-utils";
import TimelineTabHeader from "./TimelineTab/components/TimelineTabHeader";
import TimelineTabViewport from "./TimelineTab/components/TimelineTabViewport";
import TimelineTabFooter from "./TimelineTab/components/TimelineTabFooter";
import TimelineTabLoadingOverlay from "./TimelineTab/components/TimelineTabLoadingOverlay";
import PhaseDetailModal from "./TimelineTab/PhaseDetailModal";

interface TimelineTabProps {
  selectedRecommendation: UIRecommendation;
  selectedFeature?: SelectedFeature;
  chatHistory?: ChatHistoryMessage[];
  viewMode?: ViewMode;
  onViewModeChange?: Dispatch<SetStateAction<TimelineViewMode>>;
  isFullscreen?: boolean;
  onTimelineReadyChange?: (ready: boolean) => void;
  onExportContextChange?: (context: {
    plan: TimelinePlan;
    risks: string[];
  } | null) => void;
}

export default function TimelineTab({
  selectedRecommendation,
  selectedFeature,
  chatHistory = [],
  viewMode: controlledViewMode,
  onViewModeChange,
  isFullscreen = false,
  onTimelineReadyChange,
  onExportContextChange,
}: TimelineTabProps) {
  const h = useTimelineTab(
    selectedRecommendation,
    selectedFeature,
    chatHistory,
    controlledViewMode,
    onViewModeChange as ((mode: ViewMode) => void) | undefined,
    onTimelineReadyChange,
    onExportContextChange,
    isFullscreen,
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TimelineTabHeader
        hasTimelineDraft={h.hasTimelineDraft}
        isTimelineLoading={h.isTimelineLoading}
        isRestoringDraft={h.isRestoringDraft}
        timelineRecord={h.timelineRecord}
        viewMode={h.viewMode}
        isFullscreen={isFullscreen}
        durationDays={h.durationDays}
        phaseCount={h.draftPlan.phases.length}
        isViewMenuOpen={h.isViewMenuOpen}
        opensUpward={h.opensUpward}
        onViewModeChange={h.setViewMode}
        onToggleViewMenu={() => h.setIsViewMenuOpen((v) => !v)}
        viewMenuRef={h.viewMenuRef}
      />

      <TimelineTabViewport
        showEmptyState={h.showEmptyState}
        isAgentBusy={h.isAgentBusy}
        isTimelineLoading={h.isTimelineLoading}
        viewMode={h.viewMode}
        draftPlan={h.draftPlan}
        onGenerateTimeline={h.generateAgentTimeline}
        onOpenPhase={h.handleOpenPhase}
        showRevisionBadge={h.showRevisionBadge}
        viewRef={h.viewRef}
        isFullscreen={isFullscreen}
      />

      <TimelineTabFooter
        isExporting={h.isExporting}
        hasTimelineDraft={h.hasTimelineDraft}
        isEditMode={h.isEditMode}
        timelineRecord={h.timelineRecord}
        canRegenerate={h.canRegenerate}
        isDirty={h.isDirty}
        isTimelineSaving={h.isTimelineSaving}
        isTimelineLoading={h.isTimelineLoading}
        isAgentBusy={h.isAgentBusy}
        isFullscreen={isFullscreen}
        onExport={h.exportCurrentView}
        onToggleEdit={() => h.setIsEditMode((v) => !v)}
        onReset={h.handleResetAction}
        onPrimaryAction={h.handlePrimaryTimelineAction}
      />

      <PhaseDetailModal
        phase={h.selectedPhase}
        selectedTaskId={h.selectedTaskId}
        editable={h.isEditMode}
        onSavePhase={h.handleSavePhase}
        onClose={h.handleClosePhaseModal}
      />

      <TimelineTabLoadingOverlay show={h.showTimelineLoadingOverlay} />
    </div>
  );
}
