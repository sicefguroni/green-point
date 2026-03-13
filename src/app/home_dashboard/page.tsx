"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, MapPinned } from "lucide-react";

import Navbar from "@/components/ui/general/layout/navbar";
import IndicatorCard from "@/components/ui/dashboard/indicatorcard";
import InterventionAnalysisTable from "@/components/ui/dashboard/InterventionAnalysisTable";
import CityGreeneryMap from "@/components/ui/dashboard/CityGreeneryMap";
import { BarangayProvider } from "@/context/BarangayContext";
import { fetchMetricDescriptions } from "@/lib/api/get_definitions";
import type { MetricDescriptions } from "@/types/metrics";

function useMetricDescriptions() {
  const [metricDescriptions, setMetricDescriptions] = useState<MetricDescriptions[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const data = await fetchMetricDescriptions();
      if (!isMounted) return;
      setMetricDescriptions(data);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const getDescription = useMemo(
    () =>
      (name: string): string => {
        const metric = metricDescriptions.find((item) => item.name === name);
        if (!metric) return "";

        if (metric.what || metric.why) {
          const what = metric.what ?? "";
          const why = metric.why ?? "";
          return `${what}${what && why ? "\n\n" : ""}${why}`.trim();
        }

        return metric.description ?? "";
      },
    [metricDescriptions],
  );

  return { metricDescriptions, getDescription };
}

export default function DashboardPage() {
  const currentDate = useMemo(() => new Date(), []);
  const currentMonthLabel = useMemo(
    () =>
      currentDate.toLocaleString("default", {
        month: "long",
        day: "numeric",
      }),
    [currentDate],
  );

  const { getDescription } = useMetricDescriptions();

  return (
    <BarangayProvider>
      <main className="relative flex min-h-screen max-w-screen flex-col bg-gradient-to-br from-white to-green-100 px-4 py-8 md:px-10 md:py-12">
        <Navbar />

        <div className="flex w-full flex-1 flex-col gap-8 overflow-hidden py-6 md:py-16">
          <section className="flex flex-col gap-4">
            <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <MapPinned size={28} className="text-primary-green" aria-hidden />
                <h1 className="text-2xl font-semibold text-neutral-black">Mandaue City</h1>
                <span className="hidden text-xl text-neutral-black/50 sm:inline" aria-hidden>
                  |
                </span>
                <p className="text-base font-medium text-neutral-black/80 sm:text-xl">
                  {currentMonthLabel}
                </p>
              </div>

              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                <Download className="h-4 w-4" aria-hidden />
                <span>Export</span>
              </button>
            </header>

            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <IndicatorCard
                title="Greenery Index"
                subtitle="GI (0-1 scale)"
                value={0.68}
                trendValue={0.05}
                description={getDescription("GreeneryIndex")}
              />

              <IndicatorCard
                title="Normalized Difference Vegetation Index"
                subtitle="NDVI (0-1 scale)"
                value={0.72}
                trendValue={0.03}
                description={getDescription("Normalized Difference Vegetation Index")}
              />

              <IndicatorCard
                title="Tree Canopy Cover"
                subtitle="TCC (0-1 scale)"
                value={0.65}
                trendValue={0.08}
                description={getDescription("Tree Canopy Cover")}
              />

              <IndicatorCard
                title="Land Surface Temperature"
                subtitle="LST (°C)"
                value={32}
                trendValue={1}
                isLST
                description={getDescription("Land Surface Temperature")}
              />
            </section>
          </section>

          <section className="flex flex-col gap-6">
            <CityGreeneryMap />
            <InterventionAnalysisTable />
          </section>
        </div>
      </main>
    </BarangayProvider>
  );
}
