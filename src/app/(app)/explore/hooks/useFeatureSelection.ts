"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import type { SelectedFeature } from "@/types/metrics";
import type { LocationSelectionMode } from "@/types/maplayers";

/**
 * Manages the selected geographic feature state, map refs, and related UI
 * state (sidebar open, bottom panel expanded).
 *
 * Orchestration callbacks (clearSelection, handleFeatureSelected) that
 * need to coordinate across multiple hooks are defined at the page level.
 */
export function useFeatureSelection() {
  const [selectedFeature, setSelectedFeature] =
    useState<SelectedFeature | null>(null);
  const [locationSelectionMode, setLocationSelectionMode] =
    useState<LocationSelectionMode>("poi");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [bottomExpanded, setBottomExpanded] = useState(false);

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const removeMarkerRef = useRef<(() => void) | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Open sidebar when a feature is selected
  useEffect(() => {
    if (selectedFeature) {
      setBottomExpanded(true);
      setIsSidebarOpen(true);
    } else {
      setIsSidebarOpen(false);
      setBottomExpanded(false);
    }
  }, [selectedFeature]);

  // Fly to selected feature coordinates
  useEffect(() => {
    if (!selectedFeature?.coords || !mapRef.current) return;
    const { lng, lat } = selectedFeature.coords;
    if (lng === 0 && lat === 0) return;
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: 16,
      speed: 1.2,
      essential: true,
    });
  }, [selectedFeature]);

  const clearSelectedBarangayHighlight = useCallback(
    (barangayName: string | null | undefined) => {
      if (!barangayName || !mapRef.current) return;
      try {
        mapRef.current.setFeatureState(
          {
            source: "barangayBoundsSource",
            sourceLayer: "mandaue_barangay_boundaries-7byvux",
            id: barangayName,
          } as Parameters<mapboxgl.Map["setFeatureState"]>[0],
          { selected: false },
        );
      } catch (error) {
        console.error("Failed to clear barangay highlight:", error);
      }
    },
    [],
  );

  return {
    // State
    selectedFeature,
    setSelectedFeature,
    locationSelectionMode,
    setLocationSelectionMode,
    isSidebarOpen,
    setIsSidebarOpen,
    bottomExpanded,
    setBottomExpanded,
    // Refs
    mapRef,
    markerRef,
    removeMarkerRef,
    // Actions
    clearSelectedBarangayHighlight,
  } as const;
}
