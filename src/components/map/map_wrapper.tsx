"use client";

import { useState, useMemo, useCallback } from "react";
import { Layers, X, Camera, MapPin, SquareDashed, PenLine } from "lucide-react";
import HazardLayers from "@/components/map/panels/hazardLayersPanel";
import MapTypes from "@/components/map/panels/mapTypePanel";
import {
  defaultLayerVisibility,
  defaultLayerColors,
  mapStyles,
} from "@/config/mapConfig";
import MapLegend, { LegendConfig } from "@/components/map/map_legend";
import { STATIC_LEGENDS, getHazardLegend } from "@/config/legendConfig";
import { LayerId } from "@/types/maplayers";

import dynamic from "next/dynamic";
import { type LocationSelectionMode } from "@/types/maplayers";
import { SelectedFeature } from "@/types/metrics";

const MapboxMap = dynamic(() => import("./mapbox_map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-background" />,
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
  const effectiveStyleUrl = mapStyles[selectedMapType] ?? mapStyles.Default;
  const [layerColors, setLayerColors] = useState(defaultLayerColors);
  const [layerVisibility, setLayerVisibility] = useState(
    defaultLayerVisibility,
  );
  const [selectedFloodPeriod, setSelectedFloodPeriod] =
    useState("floodLayer100Yr");
  const [selectedStormAdvisory, setSelectedStormAdvisory] =
    useState("stormLayerAdv1");

  const [hazardLayerOrder, setHazardLayerOrder] = useState<string[]>([
    "floodLayer",
    "stormLayer",
  ]);
  const [environmentalLayerOrder, setEnvironmentalLayerOrder] = useState<
    string[]
  >([
    "airLayer",
    "heatLayer",
    "ndviLayer",
    "canopyLayer",
    "taggedTreesLayer",
    "greeneryIndexLayer",
  ]);

  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({
    floodLayer: 0.6,
    stormLayer: 0.6,
    airLayer: 0.5,
    heatLayer: 0.55,
    ndviLayer: 0.55,
    canopyLayer: 0.55,
    greeneryIndexLayer: 0.6,
    taggedTreesLayer: 0.8,
    barangayBoundsLayer: 0.15,
  });

  const [selectedLegendId, setSelectedLegendId] = useState<string>("");

  const activeLegends = useMemo(() => {
    const legends: LegendConfig[] = [];

    // Check hazards
    if (layerVisibility.floodLayer) {
      const leg = getHazardLegend("floodLayer", layerColors.floodLayer);
      if (leg) legends.push(leg);
    }
    if (layerVisibility.stormLayer) {
      const leg = getHazardLegend("stormLayer", layerColors.stormLayer);
      if (leg) legends.push(leg);
    }

    // Check environmental
    const envLayers = [
      "airLayer",
      "heatLayer",
      "ndviLayer",
      "canopyLayer",
      "greeneryIndexLayer",
    ] as const;
    envLayers.forEach((id) => {
      if (
        layerVisibility[id as keyof typeof layerVisibility] &&
        STATIC_LEGENDS[id]
      ) {
        legends.push(STATIC_LEGENDS[id]);
      }
    });

    if (layerVisibility.taggedTreesLayer && STATIC_LEGENDS.taggedTreesLayer) {
      legends.push(STATIC_LEGENDS.taggedTreesLayer);
    }

    if (
      layerVisibility.barangayBoundsLayer &&
      STATIC_LEGENDS.barangayBoundsLayer
    ) {
      legends.push(STATIC_LEGENDS.barangayBoundsLayer);
    }

    return legends;
  }, [layerVisibility, layerColors]);

  useMemo(() => {
    if (activeLegends.length > 0) {
      const stillActive = activeLegends.some((l) => l.id === selectedLegendId);
      if (!stillActive) {
        setSelectedLegendId(activeLegends[0].id);
      }
    } else {
      setSelectedLegendId("");
    }
  }, [activeLegends, selectedLegendId]);

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
    <div className="relative h-full w-screen bg-background font-roboto text-foreground">
      <MapboxMap
        styleUrl={effectiveStyleUrl}
        layerVisibility={layerVisibility}
        layerColors={layerColors}
        layerSpecificSelected={layerSpecificSelected}
        searchBoxLocation={searchBoxLocation}
        selectedCustomArea={selectedCustomArea}
        onFeatureSelected={onFeatureSelected}
        onBarangaySelected={onBarangaySelected}
        onMapReady={onMapReady}
        selectionMode={selectionMode}
        hazardLayerOrder={hazardLayerOrder}
        environmentalLayerOrder={environmentalLayerOrder}
        layerOpacity={layerOpacity}
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
              <div className="flex w-full items-center gap-1 rounded-3xl border border-white/60 bg-white/90 px-2 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-2xl dark:border-neutral-800 dark:bg-neutral-950/85 dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] sm:w-auto">
                {(["poi", "barangay", "custom"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onSelectionModeChange?.(mode)}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
                      selectionMode === mode
                        ? "bg-neutral-900 text-white shadow-lg scale-105 dark:bg-neutral-100 dark:text-neutral-900"
                        : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
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

                <div className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-700 sm:block" />

                <button
                  onClick={() => onUploadRequested?.()}
                  className="flex items-center gap-2 rounded-2xl bg-primary-green px-4 py-2.5 text-white shadow-lg shadow-green-200 transition-all hover:scale-110 active:scale-95 dark:shadow-green-950/40"
                >
                  <Camera size={18} />
                  <span className="text-xs font-bold sm:inline hidden">
                    Upload
                  </span>
                </button>
              </div>
            </div>

            {selectionMode === "custom" ? (
              <p className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                Drag on the map to draw a freeform area
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="absolute top-6 lg:top-8 right-3 sm:right-8 flex flex-col gap-3 items-end z-40">
        <div
          className={`
            bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl dark:bg-neutral-950/90 dark:shadow-black/40
            w-[300px] sm:w-[340px]
            max-h-[60vh]
            min-h-0
            flex flex-col
            transition-all duration-300 origin-top-right
            border border-white/30 dark:border-neutral-800
            ${
              isLayersPanelOpen
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-90 -translate-y-4 pointer-events-none absolute"
            }
          `}
        >
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 pb-2 pt-4 shrink-0 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-green/10 dark:bg-primary-green/20">
                <Layers
                  size={16}
                  className="text-primary-green dark:text-primary-green/80"
                />
              </div>
              <h3 className="text-sm font-semibold text-neutral-800 font-poppins dark:text-neutral-100">
                Map Options
              </h3>
            </div>
            <button
              onClick={() => setIsLayersPanelOpen(false)}
              className="
                rounded-lg p-1.5 text-neutral-400 transition-colors 
                hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300
              "
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 p-3 [scrollbar-width:thin] [scrollbar-color:theme(colors.neutral.300)_transparent] dark:[scrollbar-color:theme(colors.neutral.700)_transparent]">
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
              hazardLayerOrder={hazardLayerOrder}
              onHazardOrderChange={setHazardLayerOrder}
              environmentalLayerOrder={environmentalLayerOrder}
              onEnvironmentalOrderChange={setEnvironmentalLayerOrder}
              layerOpacity={layerOpacity}
              onOpacityChange={(id, val) =>
                setLayerOpacity((prev) => ({ ...prev, [id]: val }))
              }
            />

            <div className="border-t border-neutral-100 pt-2 text-left dark:border-neutral-800">
              <span className="mb-1.5 block px-1 text-[9px] font-medium uppercase tracking-wider text-neutral-400 font-poppins dark:text-neutral-500">
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
          <>
            <button
              onClick={() => setIsLayersPanelOpen(true)}
              className="
                flex items-center gap-2.5 rounded-xl border border-white/30 bg-white/95 px-3.5 py-2
                shadow-lg backdrop-blur-xl hover:scale-105 w-[110px]
                transition-all duration-200 group active:scale-95
                dark:border-neutral-800 dark:bg-neutral-950/90 dark:shadow-black/40
              "
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-green/10 transition-colors group-hover:bg-primary-green/15 dark:bg-primary-green/20 dark:group-hover:bg-primary-green/30">
                <Layers
                  size={15}
                  className="text-primary-green transition-transform group-hover:rotate-12 dark:text-primary-green/80"
                />
              </div>
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-100">
                Options
              </span>
            </button>

            <MapLegend
              activeLegends={activeLegends}
              selectedLegendId={selectedLegendId}
              onLegendChange={setSelectedLegendId}
            />
          </>
        )}
      </div>
    </div>
  );
}
