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
import MapLegend, { type LegendConfig } from "@/components/map/map_legend";
import { STATIC_LEGENDS, getHazardLegend } from "@/config/legendConfig";
import { DEFAULT_MANDAUE_HAZARD_LAYER_ORDER } from "@/lib/map/mandaue-hazard-config";
import { LayerId } from "@/types/maplayers";

import dynamic from "next/dynamic";
import { type LocationSelectionMode } from "@/types/maplayers";
import { SelectedFeature } from "@/types/metrics";

const NO_SUPPLEMENTAL_LEGENDS: LegendConfig[] = [];

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
  /** Extra legend entries (e.g. geophoto vision) merged after active layer legends. */
  supplementalLegends?: LegendConfig[];
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
  supplementalLegends,
}: MapWrapperProps) {
  const extraLegends = supplementalLegends ?? NO_SUPPLEMENTAL_LEGENDS;
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);

  const [selectedMapType, setSelectedMapType] = useState("Default");
  const effectiveStyleUrl = mapStyles[selectedMapType] ?? mapStyles.Default;
  const [layerColors, setLayerColors] = useState(defaultLayerColors);
  const [layerVisibility, setLayerVisibility] = useState(() => ({
    ...defaultLayerVisibility,
  }));
  const [barangayBoundsManualVisible, setBarangayBoundsManualVisible] =
    useState(defaultLayerVisibility.barangayBoundsLayer);
  const [selectedFloodPeriod, setSelectedFloodPeriod] =
    useState("floodLayer100Yr");
  const [selectedStormAdvisory, setSelectedStormAdvisory] =
    useState("stormLayerAdv1");

  const [hazardLayerOrder, setHazardLayerOrder] = useState<string[]>([
    "floodLayer",
    "stormLayer",
    ...DEFAULT_MANDAUE_HAZARD_LAYER_ORDER,
  ]);
  const [environmentalLayerOrder, setEnvironmentalLayerOrder] = useState<
    string[]
  >([
    "heatLayer",
    "ndviLayer",
    "canopyLayer",
    "taggedTreesLayer",
    "greeneryIndexLayer",
  ]);

  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({
    floodLayer: 0.6,
    stormLayer: 0.6,
    liquefactionLayer: 0.65,
    eilLayer: 0.65,
    landslideLayer: 0.6,
    heatLayer: 0.55,
    ndviLayer: 0.55,
    canopyLayer: 0.55,
    greeneryIndexLayer: 0.6,
    taggedTreesLayer: 0.8,
    barangayBoundsLayer: 0.15,
  });

  const [selectedLegendId, setSelectedLegendId] = useState<string>("");

  const effectiveLayerVisibility = useMemo(
    () => ({
      ...layerVisibility,
      barangayBoundsLayer:
        selectionMode === "barangay" ? true : barangayBoundsManualVisible,
    }),
    [layerVisibility, selectionMode, barangayBoundsManualVisible],
  );

  const activeLegends = useMemo(() => {
    const legends: LegendConfig[] = [];

    // Check hazards
    if (effectiveLayerVisibility.floodLayer) {
      const leg = getHazardLegend("floodLayer", layerColors.floodLayer);
      if (leg) legends.push(leg);
    }
    if (effectiveLayerVisibility.stormLayer) {
      const leg = getHazardLegend("stormLayer", layerColors.stormLayer);
      if (leg) legends.push(leg);
    }

    for (const hazardId of [
      "liquefactionLayer",
      "eilLayer",
      "landslideLayer",
    ] as const) {
      if (effectiveLayerVisibility[hazardId]) {
        const leg = getHazardLegend(hazardId, []);
        if (leg) legends.push(leg);
      }
    }

    // Check environmental
    const envLayers = [
      "heatLayer",
      "ndviLayer",
      "canopyLayer",
      "greeneryIndexLayer",
    ] as const;
    envLayers.forEach((id) => {
      if (
        effectiveLayerVisibility[id as keyof typeof effectiveLayerVisibility] &&
        STATIC_LEGENDS[id]
      ) {
        legends.push(STATIC_LEGENDS[id]);
      }
    });

    if (
      effectiveLayerVisibility.taggedTreesLayer &&
      STATIC_LEGENDS.taggedTreesLayer
    ) {
      legends.push(STATIC_LEGENDS.taggedTreesLayer);
    }

    if (
      effectiveLayerVisibility.barangayBoundsLayer &&
      STATIC_LEGENDS.barangayBoundsLayer
    ) {
      legends.push(STATIC_LEGENDS.barangayBoundsLayer);
    }

    if (extraLegends.length > 0) {
      legends.push(...extraLegends);
    }

    return legends;
  }, [effectiveLayerVisibility, layerColors, extraLegends]);

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
    if (layerId === "barangayBoundsLayer") {
      setBarangayBoundsManualVisible((prev) => !prev);
      return;
    }

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
        layerVisibility={effectiveLayerVisibility}
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
              <div className="flex w-auto max-w-full items-center gap-0.5 rounded-3xl border border-white/60 bg-white/90 px-1.5 py-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-2xl dark:border-neutral-800 dark:bg-neutral-950/85 dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] sm:gap-1 sm:px-2 sm:py-2">
                {(["poi", "barangay", "custom"] as const).map((mode) => {
                  const label =
                    mode === "poi"
                      ? "Pin"
                      : mode === "barangay"
                        ? "Barangay"
                        : "Lasso";

                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-label={label}
                      aria-pressed={selectionMode === mode}
                      onClick={() => onSelectionModeChange?.(mode)}
                      className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-all duration-300 sm:px-6 ${
                        selectionMode === mode
                          ? "bg-neutral-900 text-white shadow-lg scale-105 dark:bg-neutral-100 dark:text-neutral-900"
                          : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {mode === "poi" ? (
                        <MapPin size={18} className="sm:h-3.5 sm:w-3.5" />
                      ) : mode === "barangay" ? (
                        <SquareDashed size={18} className="sm:h-3.5 sm:w-3.5" />
                      ) : (
                        <PenLine size={18} className="sm:h-3.5 sm:w-3.5" />
                      )}
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}

                <div className="mx-1 hidden h-6 w-px bg-neutral-200 dark:bg-neutral-700 sm:block" />

                <button
                  type="button"
                  aria-label="Upload photo"
                  onClick={() => onUploadRequested?.()}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-primary-green px-3 py-2.5 text-white shadow-lg shadow-green-200 transition-all hover:scale-110 active:scale-95 dark:shadow-green-950/40 sm:px-4"
                >
                  <Camera size={18} />
                  <span className="hidden text-xs font-bold sm:inline">
                    Upload
                  </span>
                </button>
              </div>
            </div>

            {selectionMode === "custom" ? (
              <p className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                Left-drag to draw. Middle-drag to pan.
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="absolute top-6 right-3 sm:right-8 flex flex-col gap-3 items-end z-40 transition-all duration-300 [.mobile-search-active_&]:opacity-0 [.mobile-search-active_&]:pointer-events-none [.mobile-search-active_&]:translate-x-4">
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
              layerVisibility={effectiveLayerVisibility}
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
                flex items-center justify-center sm:justify-start gap-2.5 rounded-xl border border-white/30 bg-white/95
                p-2 sm:px-3.5 sm:py-2
                shadow-lg backdrop-blur-xl hover:scale-105 w-10 h-10 sm:w-[110px] sm:h-auto
                transition-all duration-200 group active:scale-95
                dark:border-neutral-800 dark:bg-neutral-950/90 dark:shadow-black/40
              "
              aria-label="Map Options"
              title="Map Options"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-green/10 transition-colors group-hover:bg-primary-green/15 dark:bg-primary-green/20 dark:group-hover:bg-primary-green/30 shrink-0">
                <Layers
                  size={15}
                  className="text-primary-green transition-transform group-hover:rotate-12 dark:text-primary-green/80"
                />
              </div>
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-100 hidden sm:inline font-roboto">
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
