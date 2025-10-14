"use client"

import Image from "next/image"
import MapboxMap from "@/components/map/mapbox_map"
import Navbar from "@/components/ui/general/layout/navbar"
import { ZoomIn, ZoomOut, Compass, Search, Layers, X } from "lucide-react"
import { useState, useMemo} from "react"
import SearchBar from "@/components/ui/general/inputs/searchbar"
import HazardAccordion from "@/components/map/hazardlayer_accordion"
import MapTypeSelector from "@/components/map/maptye_selector"

export default function MapPage() {
  const [isLayersActive, setIsLayersActive] = useState(false);
  const [selectedMapType, setSelectedMapType] = useState('Default')
  
  const handleMapTypeSelect = (type: string) => {
    setSelectedMapType(type)
  }

  const mapStyles: Record<string, string> = {
    Default: "mapbox://styles/mapbox/standard",
    Light: "mapbox://styles/mapbox/light-v11",
    Dark: "mapbox://styles/mapbox/dark-v11",
    Satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  };

  type LayerId = "floodLayer" | "stormLayer" | "heatLayer" | "airLayer";
  
  // working with the layer visibilities
  const [layerVisibility, setLayerVisibility] = useState({
    floodLayer: true,
    stormLayer: false,
    heatLayer: false,
    airLayer: false
  })

  const toggleLayerVisibility = (layerId: LayerId) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [layerId]: !prev[layerId],
    }));
  }

  //working with layer colors
  const [layerColors, setLayerColors] = useState({
    floodLayer: ["#48CAE4", "#0096C7", "#023E8A"],
    stormLayer: ["#9333ea", "#a855f7", "#7e22ce"],
    heatLayer: ["#dc2626", "#ef4444", "#b91c1c"],
    airLayer: ["#16a34a", "#4ade80", "#22c55e"]
  })

  const changeLayerColor = (layerId: LayerId, colors: string[]) => {
    setLayerColors((prev) => ({
      ...prev,
      [layerId]: colors
    }));
  }

  // memoize the map so it doesnt blink when interacting with other components
  const mapComponent = useMemo(() => <MapboxMap 
    styleUrl={mapStyles[selectedMapType]}
    layerVisibility={layerVisibility}   
    layerColors={layerColors}
  />, 
  [selectedMapType, layerVisibility, layerColors]);  

  return (
    <main className="h-screen w-screen relative bg-gradient-to-br from-white to-green-100">
      {/* top nav bar */}
      <Navbar />
      <div className="h-full w-full flex overflow-hidden bg-neutral-500">                
        {mapComponent}
      </div>

      {/* search bar */}
      <div className="absolute top-26 left-0 ml-8 w-sm md:w-md">
        <SearchBar 
          placeholder="Search Locations"
        />

      </div>

      {/* bottom right buttons  */}
      <div className="absolute bottom-0 right-0 m-8 flex flex-col space-y-2"> 
        <div className="p-3 rounded-xl
          bg-white/60 backdrop-blur-lg text-neutral-black/80 
          hover:bg-white/70 transition
        ">
          <Compass 
            size={25}
            className="text-neutral-black/80"
          />
        </div>

        <div className="p-3 rounded-xl
          bg-white/60 backdrop-blur-lg text-neutral-black/80 
          hover:bg-white/70 transitiontransition
        ">
          <ZoomIn 
            size={25}
            className="text-neutral-black/80"
          />
        </div>

        <div className="p-3 rounded-xl
          bg-white/60 backdrop-blur-lg text-neutral-black/80 
          hover:bg-white/70 transition
        ">
          <ZoomOut 
            size={25}
            className="text-neutral-black/80"
          />
        </div>
      </div>

      {/* bottom left buttons  */}
      <div className="absolute flex flex-col bottom-0 left-0 m-8 gap-3">
        {/* Layers Panel */}
        <div
          className={`py-2 px-4 rounded-xl
            bg-white/60 backdrop-blur-lg text-neutral-black/80        
            w-md overflow-hidden transition-all duration-300 ease-in-out transform
            flex flex-col items-center
            ${isLayersActive 
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' 
              : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}
          `}
        >                           
          {/* hazard Layers */}
          <div className="flex flex-col w-full gap-2 mt-3">
            <div className="pl-3 flex flex-row justify-between w-full items-center">
              <span className="font-roboto font-medium text-center text-md ">
                Hazard Layers
              </span>
              <div className="rounded-full p-2 hover:bg-neutral-black/5">
                <X     
                  onClick={() => setIsLayersActive(false)}          
                  size={20}
                />
              </div>            
            </div> 

            <hr className="border-t border-1 border-neutral-black/20" />
            
            <HazardAccordion 
              layername="Flood Layer"     
              layerId="floodLayer"
              isVisible={layerVisibility.floodLayer}
              onToggle={() => toggleLayerVisibility('floodLayer')}
              defaultColor="Blue"
              onColorChange={(colors) => changeLayerColor('floodLayer', colors)}
            />      

            <HazardAccordion 
              layername="Storm Surge Layer"    
              layerId="stormLayer"
              isVisible={layerVisibility.stormLayer}
              onToggle={() => toggleLayerVisibility('stormLayer')}   
              defaultColor="Purple"
              onColorChange={(colors) => changeLayerColor('stormLayer', colors)}
            />  

            <HazardAccordion 
              layername="Urban Heat Island Layer"    
              layerId="heatLayer"
              isVisible={layerVisibility.heatLayer}
              onToggle={() => toggleLayerVisibility('heatLayer')}   
              defaultColor="Red"
              onColorChange={(colors) => changeLayerColor('heatLayer', colors)}
            />  

            <HazardAccordion 
              layername="Air Quality Layer"  
              layerId="airLayer"
              isVisible={layerVisibility.airLayer}
              onToggle={() => toggleLayerVisibility('airLayer')}      
              defaultColor="Green"
              onColorChange={(colors) => changeLayerColor('airLayer', colors)}
            />                 
          </div>

          {/* Map Type */}
          <div className="flex flex-col w-full mt-8 gap-2">
            <span className="pl-3 font-roboto font-medium text-md text-start">
              Map Type
            </span>
            <hr className="border-t border-1 border-neutral-black/20 mb-4" />
            <div className="grid grid-cols-3">
              <MapTypeSelector        
                type="Default" 
                onSelect={handleMapTypeSelect}   
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
                onSelect={handleMapTypeSelect}   
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
                onSelect={handleMapTypeSelect}   
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
                onSelect={handleMapTypeSelect}   
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
          </div>
        </div>
        
        {/* Layers Button */}
        <div className={`py-3 px-4 rounded-xl
          bg-white/60 backdrop-blur-lg text-neutral-black/80 
          hover:bg-white/70 transition relative w-fit
        ${isLayersActive ? 'hidden' : 'flex flex-col space-y-1 items-center justify-center'}
        `}
        onClick={() => setIsLayersActive(true)}
        >          
          <Layers 
            size={25}
            className="text-neutral-black/80"
          />
          <p className="font-medium font-robot text-neutral-black/80">
            Layers
          </p>
        </div>        
      </div>
		</main>
  )
}

