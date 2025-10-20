import { getGreeneryClassColor, getTemperatureColor } from "@/lib/chloroplet-colors";

interface BarangayGreeneryProps {
  icon: React.ElementType;
  valueName: string;
  value: number;
  LST?: boolean;
}

export default function BarangayGreenery({ icon: Icon, valueName, value, LST = false}: BarangayGreeneryProps) {
  const classColor = valueName === "Land Surface Temperature" ? getTemperatureColor(value) : getGreeneryClassColor(value);
  const [textColor, bgColor] = classColor.split(' ');

  return (
    <div className="h-full flex justify-between items-center gap-2 mb-2 border p-3 rounded-md">
      <div className="flex items-center gap-2">
        <div className={`w-fit h-fit p-2 rounded-md flex items-center justify-center ${bgColor}`}>
          <Icon size={20} className={textColor} />
        </div>
        <h1 className="text-neutral-black text-md font-medium">{valueName}</h1>
      </div>
      {LST ? <h1 className={`font-bold font-poppins text-xl ${textColor}`}>{value !== undefined ? `${value}°C` : ""}</h1> : 
      <h1 className={`font-bold font-poppins text-xl ${textColor}`}>{value !== null ? value : "N/A"}</h1>}
    </div>  
  )
}