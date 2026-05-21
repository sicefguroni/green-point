"use client";

import { useState, useRef, useCallback } from "react";
import {
  enrichRecommendation,
  sortUIRecommendationsByOverallRating,
  type UIRecommendation,
} from "@/lib/recommendations";
import type { SelectedFeature } from "@/types/metrics";
import type { BarangayData } from "@/context/BarangayContext";
import type { VisionContext } from "@/lib/vision/context";
import {
  getCachedRecommendations,
  setCachedRecommendations,
} from "@/lib/recommendation-cache";
import type { GreeningRecommendation } from "@/types/schema";
import type { LocationSelectionMode } from "@/types/maplayers";

import { maxHazardLevel } from "@/lib/explore-utils";

/** Context needed for the handleGenerate orchestrator callback. */
export interface GenerateOptions {
  selectedFeature: SelectedFeature;
  activeBarangayData: BarangayData | null;
  locationSelectionMode: LocationSelectionMode;
  visionContext: VisionContext | null;
  selectedAreaHectares: number | null;
  trackLocationMetrics: (
    type: "BARANGAY" | "POINT" | "CUSTOM",
    name: string,
    metrics: {
      ndvi?: number | null;
      lst?: number | null;
      treeCanopy?: number | null;
      greeneryIndex?: number | null;
      greeneryLevel?: string | null;
      aqi?: number | null;
    },
    id?: string | null,
    coords?: { lat: number; lng: number } | null,
  ) => Promise<void>;
  forceRefresh?: boolean;
}

/**
 * Manages recommendation generation state and the multi-level cache
 * (in-memory + localStorage).
 */
