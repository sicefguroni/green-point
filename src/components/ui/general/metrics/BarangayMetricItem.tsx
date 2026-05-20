import { type LucideIcon, Info } from "lucide-react";
import { useState } from "react";
import IndicatorInfoModal from "@/components/ui/dashboard/info_modals";

interface BarangayMetricItemProps {
  icon: React.ElementType | LucideIcon;
  label: string;
  value: number;
  metricType: "ndvi" | "lst" | "canopy" | "gi";
}

const METRIC_DETAILS = {
  gi: {
    title: "Greenery Index",
    what: "A weighted composite index evaluating urban greenery health, thermal comfort, canopy density, and green area coverage on a scale of 0 to 1. Formulated as: NDVI (35%) + Normalized Thermal Comfort (25%) + Blended Tree Canopy (25%) + Green Area Fraction (15%).",
    why: "Provides city planners with a holistic view of green infrastructure distribution. A higher index correlates with better urban biodiversity, reduced air pollution, improved mental well-being, and enhanced climate resilience.",
    source: "Multi-Source Blend",
    frequency: "Computed live on-demand / 6-hour cache",
  },
  ndvi: {
    title: "NDVI",
    what: "A standardized satellite-derived vegetation index computed from red and near-infrared light reflectance. It ranges from -1 to +1, where values between 0.2 and 0.8 represent living green vegetation of varying density and health.",
    why: "Enables continuous, high-frequency monitoring of vegetation health and photosynthetic activity. It acts as an early warning system for drought, pest infestations, and canopy degradation across the city.",
    source: "GEE / Sentinel-2",
    frequency: "6-hour system cache / Live (GEE)",
  },
  canopy: {
    title: "Tree Canopy Cover",
    what: "The percentage of a given land area covered by the foliage and branches of trees when viewed from directly overhead, derived by blending local geotagged tree inventories (calculating crown area from DBH and height) with Sentinel-2 satellite spectral estimates.",
    why: "Directly mitigates the Urban Heat Island effect through shading and evapotranspiration. High canopy cover reduces cooling costs, sequesters carbon, mitigates stormwater runoff, and provides critical urban wildlife habitats.",
    source: "Blended (Tree Inventory + Sentinel-2 NDVI)",
    frequency: "6-hour system cache / Live (Prisma + GEE)",
  },
  lst: {
    title: "Surface Temp",
    what: "The skin temperature of the land surface (including soil, pavement, and vegetation canopy) measured via thermal infrared satellite bands. Point queries fall back to NASA POWER if GEE is offline.",
    why: "Identifies microclimate hot-spots and urban heat islands. Lowering LST via strategic tree planting reduces heat-related health risks, decreases energy demand, and improves outdoor thermal comfort for residents.",
    source: "GEE / MODIS (with NASA POWER fallback)",
    frequency: "6-hour system cache / Live (GEE)",
  },
};

function getIconColors(
  metricType: BarangayMetricItemProps["metricType"],
  value: number,
): { text: string; bg: string } {
  if (metricType === "lst") {
    if (value >= 34)
      return {
        text: "text-red-600 dark:text-red-400",
        bg: "bg-red-100 dark:bg-red-500/15",
      };
    if (value >= 32)
      return {
        text: "text-orange-500 dark:text-orange-400",
        bg: "bg-orange-100 dark:bg-orange-500/15",
      };
    if (value >= 30)
      return {
        text: "text-amber-500 dark:text-amber-400",
        bg: "bg-amber-100 dark:bg-amber-500/15",
      };
    return {
      text: "text-neutral-500 dark:text-neutral-400",
      bg: "bg-neutral-100 dark:bg-neutral-800",
    };
  }
  if (metricType === "ndvi") {
    if (value >= 0.5)
      return {
        text: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-500/15",
      };
    if (value >= 0.3)
      return {
        text: "text-green-500 dark:text-green-400",
        bg: "bg-green-100 dark:bg-green-500/15",
      };
    if (value >= 0.15)
      return {
        text: "text-yellow-500 dark:text-yellow-400",
        bg: "bg-yellow-100 dark:bg-yellow-500/15",
      };
    return {
      text: "text-red-500 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-500/15",
    };
  }
  if (metricType === "canopy") {
    if (value >= 0.5)
      return {
        text: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-500/15",
      };
    if (value >= 0.3)
      return {
        text: "text-green-500 dark:text-green-400",
        bg: "bg-green-100 dark:bg-green-500/15",
      };
    if (value >= 0.15)
      return {
        text: "text-lime-500 dark:text-lime-400",
        bg: "bg-lime-100 dark:bg-lime-500/15",
      };
    return {
      text: "text-yellow-500 dark:text-yellow-400",
      bg: "bg-yellow-100 dark:bg-yellow-500/15",
    };
  }
  if (value >= 0.6)
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-500/15",
    };
  if (value >= 0.4)
    return {
      text: "text-green-500 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-500/15",
    };
  if (value >= 0.25)
    return {
      text: "text-lime-500 dark:text-lime-400",
      bg: "bg-lime-100 dark:bg-lime-500/15",
    };
  if (value >= 0.1)
    return {
      text: "text-yellow-500 dark:text-yellow-400",
      bg: "bg-yellow-100 dark:bg-yellow-500/15",
    };
  return {
    text: "text-red-500 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-500/15",
  };
}

export default function BarangayMetricItem({
  icon: Icon,
  label,
  value,
  metricType,
}: BarangayMetricItemProps) {
  const { text, bg } = getIconColors(metricType, value);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const details = METRIC_DETAILS[metricType];

  return (
    <>
      <div
        className="
          w-full flex items-center justify-between gap-3
          bg-white/60 dark:bg-neutral-900/50 backdrop-blur-md
          border border-neutral-200/50 dark:border-neutral-800/60
          shadow-sm shadow-black/5 dark:shadow-black/20
          rounded-2xl p-3
          transition-all duration-300
          hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700
          group cursor-default relative
        "
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-2.5 flex items-center justify-center rounded-xl transition-all duration-300 shrink-0 ${bg} ${text}`}
          >
            <Icon
              size={18}
              className="group-hover:scale-110 transition-transform duration-300"
            />
          </div>

          <div className="flex flex-col items-start gap-0.5 min-w-0">
            <span className="text-xs font-medium truncate w-full text-neutral-400 dark:text-neutral-500">
              {label}
            </span>

            <div className="flex items-baseline gap-0.5">
              {metricType === "lst" ? (
                <span className="font-bold text-base font-poppins text-neutral-800 dark:text-neutral-100">
                  {value?.toFixed(0)}
                </span>
              ) : metricType === "canopy" ? (
                <span className="font-bold text-base font-poppins text-neutral-800 dark:text-neutral-100">
                  {(value! * 100).toFixed(1)}%
                </span>
              ) : (
                <span className="font-bold text-base font-poppins text-neutral-800 dark:text-neutral-100">
                  {value?.toFixed(2)}
                </span>
              )}
              {metricType === "lst" && (
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  °C
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="rounded-full p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors shrink-0"
          aria-label={`More information about ${label}`}
        >
          <Info size={14} />
        </button>
      </div>

      <IndicatorInfoModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={details.title}
        description={`${details.what}\n\n${details.why}`}
        source={details.source}
        frequency={details.frequency}
      />
    </>
  );
}
