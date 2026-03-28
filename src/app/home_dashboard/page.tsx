"use client";

import Navbar from "@/components/ui/general/layout/navbar";
import IndicatorCard from "@/components/ui/dashboard/indicatorcard";
import { Download, MapPinned } from "lucide-react";
import InterventionAnalysisTable from "@/components/ui/dashboard/InterventionAnalysisTable";
import CityGreeneryMap from "@/components/ui/dashboard/CityGreeneryMap";

import { BarangayProvider } from "@/context/BarangayContext";
import { fetchMetricDescriptions } from "@/lib/api/get_definitions";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MetricDescriptions } from "@/types/metrics";

export default function DashboardPage() {
  const router = useRouter();
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
      <main className="relative flex min-h-screen max-w-screen flex-col bg-gradient-to-br from-white to-green-100 px-4 py-8 md:px-10 md:py-12">
        <Navbar />

        <div className="w-full flex flex-col overflow-hidden py-32 gap-8">
          <div className="flex flex-col gap-4">
            {/* Header info */}
            <header className="flex justify-between items-center w-full">
              <div className="flex items-center gap-3">
                <MapPinned size={28} className="text-primary-green" />
                <h1 className="text-neutral-black text-2xl">Mandaue City</h1>
                <span className="text-neutral-black/50 text-xl">|</span>
                <h2 className="text-neutral-black/80 text-xl">
                  {currentMonth}
                </h2>
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
                description={getDesc("GreeneryIndex")}
                source={getSource("GreeneryIndex")}
                frequency={getFrequency("GreeneryIndex")}
              />
              <IndicatorCard
                title="Normalized Difference Vegetation Index"
                subtitle="NDVI (0-1 scale)"
                value={0.72}
                trendValue={0.03}
                description={getDesc("Normalized Difference Vegetation Index")}
                source={getSource("Normalized Difference Vegetation Index")}
                frequency={getFrequency(
                  "Normalized Difference Vegetation Index",
                )}
              />
              <IndicatorCard
                title="Tree Canopy Cover"
                subtitle="TCC (0-1 scale)"
                value={0.65}
                trendValue={0.08}
                description={getDesc("Tree Canopy Cover")}
                source={getSource("Tree Canopy Cover")}
                frequency={getFrequency("Tree Canopy Cover")}
              />
              <IndicatorCard
                title="Land Surface Temperature"
                subtitle="LST (°C)"
                value={32}
                trendValue={1}
                isLST={true}
                description={getDesc("Land Surface Temperature")}
                source={getSource("Land Surface Temperature")}
                frequency={getFrequency("Land Surface Temperature")}
              />
            </section>
          </div>

          <section className="flex flex-col gap-6">
            <CityGreeneryMap />
            <InterventionAnalysisTable />
          </section>
        </div>
      </main>
    </BarangayProvider>
  );
}
