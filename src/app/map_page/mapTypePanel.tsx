import MapTypeSelector from "@/components/map/maptye_selector"
import Image from "next/image";

interface MapTypeProps {
  onSelect: (type: string) => void;
  selectedMapType: string;
}

export default function MapTypes({
  onSelect,
  selectedMapType
}: MapTypeProps) {
  return (
    <div className="grid grid-cols-4">
      <MapTypeSelector        
        type="Default" 
        onSelect={onSelect}   
        selected={selectedMapType === 'Default'}
        image={
          <Image 
            src={"/images/type-default.png"}
            alt="Default Type"
            fill
            className="object-cover"
          />
        }                
      />

      <MapTypeSelector        
        type="Satellite" 
        onSelect={onSelect}   
        selected={selectedMapType === 'Satellite'}
        image={
          <Image 
            src={"/images/type-satellite.png"}
            alt="Satellite Type"
            fill
            className="object-cover"                
          />
        }
      />

      <MapTypeSelector        
        type="Dark" 
        onSelect={onSelect}   
        selected={selectedMapType === 'Dark'}
        image={
          <Image 
            src={"/images/type-dark.png"}
            alt="Dark Type"
            fill
            className="object-cover"
          />
        }
      />
      
      <MapTypeSelector        
        type="Light" 
        onSelect={onSelect}   
        selected={selectedMapType === 'Light'}
        image={
          <Image 
            src={"/images/type-light.png"}
            alt="Light Type"
            fill
            className="object-cover"
          />
        }
      />
    </div>
  )
}