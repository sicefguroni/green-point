import { Info } from "lucide-react";
import HalfCircleBar from "./halfcirclebar";
import { getTemperatureColor } from "@/lib/chloroplet-colors";
import { useState } from "react";
import IndicatorInfoModal from "./info_modals";

interface IndicatorCardProps {
  title: string;
  subtitle: string;
  value: number;
  trendValue: number;
  description?: string;   
  LST?: boolean;
}


export default function IndicatorCard({
  title,
  subtitle,
  description,
  value,
  trendValue,
  LST = false,
}: IndicatorCardProps) {
  const classColor = LST ? getTemperatureColor(value) : "";
  const [textColor, bgColor] = classColor.split(" ");
  
  const [openModal, setOpenModal] = useState(false);

  return (
    <>
      <div className="border flex-1 w-full bg-white shadow-md rounded-lg p-4 flex flex-col items-center justify-center gap-6">
        <div className="flex flex-row justify-between items-start w-full">
          <div className="flex flex-col text-left">
            <h2 className="text-neutral-black text-md font-semibold whitespace-nowrap">
              {title}
            </h2>
            <p className="text-neutral-black/50">{subtitle}</p>
          </div>

          <button
            onClick={() => setOpenModal(true)}
            className="text-neutral-black/80 p-1 hover:bg-neutral-200/60 rounded-full transition-all duration-150 cursor-pointer -mt-1 -mr-1"
          >
            <Info />
          </button>
        </div>

        {LST ? (
          <>
            <p className={`h-full w-full text-center text-5xl font-bold ${textColor}`}>
              {value}°C
            </p>
            <p className={`${textColor} w-full text-right`}>+{trendValue}°C</p>
          </>
        ) : (
          <>
            <HalfCircleBar value={value} />
            <p className="text-primary-green w-full text-right">+{trendValue}</p>
          </>
        )}
      </div>

      {/* Popup Modal */}
      <IndicatorInfoModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={title}
        description={description ?? ''}
      />
    </>
  );
}
