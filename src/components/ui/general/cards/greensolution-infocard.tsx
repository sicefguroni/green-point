import { Bookmark } from "lucide-react";
import HalfCircleBar from "../../dashboard/halfcirclebar";

interface GreenSolutionCardProps {
  solutionTitle: string;
  solutionDescription: string;
  efficiencyLevel: string;
  value: number;
  onViewDetails?: () => void;
  hideButton?: boolean;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
}

export default function GreenSolutionCard({
  solutionTitle,
  solutionDescription,
  efficiencyLevel,
  value,
  onViewDetails,
  hideButton,
  isSaved,
  onToggleSave,
}: GreenSolutionCardProps) {
  const efficienyColorMap: Record<string, Record<string, string>> = {
    "Highly Efficient": {
      bg: "bg-green-400",
      text: "text-green-900",
      border: "border-green-400",
      lighterbg: "bg-green-100/80 dark:bg-green-500/10",
      hoverbg: "hover:bg-green-100/20 dark:hover:bg-green-500/10",
      hex: "#16a34a",
    },
    "Moderately Efficient": {
      bg: "bg-yellow-400",
      text: "text-yellow-800",
      border: "border-yellow-400",
      lighterbg: "bg-yellow-100/80 dark:bg-yellow-500/10",
      hoverbg: "hover:bg-yellow-100/20 dark:hover:bg-yellow-500/10",
      hex: "#ca8a04",
    },
    "Not Efficient": {
      bg: "bg-red-400",
      text: "text-red-800",
      border: "border-red-400",
      lighterbg: "bg-red-100/80 dark:bg-red-500/10",
      hoverbg: "hover:bg-red-100/20 dark:hover:bg-red-500/10",
      hex: "#dc2626",
    },
  };

  return (
    <div
      className={`
          flex flex-col rounded-2xl my-2 overflow-hidden
          transition-all duration-300 border
          ${efficienyColorMap[efficiencyLevel].border}
          ${efficienyColorMap[efficiencyLevel].lighterbg}
          ${efficienyColorMap[efficiencyLevel].hoverbg}
          hover:-translate-y-0.5 hover:shadow-lg hover:shadow-neutral-200/40 dark:hover:shadow-black/30
          group/card
          ${hideButton ? "pointer-events-none" : ""}
        `}
    >
      <div className="flex items-center gap-5 p-5 w-full relative">
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center flex-wrap gap-1.5 mb-1">
            <h3 className="text-neutral-900 dark:text-neutral-50 font-bold text-sm leading-tight break-words">
              {solutionTitle}
            </h3>
            <span
              className={`
                  text-xs font-semibold px-2 py-0.5 rounded-full
                  ${efficienyColorMap[efficiencyLevel].bg} ${efficienyColorMap[efficiencyLevel].text}
                `}
            >
              {efficiencyLevel.split(" ")[0]}
            </span>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-xs font-medium leading-tight opacity-90 line-clamp-2">
            {solutionDescription}
          </p>
        </div>

        <div className="shrink-0 opacity-80 group-hover/card:opacity-100 transition-opacity ml-auto">
          <HalfCircleBar
            sizePx={70}
            min={0}
            max={100}
            value={Math.round(value)}
            trailColor="rgba(0,0,0,0.05)"
            pathColor={efficienyColorMap[efficiencyLevel].hex}
            textColor={efficienyColorMap[efficiencyLevel].hex}
          />
        </div>
      </div>

      {!hideButton && (
        <div className="flex border-t border-white/10 dark:border-white/5 mt-auto">
          <button
            onClick={() => onViewDetails?.()}
            className={`
                flex-1 flex items-center justify-center gap-2 bg-white/40 py-2.5 cursor-pointer
                hover:bg-white/60 dark:bg-neutral-950/40 dark:hover:bg-neutral-800/60 transition-all font-semibold text-xs text-neutral-500 dark:text-neutral-300
              `}
          >
            Project Details
          </button>
          {onToggleSave && (
            <button
              onClick={onToggleSave}
              className={`
                  px-4 border-l border-white/10 dark:border-white/5 bg-white/40
                  hover:bg-white/60 dark:bg-neutral-950/40 dark:hover:bg-neutral-800/60 transition-all
                  ${isSaved ? "text-primary-green" : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-100"}
                `}
              title={isSaved ? "Saved" : "Save this solution"}
            >
              <Bookmark size={16} className={isSaved ? "fill-current" : ""} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
