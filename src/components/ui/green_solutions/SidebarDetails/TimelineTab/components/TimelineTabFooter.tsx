"use client";

import {
  ChartNoAxesGantt,
  Check,
  Download,
  FileClock,
  PencilLine,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimelineTabFooterProps {
  isExporting: boolean;
  hasTimelineDraft: boolean;
  isEditMode: boolean;
  timelineRecord: { currentVersion: { versionNumber: number }; id?: string } | null;
  canRegenerate: boolean;
  isDirty: boolean;
  isTimelineSaving: boolean;
  isTimelineLoading: boolean;
  isAgentBusy: boolean;
  isFullscreen: boolean;
  onExport: () => void;
  onToggleEdit: () => void;
  onReset: () => void;
  onPrimaryAction: () => void;
}

export default function TimelineTabFooter({
  isExporting,
  hasTimelineDraft,
  isEditMode,
  timelineRecord,
  canRegenerate,
  isDirty,
  isTimelineSaving,
  isTimelineLoading,
  isAgentBusy,
  isFullscreen,
  onExport,
  onToggleEdit,
  onReset,
  onPrimaryAction,
}: TimelineTabFooterProps) {
  return (
    <div className={`shrink-0 border-t border-neutral-100 bg-white ${
      isFullscreen ? "px-4 sm:px-6 py-1 sm:py-1.5" : "px-3 py-1.5 sm:px-4 sm:py-2"
    }`}>
      <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:px-0">
        <div className="flex min-w-max items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
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
              onClick={onToggleEdit}
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
              onClick={onReset}
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
              onClick={onPrimaryAction}
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
  );
}
