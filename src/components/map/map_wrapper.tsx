"use client";

import { useState, useMemo, useCallback } from "react";
import { Layers, X, Camera, CircleHelp, Leaf } from "lucide-react";
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
  onUploadRequested?: () => void;
  onSelectionModeChange?: (mode: LocationSelectionMode) => void;
  bottomExpanded?: boolean;
}

export default function MapWrapper({
  searchBoxLocation,
  selectionMode = "poi",
  onFeatureSelected,
  onBarangaySelected,
  onMapReady,
  onUploadRequested,
  onSelectionModeChange,
  bottomExpanded = false,
}: MapWrapperProps) {
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);

  const [selectedMapType, setSelectedMapType] = useState("Default");
  const [layerColors, setLayerColors] = useState(defaultLayerColors);
  const [layerVisibility, setLayerVisibility] = useState(
    defaultLayerVisibility,
  );
  const [selectedFloodPeriod, setSelectedFloodPeriod] =
    useState("floodLayer100Yr");
  const [selectedStormAdvisory, setSelectedStormAdvisory] =
    useState("stormLayerAdv1");

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
    <div className="h-full w-screen relative bg-neutral-100 font-roboto">
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

      {isLayersPanelOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 sm:hidden"
          onClick={() => setIsLayersPanelOpen(false)}
        />
      )}

      <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 flex flex-col gap-3 items-start z-40">
        {/* Collapsible Selection + Upload control (mobile) */}
        {!bottomExpanded && (
          <div className="lg:hidden">
          {isSelectionOpen ? (
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl px-3 py-3 shadow-lg border border-white/30 w-[280px]">
              <div className="flex gap-2 mb-2">
                {(["poi", "barangay"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      onSelectionModeChange?.(mode);
                    }}
                    className={`flex-1 h-11 rounded-full text-sm font-bold transition-all ${
                      selectionMode === mode ? "bg-primary-green text-white" : "bg-white/80 text-neutral-700"
                    }`}
                  >
                    {mode === "poi" ? "Point of Interest" : "Barangay Area"}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUploadRequested?.()}
                  className="flex-1 bg-neutral-900 text-white py-2 rounded-xl text-sm font-bold hover:bg-neutral-800 flex items-center justify-center gap-2"
                >
                  <Camera size={16} />
                  Upload / Camera
                </button>

                <button className="p-2 rounded-xl bg-white/80 text-neutral-600">
                  <CircleHelp size={18} />
                </button>
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => setIsSelectionOpen(false)}
                  className="text-sm text-neutral-500"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsSelectionOpen(true)}
              className="flex items-center gap-2 bg-white/95 backdrop-blur-xl px-4 py-2.5 rounded-xl shadow-lg border border-white/30 hover:scale-105 transition-all"
            >
              <div className="w-7 h-7 rounded-lg bg-primary-green/10 flex items-center justify-center">
                <Leaf size={16} className="text-primary-green" />
              </div>
              <span className="font-semibold text-sm text-neutral-700">Select / Upload</span>
            </button>
          )}
          </div>
        )}
        <div
          className={`
            bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl
            w-full sm:w-[340px]
            max-h-[70vh] sm:max-h-[60vh]
            min-h-0
            flex flex-col
            transition-all duration-300 origin-bottom
            border border-white/30
            ${
              isLayersPanelOpen
                ? "opacity-100 scale-100 translate-y-0 rounded-t-3xl sm:rounded-2xl"
                : "opacity-0 scale-90 translate-y-4 pointer-events-none absolute rounded-2xl"
            }
          `}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary-green/10 flex items-center justify-center">
                <Layers size={18} className="text-primary-green" />
              </div>
              <h3 className="text-md font-semibold text-neutral-800 font-poppins">
                Map Options
              </h3>
            </div>
            <button
              onClick={() => setIsLayersPanelOpen(false)}
              className="
                p-1.5 hover:bg-neutral-100 rounded-lg transition-colors 
                text-neutral-400 hover:text-neutral-600
              "
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 [scrollbar-width:thin] [scrollbar-color:theme(colors.neutral.300)_transparent]">
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

            <div className="pt-3 border-t border-neutral-100 text-left">
              <span className="text-[9px] font-medium uppercase tracking-wider text-neutral-400 mb-2 block px-1 font-poppins">
                Base Map Style
              </span>
              <MapTypes
                onSelect={handleMapTypeSelect}
                selectedMapType={selectedMapType}
              />
            </div>
          </div>
        </div>

        {!isLayersPanelOpen && (
          <button
            onClick={() => setIsLayersPanelOpen(true)}
            className="
              flex items-center gap-2.5 bg-white/95 backdrop-blur-xl px-4 py-2.5
              rounded-xl shadow-lg border border-white/30 hover:scale-105 
              transition-all duration-200 group active:scale-95
            "
          >
            <div className="w-7 h-7 rounded-lg bg-primary-green/10 flex items-center justify-center group-hover:bg-primary-green/15 transition-colors">
              <Layers
                size={17}
                className="text-primary-green group-hover:rotate-12 transition-transform"
              />
            </div>
            <span className="font-semibold text-sm text-neutral-700">
              Map Options
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
