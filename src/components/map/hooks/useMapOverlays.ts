"use client";

import { useCallback } from "react";
import type mapboxgl from "mapbox-gl";
import { type LocationSelectionMode } from "@/types/maplayers";
import {
  syncLayerStyles,
  reorderLayers,
} from "@/lib/map/layer_manager";

export interface MapOverlayRefs {
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
  selectionModeRef: React.MutableRefObject<LocationSelectionMode>;
  layerVisibilityRef: React.MutableRefObject<Record<string, boolean>>;
  layerColorsRef: React.MutableRefObject<Record<string, string[]>>;
  layerSpecificSelectedRef: React.MutableRefObject<Record<string, string>>;
  hazardLayerOrderRef: React.MutableRefObject<string[]>;
  environmentalLayerOrderRef: React.MutableRefObject<string[]>;
  layerOpacityRef: React.MutableRefObject<Record<string, number>>;
}

export function useMapOverlays(refs: MapOverlayRefs) {
  const {
    mapRef,
    selectionModeRef,
    layerVisibilityRef,
    layerColorsRef,
    layerSpecificSelectedRef,
    hazardLayerOrderRef,
    environmentalLayerOrderRef,
    layerOpacityRef,
  } = refs;

  /** Applies current layer styles to the map. Safe to call from any context
   *  because it guards against unloaded styles internally. */
  const applyLayerStyles = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) return;
    try {
      if (!map.getStyle()) return;
    } catch {
      return;
    }
    syncLayerStyles(
      map,
      layerVisibilityRef.current,
      layerColorsRef.current,
      layerSpecificSelectedRef.current,
      selectionModeRef.current,
      layerOpacityRef.current,
    );
    reorderLayers(
      map,
      hazardLayerOrderRef.current,
      environmentalLayerOrderRef.current,
    );
  }, [
    mapRef,
    layerVisibilityRef,
    layerColorsRef,
    layerSpecificSelectedRef,
    selectionModeRef,
    hazardLayerOrderRef,
    environmentalLayerOrderRef,
    layerOpacityRef,
  ]);

  return { applyLayerStyles };
}
