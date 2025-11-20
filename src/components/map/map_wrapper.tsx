"use client";

import { useState, useMemo, useEffect } from "react";
import { Layers, X } from "lucide-react";
import HazardLayers from "@/components/map/panels/hazardLayersPanel";
import MapTypes from "@/components/map/panels/mapTypePanel";
import { defaultLayerVisibility, defaultLayerColors, mapStyles } from "@/config/mapConfig";
import { LayerId } from "@/types/maplayers";
import dynamic from "next/dynamic";
import { type LocationSelectionMode } from "@/types/maplayers"

const MapboxMap = dynamic(() => import("./mapbox_map"), { ssr: false });

interface SelectedFeature {
  name: string; 
  address: string; 
  coords: {
    lng: number;
    lat: number;
  };
  properties?: mapboxgl.GeoJSONFeature["properties"];
  barangay: string;  
}

interface MapWrapperProps {
  searchBoxLocation: string;
  selectionMode?: LocationSelectionMode;
  onFeatureSelected?: (featureData: SelectedFeature) => void; 
  onBarangaySelected?: (barangayName: string) => void;
  onMapReady?: (map: mapboxgl.Map, removeMarker: () => void) => void;
}

export default function MapWrapper({
  searchBoxLocation,
  selectionMode = "poi",
  onFeatureSelected,
  onBarangaySelected,
  onMapReady,
}: MapWrapperProps) {

  const [isLayersActive, setIsLayersActive] = useState(false);

  //map state
  const [selectedMapType, setSelectedMapType] = useState("Default");
  const [layerColors, setLayerColors] = useState(defaultLayerColors);
  const [layerVisibility, setLayerVisibility] = useState(defaultLayerVisibility);
  const [selectedFloodPeriod, setSelectedFloodPeriod] = useState("floodLayer100Yr");
  const [selectedStormAdvisory, setSelectedStormAdvisory] = useState("stormLayerAdv1");

  const handleMapTypeSelect = (type: string) => setSelectedMapType(type);
  const toggleLayerVisibility = (layerId: LayerId) => {
    setLayerVisibility(prev => ({ ...prev, [layerId]: !prev[layerId] }));
  };
  const changeLayerColor = (layerId: LayerId, colors: string[]) => {
    setLayerColors(prev => ({ ...prev, [layerId]: colors }));
  };

  const layerSpecificSelected = useMemo(() => ({
    floodLayer: selectedFloodPeriod,
    stormLayer: selectedStormAdvisory,    
  }), [selectedFloodPeriod, selectedStormAdvisory]);

  const mapComponent = useMemo(() => (
    <MapboxMap
      styleUrl={mapStyles[selectedMapType]}
      layerVisibility={layerVisibility}
      layerColors={layerColors}
      layerSpecificSelected={layerSpecificSelected}
      searchBoxLocation={searchBoxLocation}
      onFeatureSelected={onFeatureSelected}     
      onBarangaySelected={onBarangaySelected} 
      onMapReady={(map, removeMarker) => {
        onMapReady?.(map, removeMarker);
      }}
      selectionMode={selectionMode}
    />
  ), [selectedMapType, layerVisibility, layerColors, layerSpecificSelected, selectionMode]);


  return (
    <div className="h-full w-full relative bg-white">
      {mapComponent}

      {/* bottom-left area */}
      <div className="absolute flex flex-col bottom-0 left-0 m-8 gap-3 overflow-hidden">
        {/* Panel */}
        <div
          className={`py-2 px-4 rounded-xl bg-white/80 backdrop-blur-lg text-neutral-black/80 w-md
            transition-all duration-300 ease-in-out transform 
            ${isLayersActive ? 'opacity-100 scale-100 pointer-events-auto' : 'hidden'}`}
        >
          <div className="flex flex-row justify-between items-center mb-2">
            <span className="font-roboto font-medium text-md">Map Layers</span>
            <div className="rounded-full p-2 hover:bg-neutral-black/5">
              <X onClick={() => setIsLayersActive(false)} size={20} />
            </div>
          </div>

          <hr className="border-t border-1 border-neutral-black/20 mb-3" />

          {/* Hazard Layers */}
          <HazardLayers
            layerVisibility={layerVisibility}
            onToggle={toggleLayerVisibility}
            onColorChange={changeLayerColor}
            selectedFloodPeriod={selectedFloodPeriod}
            onFloodPeriodChange={e => setSelectedFloodPeriod(e.target.value)}
            selectedStormAdvisory={selectedStormAdvisory}
            onStormAdvisoryChange={e => setSelectedStormAdvisory(e.target.value)}
          />

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
        {!isLayersActive && (
          <div
            className="py-3 px-4 rounded-xl bg-white/80 backdrop-blur-lg text-neutral-black/80 
              hover:bg-white transition flex flex-col items-center max-w-20"
            onClick={() => setIsLayersActive(true)}
          >
            <Layers size={25} className="text-neutral-black/80" />
            <p className="font-medium font-roboto text-neutral-black/80">Layers</p>
          </div>
        )}
      </div>
    </div>
  );
}
