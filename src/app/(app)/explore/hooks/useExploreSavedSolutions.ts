"use client";

import { useMemo, useCallback } from "react";
import type { SelectedFeature } from "@/types/metrics";
import type { BarangayData } from "@/context/BarangayContext";
import type { VisionContext } from "@/lib/vision/context";
import type { LocationSelectionMode } from "@/types/maplayers";
import type { SavePayload } from "@/types/green_solutions";
import type { UIRecommendation } from "@/lib/recommendations";
import { useSavedSolutions } from "@/hooks/useSavedSolutions";
import {
  resolveSelectedAreaHectares,
} from "@/lib/selection-area";
import { toast } from "sonner";
import { maxHazardLevel } from "@/lib/explore-utils";

/**
 * Manages saved solutions for the explore page — computes the save payload
 * payload, matching saved solutions, context snapshot, and the save/remove
 * handlers.
 */
export function useExploreSavedSolutions(
  selectedFeature: SelectedFeature | null,
  locationSelectionMode: LocationSelectionMode,
  activeBarangayData: BarangayData | null,
  visionContext: VisionContext | null,
) {
  const { saves, saveSolution, removeSolution } = useSavedSolutions();

  const selectedAreaHectares = useMemo(
    () =>
      resolveSelectedAreaHectares({
        customSelectionAreaHectares:
          selectedFeature?.customSelectionAreaHectares ?? null,
        pointSelectionAreaHectares:
          selectedFeature?.pointSelectionAreaHectares ?? null,
        barangayAreaHectares: activeBarangayData?.areaHectares ?? null,
      }),
    [activeBarangayData?.areaHectares, selectedFeature],
  );

  const savedLocationPayload = useMemo<Omit<
    SavePayload,
    "solutionSnapshot" | "contextSnapshot"
  > | null>(() => {
    if (!selectedFeature) return null;
    if (locationSelectionMode === "barangay") {
      return {
        locationType: "barangay",
        locationId: selectedFeature.barangay || null,
        locationName: selectedFeature.barangay
          ? `Brgy. ${selectedFeature.barangay}`
          : selectedFeature.name,
        locationMetadata: null,
      };
    }
    if (locationSelectionMode === "custom") {
      const geo = selectedFeature.customSelectionGeometry;
      const coords = geo?.coordinates?.[0] ?? [];
      let midLat = 0;
      let midLng = 0;
      if (coords.length) {
        coords.forEach(([lng, lat]: number[]) => {
          midLat += lat;
          midLng += lng;
        });
        midLat /= coords.length;
        midLng /= coords.length;
      }
      return {
        locationType: "custom",
        locationId: null,
        locationName: selectedFeature.customSelectionAreaHectares
          ? `${selectedFeature.customSelectionAreaHectares.toFixed(2)} ha Custom Area`
          : "Custom Area",
        locationMetadata: {
          areaHectares: selectedFeature.customSelectionAreaHectares ?? null,
          midpoint: coords.length ? { lat: midLat, lng: midLng } : null,
        },
      };
    }
    return {
      locationType: "poi",
      locationId: null,
      locationName: selectedFeature.name || "Pin Location",
      locationMetadata: {
        coords: selectedFeature.coords,
        address: selectedFeature.address,
        areaHectares: selectedAreaHectares,
      },
    };
  }, [selectedAreaHectares, selectedFeature, locationSelectionMode]);

  const matchingSavedSolutions = useMemo(() => {
    if (!savedLocationPayload) return [];
    return saves.filter((save) => {
      if (save.locationType !== savedLocationPayload.locationType) {
        return false;
      }
      if (
        savedLocationPayload.locationId &&
        save.locationId === savedLocationPayload.locationId
      ) {
        return true;
      }
      if (
        savedLocationPayload.locationName &&
        save.locationName === savedLocationPayload.locationName
      ) {
        return true;
      }
      return false;
    });
  }, [savedLocationPayload, saves]);

  const contextSnapshot = useMemo<Record<string, unknown> | null>(() => {
    if (!selectedFeature) return null;
    return {
      areaName: selectedFeature.barangay || selectedFeature.name,
      ndvi:
        activeBarangayData?.ndvi ?? selectedFeature.properties?.ndvi ?? null,
      lst:
        activeBarangayData?.lst ??
        selectedFeature.properties?.temperature ??
        null,
      treeCanopy:
        activeBarangayData?.treeCanopy ??
        selectedFeature.properties?.treeCanopy ??
        null,
      greeneryIndex:
        activeBarangayData?.greeneryIndex ??
        selectedFeature.properties?.greeneryIndex ??
        null,
      greeneryLevel: activeBarangayData?.greeneryLevel ?? null,
      floodHazard: maxHazardLevel(selectedFeature.hazards?.flood) ?? null,
      stormHazard: maxHazardLevel(selectedFeature.hazards?.storm) ?? null,
      aqi: selectedFeature.hazards?.air?.[0]?.AQI_Level ?? null,
      areaHectares: selectedAreaHectares,
      visionContext,
    };
  }, [
    selectedAreaHectares,
    selectedFeature,
    activeBarangayData,
    visionContext,
  ]);

  const handleToggleSave = useCallback(
    async (e: React.MouseEvent, rec: UIRecommendation) => {
      e.stopPropagation();
      if (!savedLocationPayload) return;

      const saved = saves.find(
        (s) =>
          String(s.solutionSnapshot.solutionTitle) === rec.solutionTitle &&
          s.locationType === savedLocationPayload.locationType &&
          (s.locationId === savedLocationPayload.locationId ||
            s.locationName === savedLocationPayload.locationName),
      );
      if (saved) {
        await removeSolution(saved.id);
        toast.success("Solution removed from workspace");
      } else {
        const { icon, ...snapshotRec } = rec as UIRecommendation & {
          icon?: unknown;
        };
        void icon;
        const sanitizedSnapshotRec = JSON.parse(
          JSON.stringify(snapshotRec),
        ) as Record<string, unknown>;
        const sanitizedContextSnapshot = JSON.parse(
          JSON.stringify(contextSnapshot ?? {}),
        ) as Record<string, unknown>;

        const result = await saveSolution({
          ...savedLocationPayload,
          solutionSnapshot: sanitizedSnapshotRec,
          contextSnapshot: sanitizedContextSnapshot,
        });
        if (result.success) {
          toast.success("Solution saved to your workspace");
        } else {
          toast.error("Failed to save solution");
        }
      }
    },
    [saves, savedLocationPayload, contextSnapshot, saveSolution, removeSolution],
  );

  // Need to import toast
  return {
    saves,
    saveSolution,
    removeSolution,
    savedLocationPayload,
    matchingSavedSolutions,
    contextSnapshot,
    selectedAreaHectares,
    handleToggleSave,
  } as const;
}
