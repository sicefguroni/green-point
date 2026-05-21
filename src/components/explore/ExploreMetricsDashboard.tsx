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
  const props = feature?.properties;

  // Pin mode falls back to barangay-level metrics so the grid shows data
  // immediately even before the point-specific /api/data?resource=point
  // call completes on first load.
  const ndvi =
    (isPinMode
      ? (props?.ndvi ?? activeBarangayData?.ndvi)
      : activeBarangayData?.ndvi) ?? null;

  const lst =
    (isPinMode
      ? (props?.temperature ?? activeBarangayData?.lst)
      : activeBarangayData?.lst) ?? null;

  const treeCanopy =
    (isPinMode
      ? (props?.treeCanopy ?? activeBarangayData?.treeCanopy)
      : activeBarangayData?.treeCanopy) ?? null;

  const greeneryIndex =
    (isPinMode
      ? (props?.greeneryIndex ?? activeBarangayData?.greeneryIndex)
      : activeBarangayData?.greeneryIndex) ?? null;

  const customAreaHectares = feature?.customSelectionAreaHectares ?? null;
  const hasLocationMetrics =
    greeneryIndex !== null ||
    ndvi !== null ||
    lst !== null ||
    treeCanopy !== null;

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
