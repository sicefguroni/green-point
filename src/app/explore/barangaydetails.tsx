import {
  getGreeneryClassColor,
  getTemperatureColor,
} from "@/lib/chloroplet-colors";

interface BarangayMetricItemProps {
  icon: React.ElementType;
  label: string;
  value: number;
  metricType: "ndvi" | "lst" | "canopy" | "gi";
}

export default function BarangayMetricItem({
  icon: Icon,
  label,
  value,
  metricType,
}: BarangayMetricItemProps) {
  let classColor = "";

  if (metricType === "lst") {
    classColor =
      value >= 34
        ? "text-red-700 bg-red-100"
        : value >= 32
          ? "text-orange-600 bg-orange-100"
          : value >= 30
            ? "text-amber-500 bg-amber-100"
            : value >= 28
              ? "text-sky-500 bg-sky-100"
              : value >= 26
                ? "text-blue-600 bg-blue-100"
                : "text-indigo-700 bg-indigo-100";
  } else if (metricType === "ndvi") {
    classColor =
      value >= 0.6
        ? "text-emerald-700 bg-emerald-100"
        : value >= 0.4
          ? "text-green-500 bg-green-100"
          : value >= 0.2
            ? "text-yellow-500 bg-yellow-100"
            : "text-red-600 bg-red-100";
  } else if (metricType === "canopy") {
    classColor =
      value >= 0.8
        ? "text-emerald-800 bg-emerald-100"
        : value >= 0.6
          ? "text-green-700 bg-green-100"
          : value >= 0.4
            ? "text-green-500 bg-green-100"
            : value >= 0.2
              ? "text-lime-500 bg-lime-100"
              : "text-yellow-600 bg-yellow-100";
  } else {
    // Greenery Index
    classColor =
      value >= 0.7
        ? "text-emerald-700 bg-emerald-100"
        : value >= 0.55
          ? "text-green-500 bg-green-100"
          : value >= 0.4
            ? "text-lime-500 bg-lime-100"
            : value >= 0.25
              ? "text-yellow-500 bg-yellow-100"
              : value >= 0.1
                ? "text-orange-500 bg-orange-100"
                : "text-red-600 bg-red-100";
  }

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
          {metricType === "lst" ? (
            <span className={`font-black text-base font-poppins ${textColor}`}>
              {value?.toFixed(0)}
            </span>
          ) : metricType === "canopy" ? (
            <span className={`font-black text-base font-poppins ${textColor}`}>
              {(value! * 100).toFixed(1)}%
            </span>
          ) : (
            <span className={`font-black text-base font-poppins ${textColor}`}>
              {value?.toFixed(2)}
            </span>
          )}
          {metricType === "lst" && (
            <span className={`text-[9px] font-black ${textColor}`}>┬░C</span>
          )}
        </div>
      </div>
    </div>
  );
}
