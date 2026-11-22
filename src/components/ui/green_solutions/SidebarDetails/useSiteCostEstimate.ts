"use client";

import { useEffect, useState } from "react";
import { type BarangayData } from "@/context/BarangayContext";
import { type UIRecommendation } from "@/lib/recommendations";
import { resolveSelectedAreaHectares } from "@/lib/selection-area";
import { canonicalTreatedAreaSqm } from "@/lib/simulation/cost-model";
import { type SelectedFeature } from "@/types/metrics";
import { type CostEstimate } from "@/types/green_solutions";

/**
 * The intervention text sent to `/api/cost-estimate`. Title and type together
 * help the matcher, but when they are the same string it was sent twice
 * ("Targeted Infill Targeted Infill").
 */
export function costEstimateInterventionType(
  recommendation: Pick<UIRecommendation, "solutionTitle" | "interventionType">,
): string {
  const parts = [recommendation.solutionTitle, recommendation.interventionType]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  const unique = parts.filter(
    (value, index) =>
      parts.findIndex((other) => other.toLowerCase() === value.toLowerCase()) ===
      index,
  );
  return unique.join(" ");
}

/**
 * One cost estimate per open recommendation, shared by the Info tab's cost card
 * and the report export so the two can never disagree. Prices the canonical
 * treated footprint of the selected site (custom area, pin radius, or barangay).
 */
export function useSiteCostEstimate(
  recommendation: UIRecommendation,
  selectedFeature: SelectedFeature,
  selectedBarangayData: BarangayData | null,
) {
  const siteAreaHectares = resolveSelectedAreaHectares({
    customSelectionAreaHectares: selectedFeature.customSelectionAreaHectares,
    pointSelectionAreaHectares: selectedFeature.pointSelectionAreaHectares,
    barangayAreaHectares: selectedBarangayData?.areaHectares,
  });
  const interventionType = costEstimateInterventionType(recommendation);
  const treatedAreaSqm = canonicalTreatedAreaSqm(interventionType, siteAreaHectares);
  const treatedAreaHectares =
    treatedAreaSqm !== null ? treatedAreaSqm / 10000 : null;
  const barangayId =
    selectedFeature.barangay?.trim().length > 0 ? selectedFeature.barangay : null;
  const fallback = recommendation.costEstimate ?? null;

  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(fallback);
  const [isLoading, setIsLoading] = useState(!fallback);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setCostEstimate(null);

    const params = new URLSearchParams({
      interventionType,
      ...(treatedAreaSqm !== null && { area: treatedAreaSqm.toString() }),
      ...(barangayId && { barangayId }),
    });

    fetch(`/api/cost-estimate?${params}`)
      .then((response) => response.json())
      .then((result) => {
        if (cancelled) return;
        setCostEstimate(result?.success ? (result.data as CostEstimate) : fallback);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to fetch cost estimate:", error);
        setCostEstimate(fallback);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [interventionType, treatedAreaSqm, barangayId, fallback]);

  return { costEstimate, isLoading, siteAreaHectares, treatedAreaHectares };
}
