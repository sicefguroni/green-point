import HalfCircleBar from "./halfcirclebar";

interface IndicatorCardProps {
  title: string;
  subtitle: string;
  value: number;
  trendValue: number;
}

export default function IndicatorCard({ title, subtitle, value, trendValue}: IndicatorCardProps) {
  return (
    <div className="h-fit w-full bg-white shadow-md rounded-lg p-4 flex flex-col items-center justify-center gap-6">
      <div className="flex flex-col w-full text-left">
        <h2 className="text-neutral-black text-md font-semibold whitespace-nowrap">{title}</h2>
        <p className="text-neutral-black/50">{subtitle}</p>
      </div> 
      <HalfCircleBar value={value} />
      <p className="text-primary-green w-full text-right">{trendValue}</p>
    </div>
  )
}