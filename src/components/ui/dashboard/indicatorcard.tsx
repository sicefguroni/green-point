import { useState } from "react";
import { Info, Leaf, Sprout, Trees, Thermometer } from "lucide-react";

import { getTemperatureColor } from "@/lib/chloroplet-colors";
import HalfCircleBar from "./halfcirclebar";
import IndicatorInfoModal from "./info_modals";

interface IndicatorCardProps {
  title: string;
  subtitle: string;
  value: number;
  trendValue?: number | null;
  description?: string;
  source?: string;
  frequency?: string;
  isLST?: boolean;
  metricType: "ndvi" | "lst" | "canopy" | "gi";
}

const icons = {
  gi: Leaf,
  ndvi: Sprout,
  canopy: Trees,
  lst: Thermometer,
};

function getIconColors(
  metricType: IndicatorCardProps["metricType"],
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

export default function IndicatorCard({
  title,
  subtitle,
  description,
  source,
  frequency,
  value,
  trendValue,
  isLST = false,
  metricType,
}: IndicatorCardProps) {
  const temperatureClassColor = isLST ? getTemperatureColor(value) : "";
  const [lstTextColor] = temperatureClassColor.split(" ");

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const hasTrend = trendValue != null && Number.isFinite(trendValue);
  const trendLabel =
    hasTrend && (trendValue as number) >= 0
      ? `+${trendValue}`
      : hasTrend
        ? `${trendValue}`
        : "";

  const Icon = icons[metricType];
  const { text: iconText, bg: iconBg } = getIconColors(metricType, value);

  return (
    <>
      <div
        className="relative flex flex-col sm:flex-row w-full justify-between items-start sm:items-center 
      rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 
      dark:border-neutral-800/80 p-4 shadow-sm shadow-black/5 dark:shadow-black/20 gap-4"
      >
        <button
          type="button"
          onClick={handleOpenModal}
          className="absolute top-3 right-3 z-10 rounded-full p-1 text-neutral-400 
          dark:text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-200"
          aria-label={`More information about ${title}`}
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex flex-col items-start text-left gap-2 min-w-0">
          <div
            className={`p-2 flex items-center justify-center rounded-xl shrink-0 ${iconBg} ${iconText}`}
          >
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              {title}
            </h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {isLST ? (
          <div className="flex flex-col items-start sm:items-end justify-center py-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
            <p
              className={`text-3xl font-bold sm:text-4xl ${lstTextColor || "text-neutral-800 dark:text-neutral-100"}`}
            >
              {value}°C
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center sm:items-end justify-center shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
            <HalfCircleBar value={value} sizePx={100} />
            {hasTrend && (
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 -mt-1 w-full text-center sm:text-right">
                {trendLabel}
              </p>
            )}
          </div>
        )}
      </div>

      <IndicatorInfoModal
        open={isModalOpen}
        onClose={handleCloseModal}
        title={title}
        description={description ?? ""}
        source={source}
        frequency={frequency}
      />
    </>
  );
}
