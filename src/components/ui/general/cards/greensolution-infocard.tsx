import { ReactNode, useState } from "react";
import HalfCircleBar from "../../dashboard/halfcirclebar";

interface GreenSolutionCardProps {
  solutionTitle: string;
  solutionDescription: string;
  detailedDescription: string; // New prop for detailed info
  efficiencyLevel: string;
  icon: ReactNode;
  value: number;
  equityIndex?: number;
  cost?: number;
  impact?: number;
  /**
   * When provided, clicking "View Technical Specs" calls this handler
   * instead of opening the built-in modal — used by the sidebar-swap pattern.
   */
  onViewDetails?: () => void;
  /** If true, the bottom "Project Details" button is hidden */
  hideButton?: boolean;
  justification?: string;
  recommendedSpecies?: string;
}

export default function GreenSolutionCard({
  solutionTitle,
  solutionDescription,
  detailedDescription,
  efficiencyLevel,
  icon,
  value,
  equityIndex,
  cost,
  impact,
  onViewDetails,
  hideButton,
  justification,
  recommendedSpecies,
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

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
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
        <div className="flex items-center gap-5 p-5 w-full">
          <div className="flex-1 min-w-0">
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
              value={value}
              trailColor="rgba(0,0,0,0.05)"
              pathColor={efficienyColorMap[efficiencyLevel].hex}
              textColor={efficienyColorMap[efficiencyLevel].hex}
            />
          </div>
        </div>

        {!hideButton && (
          <button
            onClick={() =>
              onViewDetails ? onViewDetails() : setIsModalOpen(true)
            }
            className={`
            w-full flex items-center justify-center gap-2 bg-white/40 py-2.5
            hover:bg-white/60 dark:bg-neutral-950/40 dark:hover:bg-neutral-800/60 transition-all font-semibold text-xs text-neutral-500 dark:text-neutral-300
          `}
          >
            Project Details
          </button>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/50 p-8 max-w-lg w-full mx-4 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 dark:text-neutral-400 hover:text-gray-600 dark:hover:text-neutral-100 transition-colors"
            >
              ✕
            </button>

            <div className="flex items-center space-x-4 mb-6">
              <div
                className={`p-4 rounded-full ${
                  efficienyColorMap[efficiencyLevel]
                    ? `${efficienyColorMap[efficiencyLevel].bg} ${efficienyColorMap[efficiencyLevel].text}`
                    : "bg-gray-300 text-gray-700"
                }`}
              >
                {icon}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-poppins font-semibold text-neutral-black dark:text-neutral-50">
                  {solutionTitle}
                </h2>
                <span
                  className={`inline-block mt-2 text-xs font-medium font-poppins px-2 py-1 rounded-sm ${
                    efficienyColorMap[efficiencyLevel]
                      ? `${efficienyColorMap[efficiencyLevel].bg} ${efficienyColorMap[efficiencyLevel].text}`
                      : "bg-gray-300 text-gray-700"
                  }`}
                >
                  {efficiencyLevel}
                </span>
              </div>
            </div>

            <p className="text-neutral-black/80 dark:text-neutral-300 font-roboto text-sm leading-relaxed mb-6">
              {detailedDescription}
            </p>

            {justification && (
              <div className="mb-6 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-100 dark:border-neutral-800">
                <p className="text-xs font-semibold text-neutral-400 mb-2">
                  Justification
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 italic">
                  &ldquo;{justification}&rdquo;
                </p>
              </div>
            )}

            {recommendedSpecies && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-neutral-400 mb-2">
                  Recommended Species
                </p>
                <div className="flex flex-wrap gap-2">
                  {recommendedSpecies.split(/,\s*(?![^()]*\))/).map((s: string) => (
                    <span
                      key={s}
                      className="inline-block rounded-xl bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 border border-green-100 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/20 shadow-sm"
                    >
                      {s.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              {equityIndex !== undefined && (
                <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 text-center">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                    Equity Index
                  </p>
                  <p
                    className={`text-2xl font-semibold font-poppins ${
                      equityIndex >= 0.7
                        ? "text-green-600"
                        : equityIndex >= 0.4
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  >
                    {equityIndex.toFixed(2)}
                  </p>
                </div>
              )}
              {cost !== undefined && (
                <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 text-center">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                    Cost Index
                  </p>
                  <p
                    className={`text-2xl font-semibold font-poppins ${
                      cost <= 0.3
                        ? "text-green-600"
                        : cost <= 0.6
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  >
                    {cost.toFixed(2)}
                  </p>
                </div>
              )}
              {impact !== undefined && (
                <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 text-center">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                    Impact Score
                  </p>
                  <p
                    className={`text-2xl font-semibold font-poppins ${
                      impact >= 0.7
                        ? "text-green-600"
                        : impact >= 0.4
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  >
                    {impact.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
