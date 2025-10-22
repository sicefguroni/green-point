import { ReactNode } from "react";
import HalfCircleBar from "../../dashboard/halfcirclebar";

interface GreenSolutionCardProps {
  solutionTitle: string;
  solutionDescription: string;
  efficiencyLevel: string;
  value: number;
  icon: ReactNode;
}

export default function GreenSolutionCard({
  solutionTitle,
  solutionDescription,
  efficiencyLevel,
  icon,
  value,
}: GreenSolutionCardProps)
{
  const efficienyColorMap: Record<string, string> = {
    "Highly Efficient" : "bg-green-500 text-green-900",
    "Moderately Efficient" : "bg-yellow-400 text-yellow-800",
    "Not Efficient" : "bg-red-400 text-red-900",
  }

  const halfcircleColorMap: Record<string, string> = {
    "Highly Efficient" : "#00C950",
    "Moderately Efficient" : "#FDC700",
    "Not Efficient" : "#FF6467",
  }

  return (
    <section className="flex flex-row items-center justify-between bg-none p-4 rounded-xl my-2 
    transition-all duration-200
    hover:bg-neutral-100">
      <div className="flex items-center space-x-5">
        <div className={`p-4 rounded-xl ${efficienyColorMap[efficiencyLevel] || "bg-gray-300 text-gray-700"}`}>
          {icon}
        </div>

        <div>
          <h3 className="text-neutral-black font-poppins font-semibold text-xl
          whitespace-nowrap overflow-hidden text-ellipsis">
            {solutionTitle}
          </h3>
          <p className="text-neutral-black text-md -mt-1 font-roboto mb-2">
            {solutionDescription}
          </p>
          <span className={`${efficienyColorMap[efficiencyLevel] || "bg-gray-300 text-gray-700"} text-sm font-medium font-poppins px-2 py-0.5 rounded-md mt-3`}>
            {efficiencyLevel}
          </span>
        </div>
      </div>
      <HalfCircleBar 
        sizePx={120}
        min={0}
        max={100}
        value={value}                  
      />
    </section>
  );
}