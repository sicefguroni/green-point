"use client";

import { Leaf, Sprout, TreeDeciduous, Thermometer } from "lucide-react";
import { useBarangay, type BarangayData } from "@/context/BarangayContext";
import BarangayMetricItem from "@/app/(app)/explore/barangaydetails";

/**
 * Displays a 4-column grid of metric cards for the currently selected barangay.
 * Must be rendered inside a <BarangayProvider>.
 */
export default function MetricsDashboard({
  barangayData,
}: {
  barangayData?: BarangayData | null;
}) {
  const { selectedBarangay } = useBarangay();
  const activeBarangay = barangayData ?? selectedBarangay;
  if (!activeBarangay) {
    return (
      <div className="w-full rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-center dark:border-neutral-800 dark:bg-neutral-950/40">
        <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-300">
          Location metrics are unavailable for this selection.
        </p>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          The selected location could not be matched to the metrics dataset.
        </p>
      </div>
    );
  }

  const { textColor, bgColor } = getGreeneryBadgeClasses(
    activeBarangay.greeneryIndex || 0,
  );

  return (
    <div className="flex flex-col items-center gap-4 w-full animate-in fade-in slide-in-from-top-4 duration-500">
      <h3
        className={`w-full ${bgColor} ${textColor} text-sm font-bold rounded-lg py-2 px-4 text-center uppercase tracking-wide`}
      >
        {activeBarangay.name
          ? `Barangay ${activeBarangay.name} Metrics`
          : "Regional Metrics"}
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
        <BarangayMetricItem
          icon={Leaf}
          label="Greenery Index"
          value={activeBarangay.greeneryIndex ?? 0}
          metricType="gi"
        />
        <BarangayMetricItem
          icon={Sprout}
          label="NDVI"
          value={activeBarangay.ndvi ?? 0}
          metricType="ndvi"
        />
        <BarangayMetricItem
          icon={TreeDeciduous}
          label="Tree Canopy"
          value={activeBarangay.treeCanopy ?? 0}
          metricType="canopy"
        />
        <BarangayMetricItem
          icon={Thermometer}
          label="Surface Temp"
          value={activeBarangay.lst ?? 0}
          metricType="lst"
        />
      </div>
    </div>
  );
}

function getGreeneryBadgeClasses(value: number) {
  if (value >= 0.7) {
    return {
      textColor: "text-green-700 dark:text-green-300",
      bgColor: "bg-green-100 dark:bg-green-500/15",
    };
  }

  if (value >= 0.5) {
    return {
      textColor: "text-lime-700 dark:text-lime-300",
      bgColor: "bg-lime-100 dark:bg-lime-500/15",
    };
  }

  if (value >= 0.3) {
    return {
      textColor: "text-yellow-700 dark:text-yellow-300",
      bgColor: "bg-yellow-100 dark:bg-yellow-500/15",
    };
  }

  if (value >= 0.01) {
    return {
      textColor: "text-red-700 dark:text-red-300",
      bgColor: "bg-red-100 dark:bg-red-500/15",
    };
  }

  return {
    textColor: "text-gray-700 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-gray-700/40",
  };
}
