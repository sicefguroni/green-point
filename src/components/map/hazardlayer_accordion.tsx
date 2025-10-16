import { ReactNode, useState } from "react";
import { Eye, EyeClosed } from "lucide-react";
import Accordion from "../ui/general/layout/accordion";

interface HazardAccordionProps {
  layername: string;
  layerId: string;
  isVisible: boolean;
  additionalContent?: ReactNode;
  onToggle: () => void;
  defaultColor: string;
  onColorChange?: (colors: string[]) => void;
}

export default function HazardAccordion({
  layername,
  isVisible,
  additionalContent,
  onToggle,
  defaultColor,
  onColorChange,
}: HazardAccordionProps)
{
  const [selectedMapName, setselectedMapName] = useState<string | null>(
    defaultColor || null
  );

  const ColorOptions = [
    {
      name: "Blue",
      mapColors: ["#48CAE4", "#0096C7", "#023E8A"]
    },
    {
      name: "Green",
      mapColors: ["#63DF6D", "#31C438", "#0F8519"]
    },
    {
      name: "Yellow",
      mapColors: ["#F0C954", "#E7BC10", "#CC8315"]
    },
    {
      name: "Red",
      mapColors: ["#F04C4C", "#D82828", "#60100b"]
    },
    {
      name: "Purple",
      mapColors: ["#AA5EF1", "#8531D3", "#6014A3"]
    },
  ];

  return (
    <Accordion 
      disabled = {!isVisible}
      leadingicon={
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
            // console.log('Layer toggled: ', layername)
            }
          }           
          className="p-1">
          {isVisible ? 
            <Eye            
            size={17}
            className="text-neutral-black/80
            hover:bg-neutral-black/5 
            rounded-full
            " 
            />
            :            
            <EyeClosed 
            size={17}
            className="text-neutral-black/30
            hover:bg-neutral-black/5 
            rounded-full
            "
            />  
          }                           
        </div>
      }
      title={layername}
      content={
        <div className="flex flex-col w-full my-2 gap-2">     
          <div className="mb-2">
            <span className="font-roboto text-sm">
              Color Scheme:
            </span>
            <div className="flex gap-5 p-2">                        
              {ColorOptions.map((option) => (
                <button 
                  key={option.name}
                  onClick={
                    () => {
                      setselectedMapName(option.name)
                      onColorChange?.(option.mapColors)
                    } 
                  }
                  className={`
                    w-5 h-5 rounded-full border-2 transition-all
                    ${
                      selectedMapName === option.name ? 'scale-105 border-neutral-black' 
                      : 'border-neutral-500 hover:border-neutral-black/60'
                    }
                  `}
                  style={{backgroundColor: option.mapColors[0]}}
                />            
              ))
              }
            </div>          
          </div>     
          {additionalContent}
        </div>
      }
    />
  )
}