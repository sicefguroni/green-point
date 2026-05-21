"use client";

import { Sprout } from "lucide-react";

interface TimelineTabLoadingOverlayProps {
  show: boolean;
}

export default function TimelineTabLoadingOverlay({
  show,
}: TimelineTabLoadingOverlayProps) {
  if (!show) return null;

  return (
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
  );
}
