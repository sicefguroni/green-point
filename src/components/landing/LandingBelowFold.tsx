"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Map,
  BrainCircuit,
  LayoutDashboard,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";

const APP_AUTHORS = [
  "Ceferino Jumao-as V",
  "Ishah Layno Bautista",
  "James Gabriel Elijah Ty",
  "Kyle Johanstein Lee",
  "Princess Jaena Marie Dela Peña",
] as const;

const FEATURE_CARDS: {
  imageSrc: string;
  imageAlt: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tag: string;
  priority?: boolean;
}[] = [
  {
    imageSrc: "/images/landingpage/greeningmapper.png",
    imageAlt: "Interactive GIS map of Mandaue City barangays",
    icon: Map,
    tag: "Explore",
    title: "Interactive GIS Explore Map",
    description:
      "Browse all 27 barangays of Mandaue City on a Mapbox-powered map. Toggle live satellite layers — NDVI vegetation index, Land Surface Temperature, tree canopy coverage, flood hazards, and storm surge risk. Select any barangay or draw a custom area to pull its real-time environmental metrics and AI-generated greening recommendations.",
    priority: true,
  },
  {
    imageSrc: "/images/landingpage/dashboard.png",
    imageAlt: "Home dashboard with city-wide environmental indicators",
    icon: LayoutDashboard,
    tag: "Dashboard",
    title: "City & Barangay Dashboard",
    description:
      "A centralized dashboard surfaces city-wide aggregates at a glance — mean Greenery Index, NDVI, canopy cover, and Land Surface Temperature for all of Mandaue. Drill down to individual barangays and view historical trend charts to understand how greenery has changed over time, so planners can prioritize where interventions will have the greatest impact.",
  },
  {
    imageSrc: "/images/landingpage/greeningmapper.png",
    imageAlt: "Greenery Index sub-dimension breakdown",
    icon: Sprout,
    tag: "Analytics",
    title: "Greenery Index (GI) Computation",
    description:
      "The Greenery Index is a composite score that blends satellite-derived NDVI with a tagged local tree inventory to measure urban greenness across four dimensions: quantity, accessibility & equity, environmental quality & resilience, and connectivity & biodiversity potential. Every barangay is scored and ranked so the most underserved areas are surfaced first.",
  },
  {
    imageSrc: "/images/landingpage/greeningsolutions.png",
    imageAlt: "AI-generated site-specific greening solution cards",
    icon: BrainCircuit,
    tag: "AI",
    title: "AI-Driven Greening Recommendations",
    description:
      "A context-aware recommendation engine scores and ranks greening interventions — street trees, pocket parks, green roofs, vertical gardens, bioswales, and more — for every selected location. Scores are weighted by the site's GI sub-dimensions, current LST, flood risk level, and available space type, ensuring each suggestion is both ecologically appropriate and practically feasible.",
  },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof FEATURE_CARDS)[0];
  index: number;
}) {
  const isEven = index % 2 === 0;
  const Icon = feature.icon;

  return (
    <div
      className={`flex flex-col ${
        isEven ? "lg:flex-row" : "lg:flex-row-reverse"
      } gap-10 lg:gap-20 items-center py-16 lg:py-24 border-b border-neutral-100 dark:border-white/5 last:border-0`}
    >
      <div className="w-full lg:w-[55%] relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/3] rounded-[2rem] overflow-hidden bg-neutral-100 dark:bg-neutral-900 shadow-2xl shadow-black/10 dark:shadow-black/30 border border-black/5 dark:border-white/10 group">
        <Image
          src={feature.imageSrc}
          alt={feature.imageAlt}
          fill
          sizes="(max-width: 1024px) 100vw, 55vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          priority={feature.priority}
        />
      </div>

      <div className="w-full lg:w-[45%] flex flex-col justify-center space-y-6 lg:space-y-8">
        <div className="inline-flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-100 dark:border-emerald-500/20">
            <Icon className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">
            {feature.tag}
          </span>
        </div>

        <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white leading-[1.1] tracking-tight">
          {feature.title}
        </h3>

        <p className="text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 leading-relaxed font-roboto">
          {feature.description}
        </p>
      </div>
    </div>
  );
}

function BelowFoldSkeleton() {
  return (
    <div className="bg-white rounded-t-[2rem] shadow-2xl shadow-black/20 px-4 sm:px-6 lg:px-8 pt-12 pb-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="h-7 w-56 rounded-lg bg-emerald-100 animate-pulse" />
        <div className="h-4 w-40 rounded bg-neutral-100 animate-pulse" />
        <div className="space-y-5 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-52 rounded-xl bg-neutral-100 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingBelowFold() {
  const [show, setShow] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "420px 0px", threshold: 0 },
    );
    io.observe(el);

    const fallback = window.setTimeout(() => {
      setShow(true);
      io.disconnect();
    }, 6000);

    return () => {
      window.clearTimeout(fallback);
      io.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-px w-full" aria-hidden />

      {!show ? (
        <BelowFoldSkeleton />
      ) : (
        <div className="bg-white dark:bg-neutral-950 rounded-t-[2rem] shadow-[0_-20px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-20px_40px_rgba(0,0,0,0.3)] relative z-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl pt-12 sm:pt-16 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-green mb-3">
              Features
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-black leading-snug">
              Everything you need to plan
              <br className="hidden sm:block" /> greener cities
            </h2>
          </div>

          <section
            className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[1400px]"
            aria-label="Feature details"
          >
            <div className="flex flex-col">
              {FEATURE_CARDS.map((card, idx) => (
                <FeatureCard key={card.title} feature={card} index={idx} />
              ))}
            </div>
          </section>

          <section
            className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-10 sm:mt-12 pt-5 pb-8 border-t border-neutral-100"
            aria-label="Credits"
          >
            <p className="text-primary-green text-[11px] font-semibold uppercase tracking-[0.18em] mb-2">
              Built by
            </p>
            <div className="flex flex-col sm:hidden items-center gap-1 text-neutral-black/60 text-xs">
              <div className="flex gap-x-3">
                {APP_AUTHORS[0]}
                <span className="text-neutral-300">·</span>
                {APP_AUTHORS[1]}
                <span className="text-neutral-300">·</span>
                {APP_AUTHORS[2]}
              </div>
              <div className="flex gap-x-3">
                {APP_AUTHORS[3]}
                <span className="text-neutral-300">·</span>
                {APP_AUTHORS[4]}
              </div>
            </div>
            <p className="hidden sm:block text-neutral-black/60 text-xs text-center whitespace-nowrap overflow-x-auto">
              {APP_AUTHORS.join(" · ")}
            </p>
          </section>
        </div>
      )}
    </>
  );
}
