"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Map,
  BrainCircuit,
  Camera,
  LayoutDashboard,
  Sprout,
  Bot,
  type LucideIcon,
} from "lucide-react";
import InfoCard from "@/components/ui/general/cards/preview-infocard";

const APP_AUTHORS = [
  "Ceferino Jumao-as V",
  "Ishah Layno Bautista",
  "James Gabriel Elijah Ty",
  "Kyle Johanstein Lee",
  "Princess Jaena Marie Dela Peña",
] as const;

const MAJOR_FEATURES: { icon: LucideIcon; name: string }[] = [
  { icon: Map, name: "GIS-Based Greening Mapper" },
  { icon: Sprout, name: "Greenery Index (GI) Computation" },
  { icon: BrainCircuit, name: "AI-Driven Greening Recommendation Engine" },
  { icon: Camera, name: "Community-Contributed Data" },
  { icon: LayoutDashboard, name: "Interactive Dashboard" },
  { icon: Bot, name: "Multi-Agent Project Proposal Generator" },
];

const ICON_COLOR = "#16881B";

const FEATURE_CARDS: {
  imageSrc: string;
  imageAlt: string;
  icon: ReactNode;
  title: string;
  description: string;
  priority?: boolean;
}[] = [
  {
    imageSrc: "/images/landingpage/greeningmapper.png",
    imageAlt: "GIS-based greening mapper interface",
    icon: <Map size={32} color={ICON_COLOR} />,
    title: "GIS-Based Greening Mapper",
    description:
      "Displays multi-hazard hotspots such as Urban Heat Islands, flood and storm surge, as well as air pollution, with toggle-able layers and a greenery index map. This makes use of geospatial datasets including land surface temperature, hazard maps, pollution, and socioeconomic indicators.",
    priority: true,
  },
  {
    imageSrc: "/images/landingpage/greeningmapper.png",
    imageAlt: "Greenery Index computation",
    icon: <Sprout size={32} color={ICON_COLOR} />,
    title: "Greenery Index (GI) Computation",
    description:
      "GI measures greenness of an area across quantity, accessibility & equity, environmental quality & resilience, and connectivity & biodiversity potential. This will be used to identify areas of high priority, as well as aid in deciding efficient and appropriate greening solutions.",
    priority: false,
  },
  {
    imageSrc: "/images/landingpage/greeningsolutions.png",
    imageAlt: "AI-driven greening recommendations",
    icon: <BrainCircuit size={32} color={ICON_COLOR} />,
    title: "AI-Driven Greening Recommendation Engine",
    description:
      "Processes the computed GI and other data to generate site-specific greening interventions such as street trees, pocket parks, green roofs, and more. This makes use of machine learning models to estimate cooling effects, pollutant reduction, and resilience benefits for the suggested interventions. The engine is trained with data from studies proposing greening solutions, observed pre/post greening impacts, and simulations from ENVI-met and similar urban tools.",
    priority: false,
  },
  {
    imageSrc: "/images/landingpage/imageuploading.png",
    imageAlt: "Community-contributed data upload",
    icon: <Camera size={32} color={ICON_COLOR} />,
    title: "Community-Contributed Data",
    description:
      "Allows users to upload geotagged photos of their areas they want to employ greening interventions. Employs computer vision algorithms to detect viable and effective greening interventions using the AI-driven greening recommendation engine.",
    priority: false,
  },
  {
    imageSrc: "/images/landingpage/dashboard.png",
    imageAlt: "Interactive dashboard overview",
    icon: <LayoutDashboard size={32} color={ICON_COLOR} />,
    title: "Interactive Dashboard",
    description:
      "Summarizes and visualizes the key metrics of a specific location such as greenery index, air quality status, heat and hazard exposures. It provides an overview of a hotspot and its specific intervention along with its projected benefits and impact.",
    priority: false,
  },
  {
    imageSrc: "/images/landingpage/greeningsolutions.png",
    imageAlt: "Multi-agent project proposal generator",
    icon: <Bot size={32} color={ICON_COLOR} />,
    title: "Multi-Agent Based Project Proposal Generator",
    description:
      "Leverages multiple AI agents to collaboratively generate structured project proposals for greening interventions. Combines site data, GI metrics, and recommendation outputs into coherent, actionable proposals suitable for planning and funding applications.",
    priority: false,
  },
];

function BelowFoldSkeleton() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-8 sm:mt-12 space-y-8">
      <div className="h-8 w-48 rounded-lg bg-emerald-100/60 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-lg bg-white/60 border border-primary-green/20 animate-pulse"
          />
        ))}
      </div>
      <div className="space-y-6 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-lg bg-white/70 border border-neutral-100 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Defers heavy below-the-fold content (feature grid, InfoCards, credits) until the
 * section is near the viewport, so the hero + map parse and paint first.
 */
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
      <div ref={sentinelRef} className="h-px w-full max-w-7xl mx-auto" aria-hidden />

      {!show ? (
        <BelowFoldSkeleton />
      ) : (
        <>
          <section
            className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-8 sm:mt-12 lg:mt-16"
            aria-label="Major features"
          >
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-neutral-black mb-4 sm:mb-6 lg:mb-8">
              All major features
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 list-none p-0 m-0">
              {MAJOR_FEATURES.map(({ icon: Icon, name }) => (
                <li
                  key={name}
                  className="flex items-center gap-2 sm:gap-3 rounded-lg bg-white/70 border border-primary-green/30 px-3 sm:px-4 py-2.5 sm:py-3 text-neutral-black hover:border-primary-green/50 hover:shadow-sm transition-colors"
                >
                  <span className="flex-shrink-0 text-primary-green" aria-hidden>
                    <Icon size={20} className="sm:w-[22px] sm:h-[22px]" />
                  </span>
                  <span className="font-medium text-xs sm:text-sm lg:text-base min-w-0 break-words">
                    {name}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-8 sm:mt-12 lg:mt-16"
            aria-label="Features"
          >
            <div className="flex flex-col gap-5 sm:gap-6 lg:gap-8">
              {FEATURE_CARDS.map((card) => (
                <InfoCard
                  key={card.title}
                  imageSrc={card.imageSrc}
                  imageAlt={card.imageAlt}
                  icon={card.icon}
                  title={card.title}
                  description={card.description}
                  priority={card.priority}
                />
              ))}
            </div>
          </section>

          <section
            className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-6 sm:mt-8 pt-4 sm:pt-5 pb-4 border-t border-neutral-black/10"
            aria-label="Credits"
          >
            <p className="text-primary-green text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1.5 sm:mb-2">
              Built by:
            </p>
            <div className="flex flex-col sm:hidden items-center gap-1.5 text-neutral-black/85 text-xs">
              <div className="flex justify-center gap-x-4 sm:gap-x-6 gap-y-0">
                {APP_AUTHORS[0]}
                <span className="text-neutral-black/50">·</span>
                {APP_AUTHORS[1]}
                <span className="text-neutral-black/50">·</span>
                {APP_AUTHORS[2]}
              </div>
              <div className="flex justify-center gap-x-4 sm:gap-x-6 gap-y-0">
                {APP_AUTHORS[3]}
                <span className="text-neutral-black/50">·</span>
                {APP_AUTHORS[4]}
              </div>
            </div>
            <p className="hidden sm:block text-neutral-black/85 text-xs sm:text-sm text-center whitespace-nowrap overflow-x-auto [-webkit-overflow-scrolling:touch]">
              {APP_AUTHORS.join(" · ")}
            </p>
          </section>
        </>
      )}
    </>
  );
}
