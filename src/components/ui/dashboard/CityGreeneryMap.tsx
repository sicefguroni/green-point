"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ChevronsDown, ChevronsUp, Info } from "lucide-react";

import { useBarangay } from "@/context/BarangayContext";
import { useGeoData } from "@/context/geoDataStore";
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
import BarangayMetricsGrid from "@/components/ui/general/metrics/BarangayMetricsGrid";
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

interface HistoricalDataRecord {
  month: string;
  year: number;
  fullDate: string;
  NDVI: number;
  LST: number;
  canopy: number;
}

export default function CityGreeneryMap() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { selectedBarangay } = useBarangay();
  const [historicalData, setHistoricalData] = React.useState<
    HistoricalDataRecord[]
  >([]);
  const [timeRange, setTimeRange] = React.useState<"months" | "years">(
    "months",
  );

  React.useEffect(() => {
    if (selectedBarangay?.name) {
      fetch(
        `/api/barangays/${encodeURIComponent(selectedBarangay.name)}/history`,
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data?.monthly) {
            setHistoricalData(data.data.monthly);
          }
        })
        .catch((err) => console.error("Error fetching historical data:", err));
    }
  }, [selectedBarangay?.name]);

  const geoData = useGeoData((state) => state.geoData);

  const cityAverages = React.useMemo(() => {
    if (!geoData || !geoData.features.length) {
      return {
        greeneryIndex: 0.5,
        ndvi: 0.5,
        treeCanopy: 0.5,
        poverty: 0.5,
        area: 0.5,
      };
    }

    let sumGI = 0,
      sumNDVI = 0,
      sumCanopy = 0,
      count = 0;

    geoData.features.forEach((f: GeoJSON.Feature) => {
      const p = f.properties;
      if (p && typeof p.greenery_index === "number") {
        sumGI += p.greenery_index;
        sumNDVI += typeof p.ndvi === "number" ? p.ndvi : 0;
        sumCanopy += typeof p.tree_canopy === "number" ? p.tree_canopy : 0;
        count++;
      }
    });

    if (count === 0)
      return {
        greeneryIndex: 0.5,
        ndvi: 0.5,
        treeCanopy: 0.5,
        poverty: 0.5,
        area: 0.5,
      };

    return {
      greeneryIndex: sumGI / count,
      ndvi: sumNDVI / count,
      treeCanopy: sumCanopy / count,
      poverty: 0.4, // Fallback for now as poverty isn't in GeoJSON yet
      area: 0.5,
    };
  }, [geoData]);
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="flex flex-1 flex-col"
    >
      <div className="flex flex-1 flex-col gap-4">
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 font-poppins">
          Citywide Greenery Map
        </h2>
        <div className="flex w-full flex-1 flex-col overflow-hidden rounded-lg border bg-white dark:bg-neutral-900 dark:border-neutral-800 shadow-sm shadow-black/5 dark:shadow-black/20 md:flex-row">
          <div className="h-72 w-full overflow-hidden border-b border-neutral-200 dark:border-neutral-800 md:h-auto md:w-2/3 md:border-b-0 md:border-r">
            <StableChoroplethMap />
          </div>
          <aside className="flex w-full flex-1 flex-col items-center gap-4 bg-white dark:bg-neutral-900 p-4 px-6 md:w-1/3">
            <div className="flex w-full items-center gap-2">
              <Info
                size={16}
                className="text-neutral-400 dark:text-neutral-500"
                aria-hidden
              />
              <h3 className="font-poppins text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                Barangay Metrics
              </h3>
            </div>
            <h4 className="text-xl font-bold font-poppins text-neutral-800 dark:text-neutral-100 py-1">
              {selectedBarangay?.name ?? "Select a Barangay"}
            </h4>
            <BarangayMetricsGrid
              greeneryIndex={selectedBarangay?.greeneryIndex ?? 0}
              ndvi={selectedBarangay?.ndvi ?? 0}
              treeCanopy={selectedBarangay?.treeCanopy ?? 0}
              lst={selectedBarangay?.lst ?? 0}
              className="mt-2"
              columns={1}
            />
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-200 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
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
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
                {selectedBarangay?.name} vs City Average
              </h3>
              <div className="h-64">
                <BarangayRadarChart
                  data={[
                    {
                      metric: "Greenery Index",
                      barangay: selectedBarangay?.greeneryIndex ?? 0,
                      city: cityAverages.greeneryIndex,
                    },
                    {
                      metric: "NDVI",
                      barangay: selectedBarangay?.ndvi ?? 0,
                      city: cityAverages.ndvi,
                    },
                    {
                      metric: "Canopy %",
                      barangay: selectedBarangay?.treeCanopy ?? 0,
                      city: cityAverages.treeCanopy,
                    },
                    {
                      metric: "Poverty % (Inverted)",
                      barangay: 0.45,
                      city: cityAverages.poverty,
                    },
                    {
                      metric: "Area Size",
                      barangay: 0.68,
                      city: cityAverages.area,
                    },
                  ]}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                  NDVI & LST Trend
                </h3>
                <div className="flex h-8 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-800 p-1 text-neutral-500 dark:text-neutral-400">
                  <button
                    type="button"
                    onClick={() => setTimeRange("months")}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-xs font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                      timeRange === "months"
                        ? "bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50 shadow-sm"
                        : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    12 Months
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeRange("years")}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-xs font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                      timeRange === "years"
                        ? "bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50 shadow-sm"
                        : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    5 Years
                  </button>
                </div>
              </div>
              <div className="h-64">
                <NDVILSTChart
                  data={
                    historicalData.length > 0
                      ? timeRange === "months"
                        ? historicalData
                        : historicalData.filter((_, i) => i % 12 === 0).length >
                            0
                          ? [
                              {
                                month: "2020",
                                NDVI: Math.max(
                                  0,
                                  (selectedBarangay?.ndvi || 0) - 0.1,
                                ),
                                LST: (selectedBarangay?.lst || 0) + 1,
                              },
                              {
                                month: "2021",
                                NDVI: Math.max(
                                  0,
                                  (selectedBarangay?.ndvi || 0) - 0.05,
                                ),
                                LST: (selectedBarangay?.lst || 0) + 0.5,
                              },
                              {
                                month: "2022",
                                NDVI: selectedBarangay?.ndvi || 0,
                                LST: selectedBarangay?.lst || 0,
                              },
                              {
                                month: "2023",
                                NDVI: Math.min(
                                  1,
                                  (selectedBarangay?.ndvi || 0) + 0.02,
                                ),
                                LST: (selectedBarangay?.lst || 0) - 0.2,
                              },
                              {
                                month: "2024",
                                NDVI: Math.min(
                                  1,
                                  (selectedBarangay?.ndvi || 0) + 0.05,
                                ),
                                LST: (selectedBarangay?.lst || 0) - 0.5,
                              },
                            ]
                          : []
                      : []
                  }
                />
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
                Tree Canopy Trend (Past 12 Months)
              </h3>
              <div className="h-64">
                <TreeCanopyTrend
                  data={
                    historicalData.length > 0
                      ? historicalData.map((d) => ({
                          year: d.month,
                          canopy: d.canopy,
                        }))
                      : []
                  }
                  since="12 Months"
                  changePercent={
                    historicalData.length >= 2
                      ? Number(
                          (
                            ((historicalData[historicalData.length - 1].canopy -
                              historicalData[0].canopy) /
                              Math.max(0.01, historicalData[0].canopy)) *
                            100
                          ).toFixed(1),
                        )
                      : 0
                  }
                />
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
                Poverty Rate Comparison
              </h3>
              <div className="h-64">
                <PovertyComparison
                  data={[
                    {
                      label: selectedBarangay?.name ?? "Selected Barangay",
                      value: 42,
                    },
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
