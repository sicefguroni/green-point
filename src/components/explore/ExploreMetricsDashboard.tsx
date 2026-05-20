"use client";

import type { SelectedFeature } from "@/types/metrics";
import type { LocationSelectionMode } from "@/types/maplayers";
import type { BarangayData } from "@/context/BarangayContext";
import BarangayMetricsGrid from "@/components/ui/general/metrics/BarangayMetricsGrid";

export default function ExploreMetricsDashboard({
  feature,
  selectionMode,
  activeBarangayData,
}: {
  feature: SelectedFeature | null;
  selectionMode: LocationSelectionMode;
  activeBarangayData?: BarangayData | null;
}) {
  const isPinMode = selectionMode === "poi";
  const isCustomMode = selectionMode === "custom";
  const props = feature?.properties;

  const ndvi = (isPinMode ? props?.ndvi : activeBarangayData?.ndvi) ?? null;
  const lst =
    (isPinMode ? props?.temperature : activeBarangayData?.lst) ?? null;
  const treeCanopy =
    (isPinMode ? props?.treeCanopy : activeBarangayData?.treeCanopy) ?? null;
  const greeneryIndex =
    (isPinMode ? props?.greeneryIndex : activeBarangayData?.greeneryIndex) ??
    null;
  const customAreaHectares = feature?.customSelectionAreaHectares ?? null;
  const hasLocationMetrics =
    greeneryIndex !== null ||
    ndvi !== null ||
    lst !== null ||
    treeCanopy !== null;

  if (feature?.isLoadingMetrics && isPinMode) {
    return (
      <div className="flex w-full flex-col items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
        <h3 className="w-full rounded-xl bg-primary-green/10 px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-primary-green sm:text-xs dark:bg-primary-green/20 dark:text-primary-green/80">
          Loading Metrics...
        </h3>
        <div className="grid w-full grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[4.5rem] rounded-2xl bg-neutral-100 animate-pulse dark:bg-neutral-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!hasLocationMetrics && customAreaHectares === null) return null;

  return (
    <div
      className="flex w-full flex-col items-center gap-3 
    animate-in fade-in slide-in-from-top-2 duration-500"
    >
      {customAreaHectares !== null ? (
        <div
          className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 
        text-center dark:border-emerald-900/50 dark:bg-emerald-950/40"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
            Selected Area
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-100">
            {customAreaHectares.toFixed(2)} ha
          </p>
        </div>
      ) : null}

      <BarangayMetricsGrid
        greeneryIndex={greeneryIndex}
        ndvi={ndvi}
        treeCanopy={treeCanopy}
        lst={lst}
      />
    </div>
  );
}
