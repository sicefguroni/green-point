import HazardAccordion from "@/components/map/hazardlayer_accordion";
import { LayerId } from "@/types/maplayers"

interface LayerVisibility { 
    [layerId: string]: boolean;
}

interface LayerColors {
    [layerId: string]: string[];
}

interface HazardLayersProps {
  layerVisibility: LayerVisibility;
  onToggle: (layerId: LayerId) => void; 
  layerColors: LayerColors;
  onColorChange: (layerId: LayerId, colors:string[]) => void;
  selectedFloodPeriod: string; 
  onFloodPeriodChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedStormAdvisory: string; 
  onStormAdvisoryChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function HazardLayers ({
  layerVisibility, 
  onToggle,
  layerColors, 
  onColorChange,
  selectedFloodPeriod,
  onFloodPeriodChange,
  selectedStormAdvisory,
  onStormAdvisoryChange
}: HazardLayersProps) {

  return (
    <div>
      <HazardAccordion 
        layername="Flood Layer"     
        layerId="floodLayer"
        isVisible={layerVisibility.floodLayer}
        onToggle={() => onToggle('floodLayer')}
        defaultColor="Blue"
        onColorChange={(colors) => onColorChange('floodLayer', colors)}
        additionalContent={
          <div className="flex flex-col gap-1">            
            <span className="font-roboto text-sm">Rain Return Periods:</span>
            {[
              {id: "floodLayer5Yr", label: "5 Year", value: "floodLayer5Yr"}, //the values should equal the id in the map
              {id: "floodLayer25Yr", label: "25 Year", value: "floodLayer25Yr"},
              {id: "floodLayer100Yr", label: "100 Year", value: "floodLayer100Yr"},
            ].map(({id, label, value}) => (
              <label key={id} htmlFor={id}
              className="flex items-center gap-3 hover:bg-neutral-black/5 px-2 
              rounded-sm transition-all duration-100 text-sm"
              >
                <input 
                  type="radio"
                  id={id}
                  name="floodRadioGroup"
                  value={value}
                  checked={selectedFloodPeriod === value}
                  onChange={onFloodPeriodChange}                                                       
                  className={` w-3 h-3 
                  appearance-none rounded-full
                  border border-neutral-black/60
                checked:bg-green-600
                  transition-all duration-200
                  hover:border-neutral-black                  
                  `} 
                />
                {label}
              </label>
            ))}
          </div>
        }
      />      

      <HazardAccordion 
        layername="Storm Surge Layer"    
        layerId="stormLayer"
        isVisible={layerVisibility.stormLayer}
        onToggle={() => onToggle('stormLayer')}   
        defaultColor="Purple"
        onColorChange={(colors) => onColorChange('stormLayer', colors)}
        additionalContent={
          <div className="flex flex-col gap-1">            
            <span className="font-roboto text-sm">Advisory Level:</span>
            {[
              {id: "stormLayerAdv1", label: "Advisory 1", value: "stormLayerAdv1"},
              {id: "stormLayerAdv2", label: "Advisory 2", value: "stormLayerAdv2"},
              {id: "stormLayerAdv3", label: "Advisory 3", value: "stormLayerAdv3"},
              {id: "stormLayerAdv4", label: "Advisory 4", value: "stormLayerAdv4"},
            ].map(({id, label, value}) => (
              <label key={id} htmlFor={id}
              className="flex items-center gap-3 hover:bg-neutral-black/5 px-2 
              rounded-sm transition-all duration-100 text-sm"
              >
                <input 
                  type="radio"
                  id={id}
                  name="stormRadioGroup"
                  value={value}
                  checked={selectedStormAdvisory === value}
                  onChange={onStormAdvisoryChange}                                                       
                  className={` w-3 h-3 
                  appearance-none rounded-full
                  border border-neutral-black/60
                checked:bg-green-600
                  transition-all duration-200
                  hover:border-neutral-black                  
                  `} 
                />
                {label}
              </label>
            ))}
          </div>
        }
      />  

      <HazardAccordion 
        layername="Land Surface Temperature Layer"    
        layerId="heatLayer"
        isVisible={layerVisibility.heatLayer}
        onToggle={() => onToggle('heatLayer')}   
        defaultColor="Red"
        onColorChange={(colors) => onColorChange('heatLayer', colors)}
      />  

      <HazardAccordion 
        layername="Air Quality Layer"  
        layerId="airLayer"
        isVisible={layerVisibility.airLayer}
        onToggle={() => onToggle('airLayer')}      
        defaultColor="Green"
        onColorChange={(colors) => onColorChange('airLayer', colors)}
      />                 
    </div>
  )
}