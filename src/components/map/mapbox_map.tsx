"use client";

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapSearchBar from "./map_search";
import { type LocationSelectionMode } from "@/types/maplayers";
import { type SelectedFeature } from "@/types/metrics";
import {
  addBarangayBounds,
  addHazardLayers,
  syncLayerStyles,
  applyOverlayClipping,
  reorderLayers,
} from "@/lib/map/layer_manager";
import { handleFeatureSelection as processFeatureSelection } from "@/lib/map/feature_selection";
import {
  useMapLifecycle,
} from "./hooks/useMapLifecycle";
import {
  useMapSelection,
  type SelectionHandler,
} from "./hooks/useMapSelection";
import { useMapDrawing } from "./hooks/useMapDrawing";
import { useMapBarangayMask } from "./hooks/useMapBarangayMask";
import { useMapOverlays } from "./hooks/useMapOverlays";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

const DEFAULT_CENTER: [number, number] = [123.939, 10.351];
const DEFAULT_ZOOM = 12;

interface MapboxMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  styleUrl: string;
  layerVisibility: Record<string, boolean>;
  layerColors: Record<string, string[]>;
  layerSpecificSelected: Record<string, string>;
  searchBoxLocation: string;
  selectedCustomArea?: GeoJSON.Polygon | null;
  onFeatureSelected?: (featureData: SelectedFeature) => void;
  onBarangaySelected?: (barangayName: string) => void;
  onMapReady?: (map: mapboxgl.Map, removeMarker: () => void) => void;
  selectionMode: LocationSelectionMode;
  hazardLayerOrder: string[];
  environmentalLayerOrder: string[];
  layerOpacity: Record<string, number>;
}

