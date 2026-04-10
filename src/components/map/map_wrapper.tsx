"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Layers,
  X,
  Camera,
  MapPin,
  SquareDashed,
  PenLine,
} from "lucide-react";
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
  selectedCustomArea?: GeoJSON.Polygon | null;
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
  selectedCustomArea = null,
  onFeatureSelected,
  onBarangaySelected,
  onMapReady,
  onUploadRequested,
  onSelectionModeChange,
  bottomExpanded = false,
}: MapWrapperProps) {
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);

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
        selectedCustomArea={selectedCustomArea}
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

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-4 items-center z-40 w-[calc(100%-2rem)] max-w-lg">
        {/* Collapsible Selection + Upload control*/}
        {!bottomExpanded && (
          <div className="w-full flex flex-col items-center gap-3">
            <div className="flex w-full justify-center">
              <div className="bg-white/90 backdrop-blur-2xl px-2 py-2 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/60 flex items-center gap-1 w-full sm:w-auto">
                {(["poi", "barangay", "custom"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onSelectionModeChange?.(mode)}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
                      selectionMode === mode
                        ? "bg-neutral-900 text-white shadow-lg scale-105"
                        : "text-neutral-500 hover:bg-neutral-100"
                    }`}
                  >
                    {mode === "poi" ? (
                      <>
                        <MapPin size={14} />
                        <span>Pin</span>
                      </>
                    ) : mode === "barangay" ? (
                      <>
                        <SquareDashed size={14} />
                        <span>Barangay</span>
                      </>
                    ) : (
                      <>
                        <PenLine size={14} />
                        <span>Lasso</span>
                      </>
                    )}
                  </button>
                ))}

                <div className="w-px h-6 bg-neutral-200 mx-1 sm:block" />

                <button
                  onClick={() => onUploadRequested?.()}
                  className="p-2.5 bg-primary-green text-white rounded-2xl shadow-lg shadow-green-200 hover:scale-110 active:scale-95 transition-all flex items-center gap-2 px-4"
                >
                  <Camera size={18} />
                  <span className="text-xs font-bold sm:inline hidden">
                    Upload
                  </span>
                </button>
              </div>
            </div>

            {selectionMode === "custom" ? (
              <p className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 shadow-sm">
                Drag on the map to draw a freeform area
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="absolute top-20 md:top-24 right-3 sm:right-8 flex flex-col gap-3 items-end z-40">
        <div
          className={`
            bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl
            w-[300px] sm:w-[340px]
            max-h-[60vh]
            min-h-0
            flex flex-col
            transition-all duration-300 origin-top-right
            border border-white/30
            ${
              isLayersPanelOpen
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-90 -translate-y-4 pointer-events-none absolute"
            }
          `}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-neutral-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary-green/10 flex items-center justify-center">
                <Layers size={16} className="text-primary-green" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-800 font-poppins">
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
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4 [scrollbar-width:thin] [scrollbar-color:theme(colors.neutral.300)_transparent]">
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

            <div className="pt-2 border-t border-neutral-100 text-left">
              <span className="text-[9px] font-medium uppercase tracking-wider text-neutral-400 mb-1.5 block px-1 font-poppins">
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
              flex items-center gap-2.5 bg-white/95 backdrop-blur-xl px-3.5 py-2
              rounded-xl shadow-lg border border-white/30 hover:scale-105 
              transition-all duration-200 group active:scale-95
            "
          >
            <div className="w-6 h-6 rounded-lg bg-primary-green/10 flex items-center justify-center group-hover:bg-primary-green/15 transition-colors">
              <Layers
                size={15}
                className="text-primary-green group-hover:rotate-12 transition-transform"
              />
            </div>
            <span className="font-bold text-xs text-neutral-700">Options</span>
          </button>
        )}
      </div>
    </div>
  );
}
