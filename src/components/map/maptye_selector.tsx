import { ReactNode } from "react";

interface MapTypeSelectorProps {
  type: string;
  image: ReactNode;
  selected: boolean;
  onSelect: (type: string) => void;
}

export default function MapTypeSelector({
  type,
  image,
  selected,
  onSelect,
}: MapTypeSelectorProps) {
  return (
    <div
      className="mb-2 flex flex-col items-center gap-2"
      onClick={() => onSelect(type)}
    >
      <div
        className={`rounded-md border-solid 
      transition-all
        hover:border-neutral-black/60 dark:hover:border-neutral-200/60 
          ${selected ? "border-neutral-black scale-105 border-3 dark:border-neutral-100" : "border-neutral-black/50 border-2 dark:border-neutral-600"}
        `}
      >
        <div className="w-14 h-14 relative overflow-hidden rounded-md">
          {image}
        </div>
      </div>
      <span className="text-center text-[11px] font-medium text-neutral-600 font-poppins dark:text-neutral-300">
        {type}
      </span>
    </div>
  );
}
