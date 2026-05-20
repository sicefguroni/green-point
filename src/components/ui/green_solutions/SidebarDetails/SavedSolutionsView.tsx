"use client";

import React, { useState, useMemo } from "react";
import { useSavedSolutions } from "@/hooks/useSavedSolutions";
import { VersionHistory } from "../../../solutions/VersionHistory";
import { SolutionDiffViewer } from "../../../solutions/SolutionDiffViewer";
import type { UIRecommendation } from "@/lib/recommendations";
import type { SelectedFeature } from "@/types/metrics";

type SavedSolutionsViewProps = {
  selectedFeature: SelectedFeature;
  recommendation: UIRecommendation;
};

export default function SavedSolutionsView({
  selectedFeature,
  recommendation,
}: SavedSolutionsViewProps) {
  const { saves, isLoading, error } = useSavedSolutions();
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const selectedLocationPayload = useMemo(() => {
    if (!selectedFeature) return null;
    if (selectedFeature.barangay) {
      return {
        locationType: "barangay",
        locationId: selectedFeature.barangay,
        locationName: `Brgy. ${selectedFeature.barangay}`,
      };
    }
    if (selectedFeature.customSelectionGeometry) {
      return {
        locationType: "custom",
        locationId: null,
        locationName: selectedFeature.customSelectionAreaHectares
          ? `${selectedFeature.customSelectionAreaHectares.toFixed(2)} ha Custom Area`
          : "Custom Area",
      };
    }
    return {
      locationType: "poi",
      locationId: null,
      locationName: selectedFeature.name || "Pin Location",
    };
  }, [selectedFeature]);

  const filteredSaves = useMemo(() => {
    if (!selectedLocationPayload) return [];
    return saves.filter((s) => {
      if (s.locationType !== selectedLocationPayload.locationType) {
        return false;
      }
      if (
        selectedLocationPayload.locationId &&
        s.locationId === selectedLocationPayload.locationId
      ) {
        return true;
      }
      if (
        selectedLocationPayload.locationName &&
        s.locationName === selectedLocationPayload.locationName
      ) {
        return true;
      }
      return false;
    });
  }, [saves, selectedLocationPayload]);

  const selectedSolution = useMemo(() => {
    if (!selectedVersionId) return null;
    return filteredSaves.find((s) => s.id === selectedVersionId) ?? null;
  }, [filteredSaves, selectedVersionId]);

  const previousSolution = useMemo(() => {
    if (!selectedSolution?.previousVersionId) return null;
    return filteredSaves.find((s) => s.id === selectedSolution.previousVersionId) ?? null;
  }, [filteredSaves, selectedSolution]);

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Loading saved solutions…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">Error: {error}</p>;
  }

  if (filteredSaves.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No saved solutions for the selected location.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <VersionHistory
        solutions={filteredSaves}
        selectedVersionId={selectedVersionId ?? undefined}
        onVersionSelect={setSelectedVersionId}
      />
      {selectedSolution && previousSolution && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">Diff between version {previousSolution.version} and {selectedSolution.version}</h3>
          <SolutionDiffViewer
            oldSolution={previousSolution}
            newSolution={selectedSolution}
          />
        </div>
      )}
    </div>
  );
}
