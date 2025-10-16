import { ReactNode } from "react";

interface MapTypeSelectorProps {
  type: string;
  image: ReactNode;
  selected: boolean;
  onSelect: (type:string) => void
}

export default function MapTypeSelector({
  type,
  image,
  selected,
  onSelect
}: MapTypeSelectorProps)
{  
  return (
    <div className="flex flex-col gap-2 items-center mb-2"
      onClick={() => onSelect(type)}
    >
      <div className={`rounded-md border-solid 
      transition-all
        hover:border-neutral-black/60 
          ${selected ? 'border-neutral-black scale-105 border-3' : 'border-neutral-black/50 border-2'}
        `}>
        <div className="w-14 h-14 relative overflow-hidden rounded-md">
          {image}
        </div>
      </div>
      <span className="text-center font-roboto text-sm">{type}</span>
    </div>
  ) 
}