"use client";

import {
  Map,
  BrainCircuit,
  Camera,
  LayoutDashboard,
  ChevronRight,
  Sprout,
  Leaf,
  Thermometer,
  TreeDeciduous,
  Bot,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/general/layout/navbar";
import InfoCard from "@/components/ui/general/cards/preview-infocard";
import MandaueMap from "@/components/ui/dashboard/ChloropletMap";
import { BarangayProvider } from "@/context/BarangayContext";

const ROUTES_TO_PREFETCH = ["/home_dashboard", "/explore"] as const;

const APP_AUTHORS = [
  "Ceferino Jumao-as V",
  "Ishah Layno Bautista",
  "James Gabriel Elijah Ty",
  "Kyle Johanstein Lee",
  "Princess Jaena Marie Dela Peña",
] as const;

const FEATURE_PILLS: { icon: LucideIcon; label: string }[] = [
  { icon: Sprout, label: "NDVI" },
  { icon: Thermometer, label: "LST" },
  { icon: TreeDeciduous, label: "Tree Canopy" },
];

const MAJOR_FEATURES: { icon: LucideIcon; name: string }[] = [
  { icon: Map, name: "GIS-Based Greening Mapper" },
  { icon: Sprout, name: "Greenery Index (GI) Computation" },
  { icon: BrainCircuit, name: "AI-Driven Greening Recommendation Engine" },
  { icon: Camera, name: "Community-Contributed Data" },
  { icon: LayoutDashboard, name: "Interactive Dashboard" },
  { icon: Bot, name: "Multi-Agent Project Proposal Generator" },
];

const ICON_COLOR = "#16881B";

const FEATURE_CARDS = [
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

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    ROUTES_TO_PREFETCH.forEach((route) => router.prefetch(route));
  }, [router]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-green-100 overflow-x-hidden">
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
                  GI = 0.94 (High)
                </span>
              </div>
              <div className="w-full h-[260px] sm:h-[320px] md:h-[380px] lg:w-[430px] lg:h-[480px] border-2 sm:border-4 border-primary-green/40 overflow-hidden rounded-lg sm:rounded-xl shadow-xl bg-white">
                <BarangayProvider>
                  <MandaueMap settings={false} />
                </BarangayProvider>
              </div>
            </div>
          </div>
        </section>

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
          {/* Mobile: 2 rows (3 + 2 names), centered. Desktop: single line with bullets */}
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
      </div>
    </main>
  );
}
