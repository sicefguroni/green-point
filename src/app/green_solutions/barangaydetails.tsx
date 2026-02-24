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
        w-full flex flex-col items-center justify-between
        bg-white/80 backdrop-blur-md gap-3
        border border-neutral-200
        rounded-2xl p-5
        transition-all duration-300
        hover:shadow-xl hover:shadow-neutral-200/40
        hover:border-primary-green/30
        group cursor-default
      "
    >
      <div
        className={`p-4 flex items-center justify-center rounded-2xl 
          ${bgColor} bg-opacity-10 group-hover:bg-opacity-20 transition-all duration-300`}
      >
        <Icon
          size={32}
          className={`${textColor} group-hover:scale-110 transition-transform duration-300`}
        />
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-center">
          {label}
        </span>

        <div className="flex items-baseline gap-0.5">
          {isTemperature ? (
            <span className={`font-bold text-2xl font-poppins ${textColor}`}>
              {value?.toFixed(0)}
            </span>
          ) : (
            <span className={`font-bold text-2xl font-poppins ${textColor}`}>
              {value?.toFixed(2)}
            </span>
          )}
          {isTemperature && (
            <span className={`text-sm font-bold ${textColor}`}>°C</span>
          )}
        </div>
      </div>
    </div>
  );
}
