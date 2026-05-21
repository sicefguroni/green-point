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
}: TimelineTabViewportProps) {
  if (showEmptyState) {
    return (
      <div className="sm:px-2 lg:px-6 flex-1 min-h-0 overflow-y-auto py-2 scrollbar-hide">
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
    <div className="sm:px-2 lg:px-6 flex-1 min-h-0 overflow-y-auto py-2 scrollbar-hide">
      <div
        ref={viewRef}
        data-export-root="timeline"
        className="rounded-2xl bg-white p-4"
      >
        {viewMode === "DEFAULT" && (
          <RoadmapView
            plan={draftPlan}
            onOpenPhase={onOpenPhase}
            showRevisionBadge={showRevisionBadge}
          />
        )}
        {viewMode === "GANTT" && (
          <GanttView plan={draftPlan} onOpenPhase={onOpenPhase} />
        )}
        {viewMode === "PDF" && <PdfPreviewView plan={draftPlan} />}
      </div>
    </div>
  );
}