export default function MapboxMap({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  className = "w-full h-full overflow-hidden",
  styleUrl,
  layerVisibility,
  layerColors,
  layerSpecificSelected,
  searchBoxLocation,
  selectedCustomArea = null,
  onFeatureSelected,
  onBarangaySelected,
  onMapReady,
  selectionMode,
  hazardLayerOrder,
  environmentalLayerOrder,
  layerOpacity,
}: MapboxMapProps) {
  // ── Ref containers (owned by orchestrator, shared across hooks) ──
  const selectionModeRef = useRef(selectionMode);
  const onBarangaySelectedRef = useRef(onBarangaySelected);
  const layerVisibilityRef = useRef(layerVisibility);
  const layerColorsRef = useRef(layerColors);
  const layerSpecificSelectedRef = useRef(layerSpecificSelected);
  const hazardLayerOrderRef = useRef(hazardLayerOrder);
  const environmentalLayerOrderRef = useRef(environmentalLayerOrder);
  const layerOpacityRef = useRef(layerOpacity);
  const handleSelectionRef = useRef<SelectionHandler | null>(null);
  const selectedBarangayIdRef = useRef<string | number | undefined>(undefined);

  // ── Hook 1: Map lifecycle (creation, resize, style switching, jumpTo) ──
  const {
    mapContainerRef,
    mapRef,
    markerRef,
    onMapReadyRef,
    removeMarker,
  } = useMapLifecycle({ styleUrl, center, zoom });

  // Keep onMapReadyRef in sync (lifecycle hook provides the ref but not the sync)
  useEffect(() => { onMapReadyRef.current = onMapReady; }, [onMapReady, onMapReadyRef]);

  // ── Hook 2: Barangay boundary mask ──
  useMapBarangayMask(mapRef);

  // ── Hook 3: Custom area drawing (lasso) ──
  const drawing = useMapDrawing({
    mapRef,
    selectionModeRef,
    onBarangaySelectedRef,
    handleSelectionRef,
  });

  // Destructure drawing functions so each effect can list stable function refs
  // in its dependency array instead of the `drawing` object (which is recreated
  // every render, triggering unwanted re-runs).
  const {
    ensureCustomSelectionLayers,
    syncSelectedCustomAreaOverlay,
    attachDrawingHandlers,
    resetDrawingState,
  } = drawing;

  // ── Hook 4: Click / hover / search selection ──
  const selection = useMapSelection({
    mapRef,
    selectionModeRef,
    onBarangaySelectedRef,
    handleSelectionRef,
    selectedBarangayIdRef,
  });

  const { attachEventHandlers } = selection;

  // ── Hook 5: Layer / overlay syncing ──
  const { applyLayerStyles } = useMapOverlays({
    mapRef,
    selectionModeRef,
    layerVisibilityRef,
    layerColorsRef,
    layerSpecificSelectedRef,
    hazardLayerOrderRef,
    environmentalLayerOrderRef,
    layerOpacityRef,
  });

  // ── Ref sync effects ──
  useEffect(() => { selectionModeRef.current = selectionMode; }, [selectionMode]);
  useEffect(() => { onBarangaySelectedRef.current = onBarangaySelected; }, [onBarangaySelected]);
  useEffect(() => { layerVisibilityRef.current = layerVisibility; }, [layerVisibility]);
  useEffect(() => { layerColorsRef.current = layerColors; }, [layerColors]);
  useEffect(() => { layerSpecificSelectedRef.current = layerSpecificSelected; }, [layerSpecificSelected]);
  useEffect(() => { hazardLayerOrderRef.current = hazardLayerOrder; }, [hazardLayerOrder]);
  useEffect(() => { environmentalLayerOrderRef.current = environmentalLayerOrder; }, [environmentalLayerOrder]);
  useEffect(() => { layerOpacityRef.current = layerOpacity; }, [layerOpacity]);

  // ── handleSelection: bridges map events to the onFeatureSelected callback ──
  const handleSelection = useCallback(
    async (
      feature: mapboxgl.GeoJSONFeature,
      coords: { lng: number; lat: number },
      barangay: string,
      mode: LocationSelectionMode = selectionMode,
      customSelectionGeometry: GeoJSON.Polygon | null = null,
      customSelectionAreaHectares: number | null = null,
      placeMarker = true,
    ) => {
      if (!mapRef.current) return;
      await processFeatureSelection(
        feature,
        coords,
        barangay,
        mapRef.current,
        markerRef,
        onFeatureSelected,
        mode,
        customSelectionGeometry,
        customSelectionAreaHectares,
        placeMarker,
      );
    },
    [onFeatureSelected, selectionMode, mapRef, markerRef],
  );

  useEffect(() => {
    handleSelectionRef.current = (feature, coords, barangay, mode, geom, area, marker) => {
      void handleSelection(feature, coords, barangay, mode, geom, area, marker);
    };
  }, [handleSelection]);

  // ── Selection mode cursor effect (also resets drawing state) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectionMode === "custom") {
      map.getCanvas().style.cursor = "crosshair";
    } else {
      resetDrawingState(map);
    }
  }, [selectionMode, mapRef, resetDrawingState]);

  // ── Selected custom area overlay sync ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    ensureCustomSelectionLayers(map);
    syncSelectedCustomAreaOverlay(map, selectedCustomArea);
  }, [
    selectedCustomArea,
    ensureCustomSelectionLayers,
    syncSelectedCustomAreaOverlay,
    mapRef,
  ]);

  // ── Layer overlay sync (re-apply when layer props change) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyLayerStyles();
    let cancelled = false;
    const reapply = () => {
      if (cancelled) return;
      applyLayerStyles();
    };
    map.once("style.load", reapply);
    map.once("idle", reapply);
    return () => {
      cancelled = true;
      map.off("style.load", reapply);
      map.off("idle", reapply);
    };
  }, [
    applyLayerStyles,
    mapRef,
    layerVisibility,
    layerColors,
    layerSpecificSelected,
    selectionMode,
    hazardLayerOrder,
    environmentalLayerOrder,
    layerOpacity,
  ]);

  // ── Main init effect: style.load → add layers + attach event handlers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleStyleLoad = () => {
      const refreshLayerState = () => {
        syncLayerStyles(
          map,
          layerVisibilityRef.current,
          layerColorsRef.current,
          layerSpecificSelectedRef.current,
          selectionModeRef.current,
          layerOpacityRef.current,
        );
        applyOverlayClipping(map);
        reorderLayers(
          map,
          hazardLayerOrderRef.current,
          environmentalLayerOrderRef.current,
        );
      };

      addHazardLayers(map, layerColorsRef.current, refreshLayerState);
      addBarangayBounds(map);
      refreshLayerState();
      addTaggedTreesLayer(map);
      ensureCustomSelectionLayers(map);
      syncSelectedCustomAreaOverlay(map, selectedCustomArea);

      if (selectionModeRef.current === "custom") {
        map.getCanvas().style.cursor = "crosshair";
      } else {
        map.dragPan.enable();
      }

      if (onMapReadyRef.current) {
        onMapReadyRef.current(map, removeMarker);
      }
    };

    map.on("style.load", handleStyleLoad);

    // Attach selection (click/hover) and drawing (pointer) event handlers
    const cleanupSelection = attachEventHandlers(map);
    const cleanupDrawing = attachDrawingHandlers(map);

    return () => {
      map.off("style.load", handleStyleLoad);
      cleanupSelection?.();
      cleanupDrawing?.();
    };
  }, [
    removeMarker,
    ensureCustomSelectionLayers,
    syncSelectedCustomAreaOverlay,
    attachDrawingHandlers,
    attachEventHandlers,
    mapRef,
    selectedCustomArea,
    onMapReadyRef,
  ]);

  return (
    <div className="relative w-full h-full bg-neutral-100">
      <div ref={mapContainerRef} className={className} />
      <div className={`absolute ${searchBoxLocation}`}>
        <MapSearchBar
          accessToken={mapboxgl.accessToken || ""}
          map={mapRef.current}
          onRetrieve={selection.handleSearchRetrieve}
        />
      </div>
    </div>
  );
}

// ── Trees layer (kept as module-level helper since it's pure Mapbox API) ──
function addTaggedTreesLayer(map: mapboxgl.Map) {
  if (!map.getSource("taggedTreesSource")) {
    map.addSource("taggedTreesSource", {
      type: "geojson",
      data: "/api/trees",
    });
  }
  if (!map.getLayer("taggedTreesLayer")) {
    map.addLayer({
      id: "taggedTreesLayer",
      type: "circle",
      source: "taggedTreesSource",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          1.5,
          16,
          4,
          20,
          10,
        ],
        "circle-color": "#10b981",
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0,
        "circle-stroke-opacity": 0,
      },
    });
  }
}
