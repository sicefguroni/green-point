"use client";

import * as React from "react";
import dynamic from "next/dynamic";
// @ts-ignore - lucide-react has built-in types
import {
  Leaf,
  Sprout,
  Thermometer,
  TreeDeciduous,
  ChevronsDown,
  ChevronsUp,
  Info,
} from "lucide-react";

import { useBarangay } from "@/context/BarangayContext";
import { getGreeneryClassColor } from "@/lib/chloroplet-colors";
import BarangayRadarChart from "@/components/charts/BarangayRadarChart";
import NDVILSTChart from "@/components/charts/NDVILSTChart";
import TreeCanopyTrend from "@/components/charts/TreeCanopyTrend";
import PovertyComparison from "@/components/charts/PovertyComparison";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "../button";
import BarangayGreenery from "./BarangayGreenerayDetails";
const ChoroplethMap = dynamic(() => import("./ChloropletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center bg-neutral-50 text-sm text-neutral-500 md:h-auto">
      Loading map…
    </div>
  ),
});

const StableChoroplethMap = React.memo(function StableChoroplethMap() {
  return <ChoroplethMap />;
});

export default function CityGreeneryMap() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { selectedBarangay } = useBarangay();

  const greeneryClassColor = getGreeneryClassColor(
    selectedBarangay?.greeneryIndex ?? 0,
  );
  const [textColor, bgColor] = greeneryClassColor.split(" ");

  const effectiveTextColor =
    textColor === "text-green-600"
      ? "#16a34a"
      : textColor === "text-lime-600"
        ? "#65a30d"
        : textColor === "text-yellow-600"
          ? "#ca8a04"
          : textColor === "text-red-600"
            ? "#dc2626"
            : "#4b5563";

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="flex flex-1 flex-col"
    >
      <div className="flex flex-1 flex-col gap-4">
        <h2 className="text-xl font-medium text-neutral-black dark:text-neutral-50">
          Citywide Greenery Map
        </h2>
        <div className="flex w-full flex-1 flex-col overflow-hidden rounded-lg border bg-white dark:bg-neutral-900 dark:border-neutral-800 shadow-sm shadow-black/5 dark:shadow-black/20 md:flex-row">
          <div className="h-72 w-full overflow-hidden border-b border-neutral-200 dark:border-neutral-800 md:h-auto md:w-2/3 md:border-b-0 md:border-r">
            <StableChoroplethMap />
          </div>
          <aside className="flex w-full flex-1 flex-col items-center gap-4 bg-white dark:bg-neutral-900 p-4 px-6 md:w-1/3">
            <div className="flex w-full items-center gap-2">
              <Info size={24} className="text-neutral-black/50 dark:text-neutral-400" aria-hidden />
              <h3 className="font-poppins text-md font-medium text-neutral-black/70 dark:text-neutral-300">
                Barangay Environmental Metrics
              </h3>
            </div>
            <h4
              className={`w-fit rounded-sm py-1 px-4 text-xl font-bold ${bgColor ?? ""} ${textColor ?? ""}`}
            >
              {selectedBarangay?.name ?? "Select a Barangay"}
            </h4>
            <hr className="w-full border-neutral-grey dark:border-neutral-700" />
            <div className="flex w-full flex-1 flex-col justify-evenly gap-2">
              <BarangayGreenery
                icon={Leaf}
                valueName="Greenery Index"
                value={selectedBarangay?.greeneryIndex ?? 0}
              />
              <BarangayGreenery
                icon={Sprout}
                valueName="Normalized Difference Vegetation Index"
                value={selectedBarangay?.ndvi ?? 0}
              />
              <BarangayGreenery
                icon={TreeDeciduous}
                valueName="Tree Canopy Cover"
                value={selectedBarangay?.treeCanopy ?? 0}
              />
              <BarangayGreenery
                icon={Thermometer}
                valueName="Land Surface Temperature"
                value={selectedBarangay?.lst ?? 0}
                LST
              />
            </div>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-md border bg-white dark:bg-neutral-950 dark:border-neutral-700 py-2 text-md font-medium text-neutral-700 dark:text-neutral-200 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800"
                style={{
                  borderColor: effectiveTextColor,
                  color: effectiveTextColor,
                }}
                disabled={!selectedBarangay}
              >
                {isOpen ? "View Less Details" : "View More Details"}
                {isOpen ? <ChevronsUp size={20} /> : <ChevronsDown size={20} />}
              </Button>
            </CollapsibleTrigger>
          </aside>
        </div>
        <CollapsibleContent className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Barangay Radar Chart */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
                {selectedBarangay?.name} vs City Average
              </h3>
              <div className="h-64">
                <BarangayRadarChart
                  data={[
                    { metric: "Greenery Index", barangay: selectedBarangay?.greeneryIndex ?? 0, city: 0.72 },
                    { metric: "NDVI", barangay: selectedBarangay?.ndvi ?? 0, city: 0.7 },
                    { metric: "Canopy %", barangay: selectedBarangay?.treeCanopy ?? 0, city: 0.74 },
                    { metric: "Poverty % (Inverted)", barangay: 0.45, city: 0.55 },
                    { metric: "Area Size", barangay: 0.68, city: 0.7 },
                  ]}
                />
              </div>
            </div>

            {/* NDVI & LST Trends */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
                NDVI & LST Trend
              </h3>
              <div className="h-64">
                <NDVILSTChart
                  data={[
                    { month: "Jan", NDVI: selectedBarangay?.ndvi || 0, LST: selectedBarangay?.lst || 0 },
                    { month: "Feb", NDVI: 0.8, LST: 35 },
                  ]}
                />
              </div>
            </div>

            {/* Tree Canopy Trend */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
                Tree Canopy
              </h3>
              <div className="h-64">
                <TreeCanopyTrend
                  data={[
                    { year: "2020", canopy: Math.max(0, (selectedBarangay?.treeCanopy ?? 0) - 0.3) },
                    { year: "2021", canopy: Math.max(0, (selectedBarangay?.treeCanopy ?? 0) - 0.23) },
                    { year: "2022", canopy: Math.max(0, (selectedBarangay?.treeCanopy ?? 0) - 0.1) },
                    { year: "2023", canopy: Math.min(1, (selectedBarangay?.treeCanopy ?? 0) + 0.1) },
                    { year: "2024", canopy: Math.min(1, (selectedBarangay?.treeCanopy ?? 0) + 0.15) },
                  ]}
                  since="2020"
                  changePercent={5.3}
                />
              </div>
            </div>

            {/* Poverty Comparison */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
                Poverty Rate Comparison
              </h3>
              <div className="h-64">
                <PovertyComparison
                  data={[
                    { label: selectedBarangay?.name ?? "Selected Barangay", value: 42 },
                    { label: "City Avg", value: 32 },
                  ]}
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
