interface BarangayGreeneryProps {
  icon: React.ReactNode;
  valueName: string;
  value: number;
}

export default function BarangayGreenery({ icon, valueName, value }: BarangayGreeneryProps) {
  return (
    <div className="flex justify-between items-center gap-2 mb-2 border p-3 rounded-md">
      <div className="flex items-center gap-2">
        <div className="w-fit h-fit bg-primary-green/80 p-2 rounded-md flex items-center justify-center">
          {icon}
        </div>
        <h1 className="text-neutral-black text-sm font-medium">{valueName}</h1>
      </div>
      <h1 className="text-primary-green font-bold font-poppins text-xl">{value}</h1>
    </div>  
  )
}