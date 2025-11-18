import { ReactNode, useState } from "react";
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
  const efficienyColorMap: Record<string, Record<string, string>> = {
    "Highly Efficient" : {
      bg: "bg-green-400",
      text: "text-green-900",
      border: "border-green-400",
      lighterbg: "bg-green-100/80"    
    }    ,
    "Moderately Efficient" : {
      bg: "bg-yellow-400",
      text: "text-yellow-800",
      border: "border-yellow-400",
      lighterbg: "bg-yellow-100/80"    
    },    
    "Not Efficient" : {
      bg: "bg-red-400",
      text: "text-red-800",
      border: "border-red-400",
      lighterbg: "bg-red-100/80"    
    }
  }

  const halfcircleColorMap: Record<string, string> = {
    "Highly Efficient" : "#00C950",
    "Moderately Efficient" : "#FDC700",
    "Not Efficient" : "#FF6467",
  }

  const [isHover, setIsHover] = useState<boolean>(false) 

  return (
    <div 
    onMouseEnter={() => setIsHover(true)}
    onMouseLeave={() => setIsHover(false)}
    onFocus={() => setIsHover(true)}
    onBlur={() => setIsHover(false)}
    className={`flex flex-col items-center justify-between rounded-xl my-2 
    transition-all duration-200 border-1 ${efficienyColorMap[efficiencyLevel].border} ${efficienyColorMap[efficiencyLevel].lighterbg}
    hover:bg-neutral-100/50 hover:-translate-y-0.5 hover:shadow-md hover:shadow-neutral-200/50`}>
      <div className="flex flex-row items-center justify-between bg py-4 px-6 w-full">
        <div className="flex items-center space-x-5">
          <div
            className={`p-4 rounded-full ${
              efficienyColorMap[efficiencyLevel]
                ? `${efficienyColorMap[efficiencyLevel].bg} ${efficienyColorMap[efficiencyLevel].text}`
                : "bg-gray-300 text-gray-700"
            }`}
          >
            {icon}
          </div>


          <div>
            <h3 className="text-neutral-black font-poppins font-semibold text-lg
            whitespace-nowrap overflow-hidden text-ellipsis">
              {solutionTitle}
            </h3>
            <p className="text-neutral-black/80 text-sm -mt-1 font-roboto mb-2">
              {solutionDescription}
            </p>
            <span
              className={`text-xs font-medium font-poppins px-2 py-0.5 rounded-sm ${
                efficienyColorMap[efficiencyLevel]
                  ? `${efficienyColorMap[efficiencyLevel].bg} ${efficienyColorMap[efficiencyLevel].text}`
                  : "bg-gray-300 text-gray-700"
              }`}
            >
              {efficiencyLevel}
            </span>
          </div>
        </div>
        <div className="mb-2">
          <HalfCircleBar 
            sizePx={100}
            min={0}
            max={100}
            value={value}     
            trailColor="#F5F5F5FF"

          />
        </div>
      </div>
    
      <div
        className={`w-full flex items-center justify-center px-4 rounded-b-xl 
        transition-all duration-300 overflow-hidden hover:bg-neutral-200/70 select-none
        ${isHover ? "max-h-10 py-2 opacity-100" : "max-h-0 py-0 opacity-0"}`}
      >
        <p className="font-roboto text-xs font-medium ">See Details</p>
      </div>
    </div>
  );
}