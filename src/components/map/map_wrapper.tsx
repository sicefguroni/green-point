"use client";

import { useState, useMemo, useCallback } from "react";
import { Layers, X } from "lucide-react";
import HazardLayers from "@/components/map/panels/hazardLayersPanel";
import MapTypes from "@/components/map/panels/mapTypePanel";
import {
  defaultLayerVisibility,
  defaultLayerColors,
  mapStyles,
} from "@/config/mapConfig";
import { LayerId } from "@/types/maplayers";
import dynamic from "next/dynamic";
import { type LocationSelectionMode } from "@/types/maplayers";
import { SelectedFeature } from "@/types/metrics";

/**
 * Dynamically import MapboxMap to avoid SSR issues
 */
const MapboxMap = dynamic(() => import("./mapbox_map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-neutral-100 animate-pulse" />,
});

interface MapWrapperProps {
  searchBoxLocation: string;
  selectionMode?: LocationSelectionMode;
  onFeatureSelected?: (featureData: SelectedFeature) => void;
  onBarangaySelected?: (barangayName: string) => void;
  onMapReady?: (map: mapboxgl.Map, removeMarker: () => void) => void;
}

/**
 * Wrapper component for the Mapbox map.
 * Manages map state (layers, styles, selection) and overlay panels.
 */
export default function MapWrapper({
  searchBoxLocation,
  selectionMode = "poi",
  onFeatureSelected,
  onBarangaySelected,
  onMapReady,
}: MapWrapperProps) {
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);

  // Map configuration state
  const [selectedMapType, setSelectedMapType] = useState("Default");
  const [layerColors, setLayerColors] = useState(defaultLayerColors);
  const [layerVisibility, setLayerVisibility] = useState(
    defaultLayerVisibility,
  );
  const [selectedFloodPeriod, setSelectedFloodPeriod] =
    useState("floodLayer100Yr");
  const [selectedStormAdvisory, setSelectedStormAdvisory] =
    useState("stormLayerAdv1");

  // Handlers
  const handleMapTypeSelect = useCallback(
    (type: string) => setSelectedMapType(type),
    [],
  );

  const toggleLayerVisibility = useCallback((layerId: LayerId) => {
    setLayerVisibility((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  }, []);

  const changeLayerColor = useCallback((layerId: LayerId, colors: string[]) => {
    setLayerColors((prev) => ({ ...prev, [layerId]: colors }));
  }, []);

  const layerSpecificSelected = useMemo(
    () => ({
      floodLayer: selectedFloodPeriod,
      stormLayer: selectedStormAdvisory,
    }),
    [selectedFloodPeriod, selectedStormAdvisory],
  );

  return (
    <div className="h-full w-full relative bg-neutral-100 font-roboto">
      {/* Map Implementation */}
      <MapboxMap
        styleUrl={mapStyles[selectedMapType]}
        layerVisibility={layerVisibility}
        layerColors={layerColors}
        layerSpecificSelected={layerSpecificSelected}
        searchBoxLocation={searchBoxLocation}
        onFeatureSelected={onFeatureSelected}
        onBarangaySelected={onBarangaySelected}
        onMapReady={onMapReady}
        selectionMode={selectionMode}
      />

      {/* Overlays Container (Bottom Left) */}
      <div className="absolute bottom-8 left-8 flex flex-col gap-4 items-start z-20">
        {/* Layers Control Panel */}
        <div
          className={`
            bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-5 w-80 
            transition-all duration-300 origin-bottom-left border border-white/20
            ${isLayersPanelOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-4 pointer-events-none absolute"}
          `}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-neutral-800">Map Layers</h3>
            <button
              onClick={() => setIsLayersPanelOpen(false)}
              className="p-1.5 hover:bg-neutral-100 rounded-full transition-colors text-neutral-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Hazard Control Section */}
            <div>
              <HazardLayers
                layerVisibility={layerVisibility}
                onToggle={toggleLayerVisibility}
                onColorChange={changeLayerColor}
                selectedFloodPeriod={selectedFloodPeriod}
                onFloodPeriodChange={(e) =>
                  setSelectedFloodPeriod(e.target.value)
                }
                selectedStormAdvisory={selectedStormAdvisory}
                onStormAdvisoryChange={(e) =>
                  setSelectedStormAdvisory(e.target.value)
                }
              />
            </div>

            {/* Map Style Section */}
            <div className="pt-4 border-t border-neutral-100 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 block px-1">
                Base Map Style
              </label>
              <MapTypes
                onSelect={handleMapTypeSelect}
                selectedMapType={selectedMapType}
              />
            </div>
          </div>
        </div>

        {/* Floating Toggle Button */}
        {!isLayersPanelOpen && (
          <button
            onClick={() => setIsLayersPanelOpen(true)}
            className="
              flex items-center gap-3 bg-white/90 backdrop-blur-md px-5 py-3 
              rounded-2xl shadow-lg border border-white/20 hover:scale-105 
              transition-all duration-200 group active:scale-95
            "
          >
            <Layers
              size={22}
              className="text-primary-green group-hover:rotate-12 transition-transform"
            />
            <span className="font-bold text-neutral-700">Map Options</span>
          </button>
        )}
      </div>
    </div>
  );
}
