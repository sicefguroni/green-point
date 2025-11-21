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
  // For tree canopy, use 0-40 range for gradient, otherwise 0-100
  const normalizedValue = label.includes("Tree Canopy") 
    ? Math.min(value / 40, 1) // Cap at 1.0 (40% = full green)
    : (label.includes("(%)") || (value > 1 && !isTemperature)) 
      ? value / 100 
      : value;

  const classColor = isTemperature
    ? getTemperatureColor(value)
    : getGreeneryClassColor(normalizedValue);

  const [textColor, bgColor] = classColor.split(" ");

return (
    <div
      className="
        w-full flex flex-col items-center justify-start 
        bg-white/70 backdrop-blur-md gap-2
        border border-neutral-300  
        rounded-2xl p-4
        transition-all
        hover:shadow-[0_2px_6px_rgba(0,0,0,0.08)]
        hover:border-green-300/70
        cursor-pointer
      "
    >  
      {/* icon */}
      <div>
        <div
          className={`p-5 flex items-center justify-center rounded-full 
            ${bgColor} bg-opacity-20`}
        >
          <Icon size={40} className={`${textColor}`} />
        </div>
      </div>
      
      {/* name  */}
      <span className="text-sm text-neutral-600 font-roboto leading-tight text-center mt-2">
        {label}
      </span>

      <div className="flex h-full items-end">
        <div className={`flex justify-end items-end  rounded-full`}>
          {isTemperature ? (
            <span className={`font-semibold text-xl font-poppins ${textColor}`}>
              {value?.toFixed(1)}°C
            </span>
          ) : (
            <span className={`font-semibold text-xl font-poppins ${textColor}`}>
              {value?.toFixed(2)}
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
