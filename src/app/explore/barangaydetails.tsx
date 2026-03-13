import {
  getGreeneryClassColor,
  getTemperatureColor,
} from "@/lib/chloroplet-colors";

interface BarangayMetricItemProps {
  icon: React.ElementType;
  label: string;
  value: number;
  isTemperature?: boolean;
}

export default function BarangayMetricItem({
  icon: Icon,
  label,
  value,
  isTemperature = false,
}: BarangayMetricItemProps) {
  const classColor = isTemperature
    ? getTemperatureColor(value)
    : getGreeneryClassColor(value);

  const [textColor, bgColor] = classColor.split(" ");

  return (
    <div
      className="
        w-full flex items-center gap-3
        bg-white/80 backdrop-blur-md
        border border-neutral-200
        rounded-2xl p-3
        transition-all duration-300
        hover:shadow-xl hover:shadow-neutral-200/40
        hover:border-primary-green/30
        group cursor-default
      "
    >
      <div
        className={`p-2.5 flex items-center justify-center rounded-xl 
          ${bgColor} bg-opacity-10 group-hover:bg-opacity-20 transition-all duration-300 shrink-0`}
      >
        <Icon
          size={20}
          className={`${textColor} group-hover:scale-110 transition-transform duration-300`}
        />
      </div>

      <div className="flex flex-col items-start gap-0 min-w-0">
        <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest truncate w-full">
          {label}
        </span>

        <div className="flex items-baseline gap-0.5">
          {isTemperature ? (
            <span className={`font-black text-base font-poppins ${textColor}`}>
              {value?.toFixed(0)}
            </span>
          ) : (
            <span className={`font-black text-base font-poppins ${textColor}`}>
              {value?.toFixed(2)}
            </span>
          )}
          {isTemperature && (
            <span className={`text-[9px] font-black ${textColor}`}>°C</span>
          )}
        </div>
      </div>
    </div>
  );
}