export function useRecommendationGeneration() {
  const [ragRecommendations, setRagRecommendations] = useState<
    UIRecommendation[] | null
  >(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatingStep, setGeneratingStep] = useState<string | null>(null);

  const clientRecommendationsCache = useRef<
    Record<string, UIRecommendation[]>
  >({});

  const handleGenerate = useCallback(
    async (opts: GenerateOptions) => {
      const {
        selectedFeature,
        activeBarangayData,
        locationSelectionMode,
        visionContext,
        selectedAreaHectares,
        trackLocationMetrics,
        forceRefresh,
      } = opts;

      if (!selectedFeature) return;

      // Build cache key for the current location
      let cacheKey = "";
      if (locationSelectionMode === "barangay") {
        cacheKey = `barangay_${selectedFeature.barangay || selectedFeature.name}`;
      } else if (locationSelectionMode === "poi" && selectedFeature.coords) {
        const rLat = Math.round(selectedFeature.coords.lat * 10000) / 10000;
        const rLng = Math.round(selectedFeature.coords.lng * 10000) / 10000;
        cacheKey = `poi_${rLat}_${rLng}`;
      } else if (
        locationSelectionMode === "custom" &&
        selectedFeature.customSelectionGeometry
      ) {
        cacheKey = `custom_${JSON.stringify(selectedFeature.customSelectionGeometry)}`;
      }

      // Check caches (skip on force refresh)
      if (!forceRefresh && cacheKey) {
        if (clientRecommendationsCache.current[cacheKey]) {
          setRagRecommendations(
            clientRecommendationsCache.current[cacheKey],
          );
          return;
        }
        const fromStorage = getCachedRecommendations(cacheKey);
        if (fromStorage) {
          const enriched = sortUIRecommendationsByOverallRating(
            fromStorage.map(enrichRecommendation),
          );
          clientRecommendationsCache.current[cacheKey] = enriched;
          setRagRecommendations(enriched);
          return;
        }
      }

      setIsGenerating(true);
      setGenerateError(null);
      setGeneratingStep("Connecting to satellite databases...");

      const stepTimer1 = setTimeout(
        () => setGeneratingStep("Analyzing local greenery patterns..."),
        2500,
      );
      const stepTimer2 = setTimeout(
        () =>
          setGeneratingStep(
            "Synthesizing recommendations with local research papers...",
          ),
        5500,
      );
      const stepTimer3 = setTimeout(
        () => setGeneratingStep("Finalizing AI greening guidelines..."),
        8500,
      );

      try {
        const res = await fetch("/api/recommendations/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            forceRefresh,
            barangayName:
              selectedFeature.barangay || selectedFeature.name,
            barangayId: selectedFeature.barangay || null,
            ndvi:
              locationSelectionMode === "poi"
                ? (selectedFeature.properties?.ndvi ??
                  activeBarangayData?.ndvi ??
                  null)
                : (activeBarangayData?.ndvi ??
                  selectedFeature.properties?.ndvi ??
                  null),
            lst:
              locationSelectionMode === "poi"
                ? (selectedFeature.properties?.temperature ??
                  activeBarangayData?.lst ??
                  null)
                : (activeBarangayData?.lst ??
                  selectedFeature.properties?.temperature ??
                  null),
            treeCanopy:
              locationSelectionMode === "poi"
                ? (selectedFeature.properties?.treeCanopy ??
                  activeBarangayData?.treeCanopy ??
                  null)
                : (activeBarangayData?.treeCanopy ??
                  selectedFeature.properties?.treeCanopy ??
                  null),
            greeneryIndex:
              locationSelectionMode === "poi"
                ? (selectedFeature.properties?.greeneryIndex ??
                  activeBarangayData?.greeneryIndex ??
                  null)
                : (activeBarangayData?.greeneryIndex ??
                  selectedFeature.properties?.greeneryIndex ??
                  null),
            greeneryLevel: activeBarangayData?.greeneryLevel ?? null,
            floodHazard:
              maxHazardLevel(selectedFeature.hazards?.flood) ?? null,
            stormHazard:
              maxHazardLevel(selectedFeature.hazards?.storm) ?? null,
            aqi:
              selectedFeature.hazards?.air?.[0]?.AQI_Level != null &&
              selectedFeature.hazards.air[0].AQI_Level >= 0
                ? selectedFeature.hazards.air[0].AQI_Level
                : null,
            taggedTreeCount:
              locationSelectionMode === "poi"
                ? ((selectedFeature.properties
                    ?.nearbyTaggedTreeCount as number | null | undefined) ??
                  activeBarangayData?.taggedTreeCount ??
                  null)
                : (activeBarangayData?.taggedTreeCount ??
                  (selectedFeature.properties
                    ?.inventoryTreeCount as number | null | undefined) ??
                  null),
            inventoryCanopyFraction:
              locationSelectionMode === "poi"
                ? ((selectedFeature.properties
                    ?.inventoryCanopyFraction as
                    | number
                    | null
                    | undefined) ??
                  activeBarangayData?.inventoryCanopyFraction ??
                  null)
                : (activeBarangayData?.inventoryCanopyFraction ??
                  (selectedFeature.properties
                    ?.inventoryCanopyFraction as
                    | number
                    | null
                    | undefined) ??
                  null),
            areaHectares: selectedAreaHectares,
            visionContext,
            locationSelectionMode,
            coords: selectedFeature.coords,
            customSelectionGeometry:
              selectedFeature.customSelectionGeometry,
          }),
        });
        const json = await res.json();
        if (json.success) {
          const enriched = sortUIRecommendationsByOverallRating(
            (json.data as GreeningRecommendation[]).map(
              enrichRecommendation,
            ),
          );
          setRagRecommendations(enriched);

          if (cacheKey) {
            clientRecommendationsCache.current[cacheKey] = enriched;
            setCachedRecommendations(
              cacheKey,
              json.data as GreeningRecommendation[],
            );
          }

          void trackLocationMetrics(
            locationSelectionMode === "poi"
              ? "POINT"
              : locationSelectionMode === "custom"
                ? "CUSTOM"
                : "BARANGAY",
            selectedFeature.barangay || selectedFeature.name,
            {
              ndvi:
                locationSelectionMode === "poi"
                  ? (selectedFeature.properties?.ndvi ??
                    activeBarangayData?.ndvi ??
                    null)
                  : (activeBarangayData?.ndvi ??
                    selectedFeature.properties?.ndvi ??
                    null),
              lst:
                locationSelectionMode === "poi"
                  ? (selectedFeature.properties?.temperature ??
                    activeBarangayData?.lst ??
                    null)
                  : (activeBarangayData?.lst ??
                    selectedFeature.properties?.temperature ??
                    null),
              treeCanopy:
                locationSelectionMode === "poi"
                  ? (selectedFeature.properties?.treeCanopy ??
                    activeBarangayData?.treeCanopy ??
                    null)
                  : (activeBarangayData?.treeCanopy ??
                    selectedFeature.properties?.treeCanopy ??
                    null),
              greeneryIndex:
                locationSelectionMode === "poi"
                  ? (selectedFeature.properties?.greeneryIndex ??
                    activeBarangayData?.greeneryIndex ??
                    null)
                  : (activeBarangayData?.greeneryIndex ??
                    selectedFeature.properties?.greeneryIndex ??
                    null),
              greeneryLevel: activeBarangayData?.greeneryLevel ?? null,
              aqi:
                selectedFeature.hazards?.air?.[0]?.AQI_Level != null &&
                selectedFeature.hazards.air[0].AQI_Level >= 0
                  ? selectedFeature.hazards.air[0].AQI_Level
                  : null,
            },
            selectedFeature.pointID || null,
            selectedFeature.coords,
          );
        } else {
          setGenerateError(json.error ?? "Generation failed.");
        }
      } catch {
        setGenerateError("Network error. Please try again.");
      } finally {
        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        clearTimeout(stepTimer3);
        setIsGenerating(false);
        setGeneratingStep(null);
      }
    },
    [],
  );

  return {
    ragRecommendations,
    setRagRecommendations,
    isGenerating,
    generateError,
    setGenerateError,
    generatingStep,
    handleGenerate,
  } as const;
}
