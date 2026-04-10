"use client";

import { ChevronRight, Sprout, Leaf, Thermometer, TreeDeciduous } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/general/layout/navbar";
import LandingMapMount from "@/components/landing/landing-map-mount";
import { useCityMetricAggregates } from "@/hooks/useCityMetricAggregates";
import { greeneryIndexClassLabel } from "@/lib/api/city-metrics";
import { formatUpTo2Decimals } from "@/lib/format-number";

const ROUTES_TO_PREFETCH = ["/home_dashboard", "/explore"] as const;

const LandingBelowFold = dynamic(
  () => import("@/components/landing/LandingBelowFold"),
  {
    ssr: false,
    loading: () => (
      <div
        className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-8 min-h-[min(60vh,520px)]"
        aria-hidden
      />
    ),
  },
);

const FEATURE_PILLS: {
  icon: (typeof Sprout) | typeof Thermometer | typeof TreeDeciduous;
  label: string;
}[] = [
  { icon: Sprout, label: "NDVI" },
  { icon: Thermometer, label: "LST" },
  { icon: TreeDeciduous, label: "Tree Canopy" },
];

export default function LandingPageClient() {
  const router = useRouter();
  const { metrics, loading: metricsLoading, error: metricsError } =
    useCityMetricAggregates({ deferUntilIdle: true });

  useEffect(() => {
    const prefetch = () => {
      ROUTES_TO_PREFETCH.forEach((route) => router.prefetch(route));
    };
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(prefetch, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(prefetch, 2500);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <>
      <Navbar landing />

      <div className="pt-[4.5rem] sm:pt-24 pb-6 sm:pb-8">
        <section
          className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl"
          aria-labelledby="hero-heading"
        >
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 sm:gap-10 lg:gap-16 my-8 sm:my-12 lg:my-16">
            <div className="flex flex-col items-start gap-3 sm:gap-4 max-w-2xl w-full order-2 lg:order-1 min-w-0">
              <h1
                id="hero-heading"
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-neutral-black text-left leading-tight"
              >
                Turn Heat Maps
                <br />
                into <span className="text-primary-green">Green Maps</span>
              </h1>
              <p className="text-neutral-black/70 text-base sm:text-lg lg:text-xl font-normal">
                Data-driven pathways to greener and healthier cities.
              </p>
              <Link
                href="/home_dashboard"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto text-base sm:text-lg text-white bg-primary-green border-2 border-primary-green py-3 px-5 sm:px-6 rounded-full font-semibold mt-1 sm:mt-2 hover:bg-primary-green/90 hover:border-primary-green/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-green focus:ring-offset-2"
              >
                Get Started
                <ChevronRight size={20} aria-hidden />
              </Link>
              <div className="grid grid-cols-[1fr_1fr_1.4fr] sm:flex sm:flex-wrap gap-2 sm:gap-3 w-full mt-4 sm:mt-6">
                {FEATURE_PILLS.map(({ icon: Icon, label }, index) => (
                  <div
                    key={label}
                    className={`flex flex-col items-center justify-center text-primary-green/70 hover:text-primary-green/90 bg-white/60 border border-primary-green/40 rounded-lg min-h-[5.25rem] sm:min-h-[5rem] py-3 px-2 sm:px-2.5 gap-1.5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${index === 2 ? "sm:min-w-[9rem]" : "sm:min-w-[7rem]"}`}
                  >
                    <Icon
                      size={22}
                      className="sm:w-6 sm:h-6 flex-shrink-0"
                      aria-hidden
                    />
                    <span className="text-xs sm:text-sm font-medium text-center leading-tight [word-break:break-word]">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-[min(100%,430px)] order-1 lg:order-2 shrink-0 mx-auto lg:mx-0">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h2 className="text-neutral-black text-lg sm:text-xl font-medium">
                  Mandaue City
                </h2>
                <span className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium border-2 border-primary-green/50 bg-white text-primary-green px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                  <Leaf
                    size={18}
                    className="sm:w-5 sm:h-5 flex-shrink-0"
                    aria-hidden
                  />
                  {metricsLoading
                    ? "GI …"
                    : metricsError || !metrics
                      ? "Live GI unavailable"
                      : `GI = ${formatUpTo2Decimals(metrics.meanGreeneryIndex)} (${greeneryIndexClassLabel(metrics.meanGreeneryIndex)})`}
                </span>
              </div>
              <LandingMapMount settings={false} />
            </div>
          </div>
        </section>

        <LandingBelowFold />
      </div>
    </>
  );
}
