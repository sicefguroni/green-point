import { ReactNode, useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionProps {
  leadingicon?: ReactNode
  title: string;   
  content: ReactNode;
  disabled?: boolean
}

export default function Accordion({
  leadingicon,
  title,
  content,
  disabled = false,
}: AccordionProps)
{
  const [accordionOpen, setAccordionOpen] = useState(false);
  const handleToggle = () => {
    if(!disabled) setAccordionOpen(!accordionOpen)
    }

    useEffect(() => {
      if (disabled && accordionOpen) {
        setAccordionOpen(false);
      }
    }, [disabled]); 
    
  return (
    <div className={`flex flex-col items-center w-full rounded-lg
      ${accordionOpen ? 'bg-neutral-black/5' : 'bg-none'}
    `}>         
      <button
        onClick={() => handleToggle()}
        className={`py-2 px-3 flex justify-between w-full rounded-md 
          ${disabled ? 'hover:bg-red-300/40' : 'hover:bg-neutral-black/5'}`}
      >
        <div className="flex flex-row gap-4 items-center">
          {leadingicon}
          <span className={`font-roboto
            ${disabled ? 'text-neutral-black/50' : ' text-neutral-black'}
            `}>
            {title}
          </span>
        </div>
        <div className={`${accordionOpen ? 'rotate-180' : 'rotate-0'} transition-all duration-300`}>
          <ChevronDown 
            size={20}
            className={`
            ${disabled ? 'text-neutral-black/50' : ' text-neutral-black'}
            `}
          />
        </div>
      </button>
      <div className={`px-3 grid w-full overflow-hidden transition-all duration-500 ease-initial text-neutral-black/80 font-roboto
        ${
          accordionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }
      `}>
        <div className="overflow-hidden flex mx-10 ">
          {content}
        </div>
      </div>
    </div>
  )
}