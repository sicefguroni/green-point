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
  const { textColor, bgColor } = getMetricToneClasses(metricType, value);

  return (
    <div
      className="
        w-full flex items-center gap-3
        bg-white/80 backdrop-blur-md dark:bg-neutral-900/70
        border border-neutral-200 dark:border-neutral-800
        rounded-2xl p-3
        transition-all duration-300
        hover:shadow-xl hover:shadow-neutral-200/40 dark:hover:shadow-black/30
        hover:border-primary-green/30 dark:hover:border-primary-green/40
        group cursor-default
      "
    >
      <div
        className={`p-2.5 flex items-center justify-center rounded-xl transition-all duration-300 shrink-0 ${bgColor}`}
      >
        <Icon size={20} className={`${textColor} group-hover:scale-110 transition-transform duration-300`} />
      </div>

      <div className="flex flex-col items-start gap-0 min-w-0">
        <span className="text-[9px] font-black uppercase tracking-widest truncate w-full text-neutral-400 dark:text-neutral-500">
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
            <span className={`text-[9px] font-black ${textColor}`}>°C</span>
          )}
        </div>
      </div>
    </div>
  );
}

function getMetricToneClasses(
  metricType: BarangayMetricItemProps["metricType"],
  value: number,
) {
  if (metricType === "lst") {
    return value >= 34
      ? {
          textColor: "text-red-700 dark:text-red-400",
          bgColor: "bg-red-100 dark:bg-red-500/15",
        }
      : value >= 32
        ? {
            textColor: "text-orange-600 dark:text-orange-400",
            bgColor: "bg-orange-100 dark:bg-orange-500/15",
          }
        : value >= 30
          ? {
              textColor: "text-amber-500 dark:text-amber-300",
              bgColor: "bg-amber-100 dark:bg-amber-500/15",
            }
          : value >= 28
            ? {
                textColor: "text-sky-500 dark:text-sky-300",
                bgColor: "bg-sky-100 dark:bg-sky-500/15",
              }
            : value >= 26
              ? {
                  textColor: "text-blue-600 dark:text-blue-300",
                  bgColor: "bg-blue-100 dark:bg-blue-500/15",
                }
              : {
                  textColor: "text-indigo-700 dark:text-indigo-300",
                  bgColor: "bg-indigo-100 dark:bg-indigo-500/15",
                };
  }

  if (metricType === "ndvi") {
    return value >= 0.6
      ? {
          textColor: "text-emerald-700 dark:text-emerald-300",
          bgColor: "bg-emerald-100 dark:bg-emerald-500/15",
        }
      : value >= 0.4
        ? {
            textColor: "text-green-500 dark:text-green-300",
            bgColor: "bg-green-100 dark:bg-green-500/15",
          }
        : value >= 0.2
          ? {
              textColor: "text-yellow-500 dark:text-yellow-300",
              bgColor: "bg-yellow-100 dark:bg-yellow-500/15",
            }
          : {
              textColor: "text-red-600 dark:text-red-400",
              bgColor: "bg-red-100 dark:bg-red-500/15",
            };
  }

  if (metricType === "canopy") {
    return value >= 0.8
      ? {
          textColor: "text-emerald-800 dark:text-emerald-300",
          bgColor: "bg-emerald-100 dark:bg-emerald-500/15",
        }
      : value >= 0.6
        ? {
            textColor: "text-green-700 dark:text-green-300",
            bgColor: "bg-green-100 dark:bg-green-500/15",
          }
        : value >= 0.4
          ? {
              textColor: "text-green-500 dark:text-green-300",
              bgColor: "bg-green-100 dark:bg-green-500/15",
            }
          : value >= 0.2
            ? {
                textColor: "text-lime-500 dark:text-lime-300",
                bgColor: "bg-lime-100 dark:bg-lime-500/15",
              }
            : {
                textColor: "text-yellow-600 dark:text-yellow-300",
                bgColor: "bg-yellow-100 dark:bg-yellow-500/15",
              };
  }

  return value >= 0.7
    ? {
        textColor: "text-emerald-700 dark:text-emerald-300",
        bgColor: "bg-emerald-100 dark:bg-emerald-500/15",
      }
    : value >= 0.55
      ? {
          textColor: "text-green-500 dark:text-green-300",
          bgColor: "bg-green-100 dark:bg-green-500/15",
        }
      : value >= 0.4
        ? {
            textColor: "text-lime-500 dark:text-lime-300",
            bgColor: "bg-lime-100 dark:bg-lime-500/15",
          }
        : value >= 0.25
          ? {
              textColor: "text-yellow-500 dark:text-yellow-300",
              bgColor: "bg-yellow-100 dark:bg-yellow-500/15",
            }
          : value >= 0.1
            ? {
                textColor: "text-orange-500 dark:text-orange-300",
                bgColor: "bg-orange-100 dark:bg-orange-500/15",
              }
            : {
                textColor: "text-red-600 dark:text-red-400",
                bgColor: "bg-red-100 dark:bg-red-500/15",
              };
}
