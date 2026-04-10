"use client";

import { Leaf, Sprout, TreeDeciduous, Thermometer } from "lucide-react";
import { useBarangay, type BarangayData } from "@/context/BarangayContext";
import { getGreeneryClassColor } from "@/lib/chloroplet-colors";
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
      <div className="w-full rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-center">
        <p className="text-sm font-semibold text-neutral-500">
          Location metrics are unavailable for this selection.
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          The selected location could not be matched to the metrics dataset.
        </p>
      </div>
    );
  }

  const classColor = getGreeneryClassColor(activeBarangay.greeneryIndex || 0);
  const [textColor, bgColor] = classColor.split(" ");

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
