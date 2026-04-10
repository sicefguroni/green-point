import { useState } from "react";
import { Info } from "lucide-react";

import { getTemperatureColor } from "@/lib/chloroplet-colors";

import HalfCircleBar from "./halfcirclebar";
import IndicatorInfoModal from "./info_modals";

interface IndicatorCardProps {
  title: string;
  subtitle: string;
  value: number;
  /** When omitted, shows a static “citywide average” caption instead of a trend. */
  trendValue?: number | null;
  description?: string;
  source?: string;
  frequency?: string;
  isLST?: boolean;
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
}: IndicatorCardProps) {
  const temperatureClassColor = isLST ? getTemperatureColor(value) : "";
  const [textColor] = temperatureClassColor.split(" ");

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

  return (
    <>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 rounded-lg border bg-white p-4 shadow-md">
        <div className="flex w-full items-start justify-between">
          <div className="flex flex-col text-left">
            <h2 className="whitespace-nowrap text-md font-semibold text-neutral-black">
              {title}
            </h2>
            <p className="text-sm text-neutral-black/60">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={handleOpenModal}
            className="relative -mt-1 -mr-1 rounded-full p-1 text-neutral-black/40 transition-colors hover:text-neutral-black/80"
            aria-label={`More information about ${title}`}
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {isLST ? (
          <>
            <p
              className={`h-full w-full text-center text-4xl font-bold sm:text-5xl ${textColor ?? ""}`}
            >
              {value}°C
            </p>
            <p className={`${textColor ?? ""} w-full text-right text-sm`}>
              {hasTrend ? `${trendLabel}°C` : "Citywide average"}
            </p>
          </>
        ) : (
          <>
            <HalfCircleBar value={value} />
            <p
              className={`w-full text-right text-sm ${hasTrend ? "text-primary-green" : "text-neutral-400"}`}
            >
              {hasTrend ? trendLabel : "Citywide average"}
            </p>
          </>
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
