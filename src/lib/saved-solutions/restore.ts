import type { BarangayData } from "@/context/BarangayContext";
import type { SavedSolutionRow } from "@/hooks/useSavedSolutions";
import { POINT_SELECTION_AREA_HECTARES } from "@/lib/selection-area";
import type { SelectedFeature } from "@/types/metrics";

/** Rebuilds the Explore selection a saved solution was made from. */

export type SavedSolutionLocationMetadata = {
  areaHectares?: number | null;
  address?: string | null;
  coords?: { lat: number; lng: number } | null;
  midpoint?: { lat: number; lng: number } | null;
};

export type SavedSolutionContextSnapshot = {
  ndvi?: number | null;
  greeneryIndex?: number | null;
  lst?: number | null;
  treeCanopy?: number | null;
  greeneryLevel?: string | null;
  floodExposure?: string | null;
  currentIntervention?: string | null;
  floodHazard?: number | null;
  stormHazard?: number | null;
  aqi?: number | null;
  areaHectares?: number | null;
};

export function getLocationMetadata(
  save: SavedSolutionRow,
): SavedSolutionLocationMetadata {
  return (save.locationMetadata as SavedSolutionLocationMetadata | null) ?? {};
}

export function getContextSnapshot(
  save: SavedSolutionRow,
): SavedSolutionContextSnapshot {
  return (save.contextSnapshot as SavedSolutionContextSnapshot | null) ?? {};
}

export function savedBarangayName(save: SavedSolutionRow): string {
  return (
    save.locationId?.trim() ||
    (save.locationName ?? "").replace(/^brgy\.?\s+/i, "").trim()
  );
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const FLOOD_LEVEL_LABELS: Record<number, string> = { 1: "Low", 2: "Medium", 3: "High" };

/**
 * Rebuild the barangay context Explore had when the solution was saved, so the
 * reopened detail prices the same barangay area instead of a 1 ha default.
 * Older saves have no area in `locationMetadata`; their `contextSnapshot` does.
 */
export function toSavedBarangayData(save: SavedSolutionRow): BarangayData | null {
  if (save.locationType.toLowerCase() !== "barangay") return null;
  const metadata = getLocationMetadata(save);
  const context = getContextSnapshot(save);
  const greeneryIndex = finiteOrNull(context.greeneryIndex);
  const ndvi = finiteOrNull(context.ndvi);
  const lst = finiteOrNull(context.lst);
  const treeCanopy = finiteOrNull(context.treeCanopy);
  if (greeneryIndex === null || ndvi === null || lst === null || treeCanopy === null) {
    return null;
  }
  const areaHectares =
    finiteOrNull(metadata.areaHectares) ?? finiteOrNull(context.areaHectares);
  const floodLevel = finiteOrNull(context.floodHazard);
  return {
    name: savedBarangayName(save),
    greeneryIndex,
    ndvi,
    lst,
    treeCanopy,
    floodExposure:
      context.floodExposure ??
      (floodLevel !== null ? FLOOD_LEVEL_LABELS[floodLevel] : undefined) ??
      "Unknown",
    currentIntervention: context.currentIntervention ?? "Unknown",
    greeneryLevel: context.greeneryLevel ?? undefined,
    ...(areaHectares !== null && areaHectares > 0 && { areaHectares }),
  };
}

export function toSelectedFeature(save: SavedSolutionRow): SelectedFeature {
  const metadata = getLocationMetadata(save);
  const context = getContextSnapshot(save);
  const coords = metadata.coords ?? metadata.midpoint ?? { lat: 0, lng: 0 };
  const locationType = save.locationType.toLowerCase();

  return {
    name: save.locationName || save.locationId || "Saved Location",
    address: metadata.address ?? "",
    barangay: locationType === "barangay" ? savedBarangayName(save) : "",
    coords,
    customSelectionAreaHectares:
      locationType === "custom" ? (metadata.areaHectares ?? null) : null,
    pointSelectionAreaHectares:
      locationType === "poi"
        ? (metadata.areaHectares ?? POINT_SELECTION_AREA_HECTARES)
        : null,
    properties: {
      ndvi: context.ndvi,
      temperature: context.lst,
      treeCanopy: context.treeCanopy,
      greeneryIndex: context.greeneryIndex,
    },
    hazards: {
      flood:
        context.floodHazard != null
          ? [{ id: "saved-flood", level: context.floodHazard }]
          : [],
      storm:
        context.stormHazard != null
          ? [{ id: "saved-storm", level: context.stormHazard }]
          : [],
      landslide: [],
      liquefaction: [],
      eil: [],
      air: context.aqi != null ? [{ AQI_Level: context.aqi }] : [],
    },
  };
}
