"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ChevronsDown, ChevronsUp, Info } from "lucide-react";

import { useBarangay } from "@/context/BarangayContext";
import { useGeoData } from "@/context/geoDataStore";
import BarangayRadarChart from "@/components/charts/BarangayRadarChart";
import NDVILSTChart from "@/components/charts/NDVILSTChart";
import TreeCanopyTrend from "@/components/charts/TreeCanopyTrend";
import {
  buildRadarRows,
  computeCityComparison,
  yearlyMeans,
  type HistoryRecord,
} from "@/lib/dashboard/barangay-comparison";

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

function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
      {children}
    </div>
  );
}

export default function CityGreeneryMap() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { selectedBarangay } = useBarangay();
  const [history, setHistory] = React.useState<HistoryRecord[]>([]);
  const [timeRange, setTimeRange] = React.useState<"months" | "years">(
    "months",
  );

  React.useEffect(() => {
    // Clear first so a barangay with no history doesn't show the last one's.
    setHistory([]);
    if (!selectedBarangay?.name) return;
    let cancelled = false;
    fetch(`/api/barangays/${encodeURIComponent(selectedBarangay.name)}/history`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success && Array.isArray(data.data?.monthly)) {
          setHistory(data.data.monthly);
        }
      })
      .catch((err) => console.error("Error fetching historical data:", err));
    return () => {
      cancelled = true;
    };
  }, [selectedBarangay?.name]);

  const geoData = useGeoData((state) => state.geoData);

  const city = React.useMemo(
    () => (geoData?.features.length ? computeCityComparison(geoData.features) : null),
    [geoData],
  );

  const radarRows = React.useMemo(
    () =>
      city && selectedBarangay
        ? buildRadarRows(
            {
              name: selectedBarangay.name,
              greeneryIndex: selectedBarangay.greeneryIndex,
              ndvi: selectedBarangay.ndvi,
              treeCanopy: selectedBarangay.treeCanopy,
            },
            city,
          )
        : [],
    [city, selectedBarangay],
  );

  const last12 = React.useMemo(() => history.slice(-12), [history]);
  const yearly = React.useMemo(() => yearlyMeans(history).slice(-5), [history]);
  const canShowYears = yearly.length >= 2;
  const range = canShowYears ? timeRange : "months";

  const trendData = React.useMemo(
    () =>
      range === "years"
        ? yearly
        : last12
            .filter((d) => d.NDVI !== null && d.LST !== null)
            .map((d) => ({
              month: `${d.month} ${String(d.year).slice(-2)}`,
              NDVI: d.NDVI as number,
              LST: d.LST as number,
            })),
    [range, yearly, last12],
  );

  const canopyData = React.useMemo(
    () =>
      last12
        .filter((d) => d.canopy !== null)
        .map((d) => ({
          year: `${d.month} ${d.year}`,
          canopy: d.canopy as number,
        })),
    [last12],
  );

  const canopyChange =
    canopyData.length >= 2
      ? Number(
          (
            ((canopyData[canopyData.length - 1].canopy - canopyData[0].canopy) /
              Math.max(0.01, canopyData[0].canopy)) *
            100
          ).toFixed(1),
        )
      : 0;
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
                {radarRows.length >= 3 ? (
                  <BarangayRadarChart data={radarRows} />
                ) : (
                  <EmptyChart>City averages are still loading.</EmptyChart>
                )}
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
                      range === "months"
                        ? "bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50 shadow-sm"
                        : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    12 Months
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeRange("years")}
                    disabled={!canShowYears}
                    title={
                      canShowYears
                        ? undefined
                        : "Needs at least two full years of monthly data"
                    }
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-xs font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                      range === "years"
                        ? "bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50 shadow-sm"
                        : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    5 Years
                  </button>
                </div>
              </div>
              <div className="h-64">
                {trendData.length > 0 ? (
                  <NDVILSTChart data={trendData} />
                ) : (
                  <EmptyChart>No monthly history for this barangay yet.</EmptyChart>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
                Tree Canopy Trend (Past 12 Months)
              </h3>
              <div className="h-64">
                {canopyData.length > 0 ? (
                  <TreeCanopyTrend
                    data={canopyData}
                    since="12 Months"
                    changePercent={canopyChange}
                  />
                ) : (
                  <EmptyChart>No monthly history for this barangay yet.</EmptyChart>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
                Poverty Rate Comparison
              </h3>
              <div className="h-64">
                {/* No barangay poverty rates are loaded yet (BarangayMetrics.povertyRate
                    is empty), so show that instead of placeholder figures. */}
                <EmptyChart>
                  Poverty data for Mandaue&apos;s barangays isn&apos;t available
                  yet, so there&apos;s no comparison to show.
                </EmptyChart>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
