import { getGreeneryClassColor, getTemperatureColor } from "@/lib/chloroplet-colors";

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
      className="w-full flex items-center justify-between bg-white/60 backdrop-blur-md 
                 border border-neutral-200 hover:border-green-300 transition-all
                 p-4 rounded-xl shadow-sm hover:shadow-md"
    >
      {/* Left side: Icon + label */}
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 flex items-center justify-center rounded-lg ${bgColor}`}
        >
          <Icon size={22} className={textColor} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-neutral-500 font-roboto leading-tight">
            {label}
          </span>
        </div>
      </div>

      {/* right side: value */}
      <div className="text-right">
        {isTemperature ? (
          <span
            className={`font-bold text-xl font-poppins ${textColor}`}
          >
            {value?.toFixed(0)}°C
          </span>
        ) : (
          <span
            className={`font-bold text-xl font-poppins ${textColor}`}
          >
            {value?.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
