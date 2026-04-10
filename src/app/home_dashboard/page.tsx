"use client";

import Navbar from "@/components/ui/general/layout/navbar";
import IndicatorCard from "@/components/ui/dashboard/indicatorcard";
import { Download, MapPinned } from "lucide-react";
import InterventionAnalysisTable from "@/components/ui/dashboard/InterventionAnalysisTable";
import CityGreeneryMap from "@/components/ui/dashboard/CityGreeneryMap";

import { BarangayProvider } from "@/context/BarangayContext";
import { fetchMetricDescriptions } from "@/lib/api/get_definitions";
import { useCityMetricAggregates } from "@/hooks/useCityMetricAggregates";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MetricDescriptions } from "@/types/metrics";
import { roundTo2Decimals } from "@/lib/format-number";

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export default function DashboardPage() {
  const router = useRouter();
  const {
    metrics: cityMetrics,
    loading: cityMetricsLoading,
    error: cityMetricsError,
  } = useCityMetricAggregates();
  const [metricDescriptions, setMetricDescriptions] = useState<
    MetricDescriptions[]
  >([]);

  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString("default", {
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const data = await fetchMetricDescriptions();
      if (isMounted) setMetricDescriptions(data);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("toast") === "welcome_oauth") {
      toast.success("Welcome back! You're signed in.");
      router.replace("/home_dashboard", { scroll: false });
    }
  }, [router]);

  const getDesc = (name: string) => {
    const metric = metricDescriptions.find((metric) => metric.name === name);
    if (!metric) return "";
    // Prefer explicit what/why fields when available
    if (metric.what || metric.why) {
      const w = metric.what ?? "";
      const y = metric.why ?? "";
      return `${w}${w && y ? "\n\n" : ""}${y}`.trim();
    }
    return metric.description || "";
  };

  const getSource = (name: string) => {
    return (
      metricDescriptions.find((metric) => metric.name === name)?.source ||
      "Satellite Data"
    );
  };

  const getFrequency = (name: string) => {
    return (
      metricDescriptions.find((metric) => metric.name === name)?.frequency ||
      "Annual"
    );
  };

  return (
    <BarangayProvider>
      <main className="relative flex min-h-screen max-w-screen flex-col bg-neutral-100 font-roboto">
        <Navbar />

        {/* Background elements to match explore feel */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-green/5 rounded-full blur-[120px]" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary-green/5 rounded-full blur-[120px]" />
        </div>

        <div className="relative w-full flex flex-col overflow-hidden px-4 md:px-10 py-32 gap-10">
          <div className="flex flex-col gap-6">
            {/* Header info */}
            <header className="flex flex-col md:flex-row md:items-end justify-between w-full gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MapPinned size={18} className="text-primary-green" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                    City Dashboard
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-black text-neutral-900 font-poppins tracking-tight">
                    Mandaue City
                  </h1>
                  <span className="text-neutral-200 text-3xl font-thin">/</span>
                  <h2 className="text-neutral-500 text-xl font-bold font-poppins">
                    {currentMonth}
                  </h2>
                </div>
                {cityMetrics?.datasetDate ? (
                  <p className="text-xs font-medium text-neutral-400">
                    Satellite stack date: {cityMetrics.datasetDate}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                className="h-11 inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-neutral-100 px-6 py-1.5 text-sm font-bold text-neutral-600 shadow-sm transition-all hover:bg-neutral-50"
              >
                <Download className="h-4 w-4" aria-hidden />
                <span>Export Report</span>
              </button>
            </header>

            {cityMetricsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex min-h-[14rem] animate-pulse flex-col rounded-lg border bg-white p-4 shadow-md"
                  >
                    <div className="h-4 w-1/2 rounded bg-neutral-200" />
                    <div className="mt-2 h-3 w-1/3 rounded bg-neutral-100" />
                    <div className="mt-8 flex flex-1 items-center justify-center">
                      <div className="h-24 w-24 rounded-full bg-neutral-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : cityMetricsError || !cityMetrics ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Live city metrics could not be loaded. Check the data API or try
                refreshing the page.
              </p>
            ) : (
              <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <IndicatorCard
                  title="Greenery Index"
                  subtitle="City mean · GI (0–1)"
                  value={roundTo2Decimals(clamp01(cityMetrics.meanGreeneryIndex))}
                  description={getDesc("GreeneryIndex")}
                  source={getSource("GreeneryIndex")}
                  frequency={getFrequency("GreeneryIndex")}
                />
                <IndicatorCard
                  title="NDVI"
                  subtitle="City mean · vegetation"
                  value={roundTo2Decimals(clamp01(cityMetrics.meanNdvi))}
                  description={getDesc(
                    "Normalized Difference Vegetation Index",
                  )}
                  source={getSource("Normalized Difference Vegetation Index")}
                  frequency={getFrequency(
                    "Normalized Difference Vegetation Index",
                  )}
                />
                <IndicatorCard
                  title="Tree Canopy"
                  subtitle="City mean · TCC (0–1)"
                  value={roundTo2Decimals(clamp01(cityMetrics.meanTreeCanopy))}
                  description={getDesc("Tree Canopy Cover")}
                  source={getSource("Tree Canopy Cover")}
                  frequency={getFrequency("Tree Canopy Cover")}
                />
                <IndicatorCard
                  title="Surface Temp"
                  subtitle="City mean · LST (°C)"
                  value={roundTo2Decimals(cityMetrics.meanLst)}
                  isLST={true}
                  description={getDesc("Land Surface Temperature")}
                  source={getSource("Land Surface Temperature")}
                  frequency={getFrequency("Land Surface Temperature")}
                />
              </section>
            )}
          </div>

          <section className="flex flex-col gap-10">
            <div className="rounded-[2.5rem] overflow-hidden border border-white/50 shadow-2xl bg-white/80 backdrop-blur-2xl p-2">
              <CityGreeneryMap />
            </div>
            <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 p-8 shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-px flex-1 bg-neutral-100" />
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] whitespace-nowrap">
                  Barangay Intervention Analysis
                </span>
                <div className="h-px flex-1 bg-neutral-100" />
              </div>
              <InterventionAnalysisTable />
            </div>
          </section>
        </div>
      </main>
    </BarangayProvider>
  );
}
