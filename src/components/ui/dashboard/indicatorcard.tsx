import HalfCircleBar from "./halfcirclebar";
import { getTemperatureColor } from "@/lib/chloroplet-colors";

interface IndicatorCardProps {
  title: string;
  subtitle: string;
  value: number;
  trendValue: number;
  LST?: boolean;
}

export default function IndicatorCard({ title, subtitle, value, trendValue, LST = false}: IndicatorCardProps) {
  const classColor = LST ? getTemperatureColor(value) : '';
  const [textColor, bgColor] = classColor.split(' ');
  
  return (
    <div className="border flex-1 w-full bg-white shadow-md rounded-lg p-4 flex flex-col items-center justify-center gap-6">
      <div className="flex flex-col w-full text-left">
        <h2 className="text-neutral-black text-md font-semibold whitespace-nowrap">{title}</h2>
        <p className="text-neutral-black/50">{subtitle}</p>
      </div> 
      {LST ? (
        <>
          <p className={`h-full w-full text-center text-5xl font-bold ${textColor}`}>{value}°C</p>
          <p className={`${textColor} w-full text-right`}>+{trendValue}°C</p>
        </>
      ) : (
        <>
          <HalfCircleBar value={value} />
          <p className="text-primary-green w-full text-right">+{trendValue}</p>
        </>
      )}
      
    </div>
  )
}