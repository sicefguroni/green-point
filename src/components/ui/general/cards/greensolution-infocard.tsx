import { ReactNode, useState } from "react";
import HalfCircleBar from "../../dashboard/halfcirclebar";

interface GreenSolutionCardProps {
  solutionTitle: string;
  solutionDescription: string;
  shortDescription?: string; // Brief explanation shown on the card
  detailedDescription: string; 
  efficiencyLevel: string;
  efficiencyScore?: number; // New prop for dynamic score (0-100)
  icon: ReactNode;
  value: number;
  equityIndex?: number;
  cost?: number;
  impact?: number;
}

export default function GreenSolutionCard({
  solutionTitle,
  solutionDescription,
  shortDescription,
  detailedDescription,
  efficiencyLevel,
  efficiencyScore,
  icon,
  value,
  equityIndex,
  cost,
  impact,
}: GreenSolutionCardProps) {
  
  // Dynamic gradient based on efficiency score
  const getGradientStyle = (score: number) => {
    if (score >= 80) return {
      bg: "bg-gradient-to-br from-green-100 to-green-200",
      border: "border-green-400",
      text: "text-green-800",
      badge: "bg-green-500 text-white"
    };
    if (score >= 60) return {
      bg: "bg-gradient-to-br from-lime-100 to-lime-200",
      border: "border-lime-400",
      text: "text-lime-800",
      badge: "bg-lime-500 text-white"
    };
    if (score >= 40) return {
      bg: "bg-gradient-to-br from-yellow-100 to-yellow-200",
      border: "border-yellow-400",
      text: "text-yellow-800",
      badge: "bg-yellow-500 text-white"
    };
    return {
      bg: "bg-gradient-to-br from-orange-100 to-orange-200",
      border: "border-orange-400",
      text: "text-orange-800",
      badge: "bg-orange-500 text-white"
    };
  };

  // Use efficiencyScore if available, otherwise fallback to efficiencyLevel map (legacy)
  const style = efficiencyScore !== undefined 
    ? getGradientStyle(efficiencyScore)
    : {
        bg: "bg-gray-100",
        border: "border-gray-300",
        text: "text-gray-700",
        badge: "bg-gray-400 text-white"
      };

  const [isHover, setIsHover] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
        className={`flex flex-col items-center justify-between rounded-xl my-2 
        transition-all duration-200 border ${style.border} ${style.bg}
        hover:-translate-y-0.5 hover:shadow-md hover:shadow-neutral-200/50`}
      >
        <div className="flex flex-row items-center justify-between py-4 px-6 w-full">
          <div className="flex items-center space-x-5">
            <div
              className={`p-4 rounded-full bg-white/60 backdrop-blur-sm ${style.text}`}
            >
              {icon}
            </div>

            <div>
              <h3 className="text-neutral-black font-poppins font-semibold text-lg whitespace-nowrap overflow-hidden text-ellipsis">
                {solutionTitle}
              </h3>
              <p className="text-neutral-black/80 text-sm -mt-1 font-roboto mb-2">
                {solutionDescription}
              </p>
              {shortDescription && (
                <p className="text-neutral-black/60 text-xs font-roboto mb-2 italic line-clamp-2">
                  {shortDescription}
                </p>
              )}
              <span
                  className={`text-xs font-medium font-poppins px-2 py-0.5 rounded-full ${style.badge}`}
              >
                {efficiencyScore ? `Efficiency: ${efficiencyScore.toFixed(0)}%` : efficiencyLevel}
              </span>
            </div>
          </div>

          <div className="mb-2">
            <HalfCircleBar sizePx={100} min={0} max={100} value={value} trailColor="#ffffff80" pathColor={efficiencyScore && efficiencyScore > 70 ? "#16a34a" : "#ca8a04"} />
          </div>
        </div>

        <div
          onClick={() => setIsModalOpen(true)}
          className={`w-full flex items-center justify-center px-4 rounded-b-xl transition-all duration-300 overflow-hidden hover:bg-black/5 select-none cursor-pointer ${
            isHover ? "max-h-10 py-2 opacity-100" : "max-h-0 py-0 opacity-0"
          }`}
        >
          <p className="font-roboto text-xs font-medium text-neutral-700">See Details</p>
        </div>
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
                  className={`p-4 rounded-full bg-gray-100 ${style.text}`}
              >
                {icon}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-poppins font-semibold text-neutral-black">{solutionTitle}</h2>
                <span
                  className={`inline-block mt-2 text-xs font-medium font-poppins px-2 py-1 rounded-full ${style.badge}`}
                >
                   {efficiencyScore ? `Efficiency: ${efficiencyScore.toFixed(0)}%` : efficiencyLevel}
                </span>
              </div>
            </div>
            
            <div className="mb-6">
               <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-1">Why this intervention?</h4>
               <p className="text-neutral-black/80 font-roboto text-sm leading-relaxed italic">
                {detailedDescription}
              </p>
            </div>
           
            
            <div className="grid grid-cols-3 gap-4">
              {equityIndex !== undefined && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Equity Index</p>
                  <p className={`text-2xl font-semibold font-poppins ${
                    equityIndex >= 0.7 ? 'text-green-600' : 
                    equityIndex >= 0.4 ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {equityIndex.toFixed(2)}
                  </p>
                </div>
              )}
              {cost !== undefined && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Cost</p>
                  <p className={`text-2xl font-semibold font-poppins ${
                    cost <= 0.3 ? 'text-green-600' : 
                    cost <= 0.6 ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {cost.toFixed(2)}
                  </p>
                </div>
              )}
              {impact !== undefined && (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Impact</p>
                  <p className={`text-2xl font-semibold font-poppins ${
                    impact >= 0.7 ? 'text-green-600' : 
                    impact >= 0.4 ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
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
