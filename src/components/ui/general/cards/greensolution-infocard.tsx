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
}: GreenSolutionCardProps) {
  const efficienyColorMap: Record<string, Record<string, string>> = {
    "Highly Efficient": {
      bg: "bg-green-400",
      text: "text-green-900",
      border: "border-green-400",
      lighterbg: "bg-green-100/80",
      hoverbg: "hover:bg-green-100/20",
    },
    "Moderately Efficient": {
      bg: "bg-yellow-400",
      text: "text-yellow-800",
      border: "border-yellow-400",
      lighterbg: "bg-yellow-100/80",
      hoverbg: "hover:bg-yellow-100/20",
    },
    "Not Efficient": {
      bg: "bg-red-400",
      text: "text-red-800",
      border: "border-red-400",
      lighterbg: "bg-red-100/80",
      hoverbg: "hover:bg-red-100/20",
    },
  };

  const [isHover, setIsHover] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
        className={`
          flex flex-col rounded-2xl my-2 overflow-hidden
          transition-all duration-300 border
          ${efficienyColorMap[efficiencyLevel].border}
          ${efficienyColorMap[efficiencyLevel].lighterbg}
          ${efficienyColorMap[efficiencyLevel].hoverbg}
          hover:-translate-y-0.5 hover:shadow-lg hover:shadow-neutral-200/40
          group/card
          ${hideButton ? "pointer-events-none" : ""}
        `}
      >
        <div className="flex items-center gap-4 p-4 w-full">
          <div
            className={`
              p-3 rounded-xl shadow-sm transition-transform duration-300 group-hover/card:scale-105 shrink-0
              ${efficienyColorMap[efficiencyLevel].bg} ${efficienyColorMap[efficiencyLevel].text}
            `}
          >
            {icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-1.5 mb-1">
              <h3 className="text-neutral-900 font-bold text-sm leading-tight break-words">
                {solutionTitle}
              </h3>
              <span
                className={`
                  text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md
                  ${efficienyColorMap[efficiencyLevel].bg} ${efficienyColorMap[efficiencyLevel].text}
                `}
              >
                {efficiencyLevel.split(" ")[0]}
              </span>
            </div>
            <p className="text-neutral-500 text-[11px] font-bold leading-tight opacity-80">
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
            />
          </div>
        </div>

        {!hideButton && (
          <button
            onClick={() =>
              onViewDetails ? onViewDetails() : setIsModalOpen(true)
            }
            className={`
            w-full flex items-center justify-center gap-2 bg-white/40 py-2
            hover:bg-white/60 transition-all font-black text-[9px] uppercase tracking-[0.15em] text-neutral-400
          `}
          >
            Project Details
          </button>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
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
                <h2 className="text-2xl font-poppins font-semibold text-neutral-black">
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

            <p className="text-neutral-black/80 font-roboto text-sm leading-relaxed mb-6">
              {detailedDescription}
            </p>

            <div className="grid grid-cols-3 gap-4">
              {equityIndex !== undefined && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
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
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Cost
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
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Impact
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
