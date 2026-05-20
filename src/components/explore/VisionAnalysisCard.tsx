"use client";

import type { VisionContext } from "@/lib/vision/context";

export default function VisionAnalysisCard({
  visionContext,
  quickTags,
  isAnalyzing,
}: {
  visionContext: VisionContext | null;
  quickTags: string[];
  isAnalyzing: boolean;
}) {
  if (isAnalyzing) {
    return (
      <div className="w-full rounded-2xl border border-primary-green/20 bg-primary-green/5 p-4 dark:border-primary-green/30 dark:bg-primary-green/10">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-green/30 border-t-primary-green" />
          <p className="text-xs font-bold text-primary-green dark:text-primary-green/80">
            Analyzing uploaded image...
          </p>
        </div>
        <p className="mt-2 text-[11px] text-neutral-600 dark:text-neutral-300">
          Extracting visual context (space, density, roof/vertical potential,
          soil cues) for recommendation ranking.
        </p>
      </div>
    );
  }

  if (!visionContext) return null;

  const confidencePct = Math.round(visionContext.confidence * 100);
  const signalRows: Array<{ label: string; value: string }> = [
    { label: "Ground space", value: visionContext.groundOpenSpaceLevel },
    { label: "Building density", value: visionContext.buildingDensityLevel },
    { label: "Roof potential", value: visionContext.roofGreeningPotential },
    {
      label: "Vertical potential",
      value: visionContext.verticalGreeningPotential,
    },
    { label: "Soil visibility", value: visionContext.soilVisibility },
    { label: "Permeability hint", value: visionContext.permeabilityHint },
  ];

  return (
    <div className="w-full rounded-2xl border border-primary-green/20 bg-primary-green/5 p-4 dark:border-primary-green/30 dark:bg-primary-green/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-green dark:text-primary-green/80">
          Image Analysis
        </p>
        <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-primary-green dark:bg-neutral-900/70 dark:text-primary-green/80">
          Confidence {confidencePct}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {signalRows.map((signal) => (
          <div
            key={signal.label}
            className="rounded-xl border border-primary-green/15 bg-white/80 px-2.5 py-2 dark:border-primary-green/25 dark:bg-neutral-900/60"
          >
            <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
              {signal.label}
            </p>
            <p className="text-[11px] font-bold tracking-wide text-neutral-900 dark:text-neutral-100">
              {signal.value}
            </p>
          </div>
        ))}
      </div>

      {quickTags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quickTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-primary-green/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-green dark:border-primary-green/35 dark:text-primary-green/80"
            >
              {tag.replace(/[_-]/g, " ")}
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-300">
        {visionContext.rationale}
      </p>
    </div>
  );
}
