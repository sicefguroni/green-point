"use client"

import Image from "next/image"
import MapboxMap from "@/components/map/mapbox_map"
import Navbar from "@/components/ui/general/layout/navbar"
import {Layers, X } from "lucide-react"
import { useState, useMemo} from "react"

import HazardLayers from "./hazardLayersPanel"
import MapTypes from "./mapTypePanel"
import { LayerId } from "@/types/maplayers"
import { defaultLayerVisibility, defaultLayerColors, mapStyles } from "@/config/mapConfig"

export default function MapPage() {
  const [isLayersActive, setIsLayersActive] = useState(false);
  const [layerColors, setLayerColors] = useState(defaultLayerColors);
  
  const [selectedMapType, setSelectedMapType] = useState('Default')
  const handleMapTypeSelect = (type: string) => {
    setSelectedMapType(type)
  }
  
  const [layerVisibility, setLayerVisibility] = useState(defaultLayerVisibility);
  const toggleLayerVisibility = (layerId: LayerId) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [layerId]: !prev[layerId],
    }));
  }

  // flood layer return periods 
  const [selectedFloodPeriod, setSelectedFloodPeriod] = useState('floodLayer100Yr')
  const floodPeriodChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFloodPeriod(event.target.value)    
  }

  // storm surge advisories
  const [selectedStormAdvisory, setSelectedStormAdvisory] = useState('stormLayerAdv1')
  const stormAdvisoryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedStormAdvisory(event.target.value)
  }

  const layerSpecificSelected = useMemo(() => ({
    floodLayer: selectedFloodPeriod,       
    stormLayer: selectedStormAdvisory,     
  }), [selectedFloodPeriod, selectedStormAdvisory]);


  // memoize the map so it doesnt blink when interacting with other components
  const mapComponent = useMemo(() => <MapboxMap 
    styleUrl={mapStyles[selectedMapType]}
    layerVisibility={layerVisibility}   
    layerColors={layerColors}
    layerSpecificSelected={layerSpecificSelected}
  />, 
  [selectedMapType, layerVisibility, layerColors, layerSpecificSelected]);  

  const changeLayerColor = (layerId: LayerId, colors: string[]) => {
    setLayerColors((prev) => ({
      ...prev,
      [layerId]: colors
    }));
    console.log("layerID:", layerId, "colors:", colors)
  }
  return (
    <main className="h-screen w-screen relative bg-gradient-to-br from-white to-green-100">
      {/* top nav bar */}
      <Navbar />
      <div className="h-full w-full flex overflow-hidden bg-neutral-500">                
        {mapComponent}
      </div>

      {/* bottom left buttons  */}
      <div className="absolute flex flex-col bottom-0 left-0 m-8 gap-3">
        {/* Layers Panel */}
        <div
          className={`py-2 px-4 rounded-xl
            bg-white/80 backdrop-blur-lg text-neutral-black/80        
            w-md overflow-hidden transition-all duration-300 ease-in-out transform
            flex flex-col items-center
            ${isLayersActive 
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' 
              : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}
          `}
        >                           
          {/* hazard Layers */}
          <div className="flex flex-col w-full gap-2 mt-3 max-h-80">
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
            
            <div className="overflow-y-auto [scrollbar-width:none]">              
              <HazardLayers 
                layerVisibility={layerVisibility}
                onToggle={toggleLayerVisibility}
                layerColors={layerColors}
                onColorChange={changeLayerColor}
                selectedFloodPeriod={selectedFloodPeriod}
                onFloodPeriodChange={floodPeriodChange}
                selectedStormAdvisory={selectedStormAdvisory}
                onStormAdvisoryChange={stormAdvisoryChange}
              />
            </div>
          </div>

          {/* Map Type */}
          <div className="flex flex-col w-full mt-8 gap-2">
            <span className="pl-3 font-roboto font-medium text-md text-start">
              Map Type
            </span>
            <hr className="border-t border-1 border-neutral-black/20 mb-4" />
            <MapTypes 
              onSelect={handleMapTypeSelect}
              selectedMapType={selectedMapType}
            />
          </div>
        </div>
        
        {/* Layers Button */}
        <div className={`py-3 px-4 rounded-xl
          bg-white/80 backdrop-blur-lg text-neutral-black/80 
          hover:bg-white/80 transition relative w-fit
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

