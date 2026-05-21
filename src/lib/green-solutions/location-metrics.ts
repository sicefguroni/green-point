import type { BarangayData } from "@/context/BarangayContext";
import type { SelectedFeature } from "@/types/metrics";

export type LocationMetricKey = "greeneryIndex" | "ndvi" | "treeCanopy" | "lst";

export interface LocationMetricsSnapshot {
  greeneryIndex: number | null;
  ndvi: number | null;
  treeCanopy: number | null;
  lst: number | null;
  customAreaHectares: number | null;
  sectionTitle: string;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readFeatureMetrics(feature: SelectedFeature) {
  const props = feature.properties;
  return {
    greeneryIndex: toFiniteNumber(props?.greeneryIndex),
    ndvi: toFiniteNumber(props?.ndvi),
    treeCanopy: toFiniteNumber(props?.treeCanopy),
    lst: toFiniteNumber(props?.temperature ?? props?.lst),
  };
}

function hasAnyMetric(metrics: {
  greeneryIndex: number | null;
  ndvi: number | null;
  treeCanopy: number | null;
  lst: number | null;
}) {
  return (
    metrics.greeneryIndex !== null ||
    metrics.ndvi !== null ||
    metrics.treeCanopy !== null ||
    metrics.lst !== null
  );
}

/** Resolve environmental metrics for the selected site (point props or barangay context). */
export function resolveLocationMetrics(
  selectedFeature: SelectedFeature,
  selectedBarangayData: BarangayData | null,
): LocationMetricsSnapshot | null {
  const customAreaHectares =
    selectedFeature.customSelectionAreaHectares ??
    selectedBarangayData?.areaHectares ??
    null;

  const fromFeature = readFeatureMetrics(selectedFeature);
  if (hasAnyMetric(fromFeature)) {
    return {
      ...fromFeature,
      customAreaHectares,
      sectionTitle: selectedFeature.customSelectionGeometry
        ? "Selected Area Metrics"
        : "Site Environmental Metrics",
    };
  }

  if (selectedBarangayData) {
    return {
      greeneryIndex: selectedBarangayData.greeneryIndex,
      ndvi: selectedBarangayData.ndvi,
      treeCanopy: selectedBarangayData.treeCanopy,
      lst: selectedBarangayData.lst,
      customAreaHectares,
      sectionTitle: selectedBarangayData.name
        ? `Barangay ${selectedBarangayData.name} Metrics`
        : "Location Metrics",
    };
  }

  if (customAreaHectares !== null) {
    return {
      greeneryIndex: null,
      ndvi: null,
      treeCanopy: null,
      lst: null,
      customAreaHectares,
      sectionTitle: "Selected Area",
    };
  }

  return null;
}

export function formatLocationMetricValue(
  key: LocationMetricKey,
  value: number,
): string {
  if (key === "lst") return `${value.toFixed(0)}°C`;
  if (key === "treeCanopy") return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(2);
}

export const LOCATION_METRIC_LABELS: Record<LocationMetricKey, string> = {
  greeneryIndex: "Greenery Index",
  ndvi: "NDVI",
  treeCanopy: "Tree Canopy",
  lst: "Surface Temp",
};
