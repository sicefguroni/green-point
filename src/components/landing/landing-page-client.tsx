"use client";

import { Map, LayoutDashboard, Sprout } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/general/layout/navbar";
import LandingMapMount from "@/components/landing/landing-map-mount";
import { useCityMetricAggregates } from "@/hooks/useCityMetricAggregates";


const ROUTES_TO_PREFETCH = ["/home_dashboard", "/explore"] as const;

const LandingBelowFold = dynamic(
  () => import("@/components/landing/LandingBelowFold"),
  {
    ssr: false,
    loading: () => <div className="min-h-[60vh]" aria-hidden />,
  },
);

const STAT_PILLS = [
  { icon: Map, label: "27 Barangays Mapped" },
  { icon: Sprout, label: "Live NDVI & LST Data" },
  { icon: LayoutDashboard, label: "Study Supported AI" },
] as const;

export default function LandingPageClient() {
  const router = useRouter();
  const [scrollProgress, setScrollProgress] = useState(0);
  useCityMetricAggregates({ deferUntilIdle: true });

  useEffect(() => {
    const prefetch = () =>
      ROUTES_TO_PREFETCH.forEach((r) => router.prefetch(r));
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(prefetch, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(prefetch, 2500);
    return () => window.clearTimeout(t);
  }, [router]);

  useEffect(() => {
    const onScroll = () => {
      const progress = Math.min(window.scrollY / (window.innerHeight * 0.6), 1);
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const overlayOpacityScale = Math.max(0, 1 - scrollProgress * 1.5);
  const overlayBlur = Math.round((1 - scrollProgress) * 8);
  const heroOpacity = Math.max(0, 1 - scrollProgress * 2.0);
  const heroTranslateY = scrollProgress * -24;
  const mapInteractive = scrollProgress > 0.75;

  return (
    <>
      <Navbar landing />

      <div
        className="sticky top-0 h-screen w-full overflow-hidden z-0 flex flex-col items-center justify-end pb-[4vh]"
        style={{ isolation: "isolate" }}
      >
        <h2
          className="relative z-[1015] text-2xl sm:text-3xl font-semibold mb-3 sm:mb-4 text-neutral-black dark:text-white select-none text-center px-4"
          style={{
            opacity: Math.max(0, (scrollProgress - 0.5) * 2),
            transform: `translateY(${Math.max(0, 20 - scrollProgress * 20)}px)`,
            pointerEvents: mapInteractive ? "auto" : "none",
          }}
        >
          View Barangay Greenery Indexes
        </h2>

        <div
          className="relative w-[96%] max-w-[1400px] h-[80vh] rounded-[2rem] overflow-hidden shadow-2xl shadow-black/50 border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-neutral-900"
          style={{
            pointerEvents: mapInteractive ? "auto" : "none",
          }}
        >
          <div className="absolute inset-0 pointer-events-auto">
            <LandingMapMount settings={false} heroMode />
          </div>
        </div>

        <div
          className="absolute inset-0 pointer-events-none bg-background/40"
          style={{
            zIndex: 1010,
            opacity: overlayOpacityScale,
            backdropFilter: overlayBlur > 0 ? `blur(${overlayBlur}px)` : "none",
            WebkitBackdropFilter:
              overlayBlur > 0 ? `blur(${overlayBlur}px)` : "none",
          }}
        />

        <div
          className="absolute inset-0 flex flex-col items-center justify-center px-4 pointer-events-none select-none"
          style={{
            zIndex: 1020,
            opacity: heroOpacity,
            transform: `translateY(${heroTranslateY}px)`,
          }}
        >
          <div
            className="flex flex-col items-center gap-5 text-center max-w-3xl w-full"
            style={{ pointerEvents: heroOpacity > 0 ? "auto" : "none" }}
          >
            <h1
              id="hero-heading"
              className="text-5xl sm:text-6xl lg:text-7xl font-semibold text-neutral-900 dark:text-white leading-[1.1] tracking-tight"
            >
              Turn Heat Maps
              <br />
              into{" "}
              <span className="text-emerald-600 dark:text-emerald-400">
                Green Maps
              </span>
            </h1>

            <p className="text-neutral-600 dark:text-white/70 text-base sm:text-lg lg:text-xl max-w-xl leading-relaxed">
              Data-driven pathways to greener, healthier cities. Using satellite
              data, AI, and local knowledge.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 mt-1">
              <Link
                href="/home_dashboard"
                id="hero-cta-primary"
                className="inline-flex items-center justify-center gap-2 text-sm sm:text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 py-3 px-7 rounded-full transition-all shadow-lg shadow-black/10 dark:shadow-black/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-transparent"
              >
                Get Started
              </Link>
              <Link
                href="/explore"
                id="hero-cta-secondary"
                className="inline-flex items-center justify-center gap-2 text-sm sm:text-base font-semibold text-neutral-800 dark:text-white/90 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 border border-black/10 dark:border-white/25 py-3 px-7 rounded-full transition-all backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-white/40 shadow-sm"
              >
                Explore the Map
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {STAT_PILLS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-600 dark:text-white/60 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full"
                >
                  <Icon
                    size={12}
                    className="text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 pointer-events-none">
        <div className="h-[130vh]" aria-hidden />

        <div className="pointer-events-auto">
          <LandingBelowFold />
        </div>
      </div>
    </>
  );
}
