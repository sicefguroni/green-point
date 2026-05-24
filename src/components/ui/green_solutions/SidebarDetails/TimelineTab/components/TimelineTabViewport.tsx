"use client";

import { Button } from "@/components/ui/button";
import RoadmapView from "../views/RoadmapView";
import GanttView from "../views/GanttView";
import PdfPreviewView from "../views/PdfPreviewView";
import type { TimelinePlan } from "../types";
import type { ViewMode } from "../lib/timeline-tab-utils";

interface TimelineTabViewportProps {
  showEmptyState: boolean;
  isAgentBusy: boolean;
  isTimelineLoading: boolean;
  viewMode: ViewMode;
  draftPlan: TimelinePlan;
  onGenerateTimeline: () => void;
  onOpenPhase: (phaseId: string, taskId?: string) => void;
  showRevisionBadge: boolean;
  viewRef: React.RefObject<HTMLDivElement | null>;
  isFullscreen?: boolean;
}

export default function TimelineTabViewport({
  showEmptyState,
  isAgentBusy,
  isTimelineLoading,
  viewMode,
  draftPlan,
  onGenerateTimeline,
  onOpenPhase,
  showRevisionBadge,
  viewRef,
  isFullscreen = false,
}: TimelineTabViewportProps) {
  const containerPadding = isFullscreen ? "sm:px-6 lg:px-8" : "sm:px-4 lg:px-6";
  const cardPadding = isFullscreen ? "p-4 sm:p-6" : "p-3 sm:p-4";
  const innerPadding = isFullscreen ? "py-2" : "py-1.5";

  if (showEmptyState) {
    return (
      <div className={`${containerPadding} flex-1 min-h-0 overflow-y-auto ${innerPadding} scrollbar-hide`}>
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
              onClick={onGenerateTimeline}
              disabled={isAgentBusy || isTimelineLoading}
              className="rounded-full px-4"
            >
              {isAgentBusy ? "Creating..." : "Create Timeline"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
      <div className={`${containerPadding} flex-1 min-h-0 overflow-y-auto ${innerPadding} scrollbar-hide`}>
        <div
          ref={viewRef}
          data-export-root="timeline"
          className={`rounded-2xl bg-white ${cardPadding}`}
        >
        {viewMode === "DEFAULT" && (
          <RoadmapView
            plan={draftPlan}
            onOpenPhase={onOpenPhase}
            showRevisionBadge={showRevisionBadge}
            isFullscreen={isFullscreen}
          />
        )}
        {viewMode === "GANTT" && (
          <GanttView plan={draftPlan} onOpenPhase={onOpenPhase} isFullscreen={isFullscreen} />
        )}
        {viewMode === "PDF" && <PdfPreviewView plan={draftPlan} isFullscreen={isFullscreen} />}
      </div>
    </div>
  );
}
