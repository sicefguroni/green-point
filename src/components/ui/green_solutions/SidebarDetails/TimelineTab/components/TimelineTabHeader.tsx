"use client";

import {
  Check,
  ChevronDown,
  LayoutPanelTop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  VIEW_OPTIONS,
  type ViewMode,
} from "../lib/timeline-tab-utils";

interface TimelineTabHeaderProps {
  hasTimelineDraft: boolean;
  isTimelineLoading: boolean;
  isRestoringDraft: boolean;
  timelineRecord: { currentVersion: { versionNumber: number } } | null;
  viewMode: ViewMode;
  isFullscreen: boolean;
  durationDays: number;
  phaseCount: number;
  isViewMenuOpen: boolean;
  opensUpward: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onToggleViewMenu: () => void;
  viewMenuRef: React.RefObject<HTMLDivElement | null>;
}

export default function TimelineTabHeader({
  hasTimelineDraft,
  isTimelineLoading,
  isRestoringDraft,
  timelineRecord,
  viewMode,
  isFullscreen,
  durationDays,
  phaseCount,
  isViewMenuOpen,
  opensUpward,
  onViewModeChange,
  onToggleViewMenu,
  viewMenuRef,
}: TimelineTabHeaderProps) {
  const showMetricsSkeleton = (isRestoringDraft || isTimelineLoading) && hasTimelineDraft && !timelineRecord;
  const activeViewOption =
    VIEW_OPTIONS.find((option) => option.id === viewMode) ?? VIEW_OPTIONS[0];

  return (
    <div className={`shrink-0 border-b border-neutral-100 ${
      isFullscreen ? "sm:px-6 lg:px-8 py-3 space-y-3" : "sm:px-4 lg:px-6 py-2 space-y-2"
    }`}>
      <div className="flex items-center justify-between gap-2">
        {hasTimelineDraft ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400">
            <div className="flex items-center gap-2">
              <LayoutPanelTop size={14} />
              View Strategy
            </div>
            <p className="bg-gray-200 py-0.5 px-2 rounded-md text-xs font-semibold text-neutral-900">
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
                      onClick={() => onViewModeChange(id)}
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
                    onClick={onToggleViewMenu}
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
                            onViewModeChange(id);
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
        <div className="-mx-2 px-2 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide lg:hidden">
          <div className="flex items-center gap-2 min-w-max">
            {VIEW_OPTIONS.map(({ id, label, Icon }) => (
              <Button
                key={id}
                variant="outline"
                size="sm"
                onClick={() => onViewModeChange(id)}
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
        <div className={`grid ${
          isFullscreen ? "grid-cols-4 gap-2" : "grid-cols-2 gap-1.5"
        }`}>
          <div className={`flex flex-col rounded-xl border border-neutral-200 bg-white ${
            isFullscreen ? "px-3 py-2 gap-0.5" : "px-2 py-1"
          }`}>
            <p className={`text-neutral-500 font-medium ${
              isFullscreen ? "text-[10px] uppercase tracking-wider" : "text-[11px]"
            }`}>Est. Duration</p>
            {showMetricsSkeleton ? (
              <div className={`animate-pulse rounded bg-neutral-200 ${
                isFullscreen ? "h-4 w-20" : "h-3 w-14"
              }`} />
            ) : (
              <p className={`font-bold text-neutral-800 ${
                isFullscreen ? "text-lg" : "text-xs"
              }`}>{durationDays} days</p>
            )}
          </div>
          <div className={`flex flex-col rounded-xl border border-neutral-200 bg-white ${
            isFullscreen ? "px-3.5 py-2.5 gap-0.5" : "px-2.5 py-1.5"
          }`}>
            <p className={`text-neutral-500 font-medium ${
              isFullscreen ? "text-[10px] uppercase tracking-wider" : "text-[11px]"
            }`}>Phases</p>
            {showMetricsSkeleton ? (
              <div className={`animate-pulse rounded bg-neutral-200 ${
                isFullscreen ? "h-4 w-10" : "h-3 w-8"
              }`} />
            ) : (
              <p className={`font-bold text-neutral-800 ${
                isFullscreen ? "text-lg" : "text-xs"
              }`}>{phaseCount}</p>
            )}
          </div>
          <div className={`flex flex-col rounded-xl border border-neutral-200 bg-white ${
            isFullscreen ? "px-3.5 py-2.5 gap-0.5" : "hidden"
          }`}>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Avg. Phase</p>
            {showMetricsSkeleton ? (
              <div className="h-4 w-16 animate-pulse rounded bg-neutral-200" />
            ) : (
              <p className="text-lg font-bold text-neutral-800">
                {Math.round(durationDays / Math.max(phaseCount, 1))}d
              </p>
            )}
          </div>
          <div className={`flex flex-col rounded-xl border border-neutral-200 bg-white ${
            isFullscreen ? "px-3.5 py-2.5 gap-0.5" : "hidden"
          }`}>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">View</p>
            <p className="text-lg font-bold text-neutral-800 capitalize">{viewMode.toLowerCase()}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
