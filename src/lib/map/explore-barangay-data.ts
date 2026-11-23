import * as turf from "@turf/turf";
import type { BarangayData } from "@/context/BarangayContext";
import { getLevel } from "@/lib/api/greenery_index";

/** A row of `public/geo/mandaue_barangays_gi.geojson`. Only its labels are used. */
export interface StaticBarangayLabels {
  name: string;
  flood_exposure?: string;
  current_intervention?: string;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const key = (name: string) => name.trim().toLowerCase();

/**
 * Explore's per-barangay metrics, from the same live greenery-index data the
 * dashboard uses (`/api/data?resource=greeneryIndex`).
 *
 * `mandaue_barangays_gi.geojson` only supplies the flood-exposure and
 * current-intervention labels. Its GI, NDVI, LST and canopy numbers are
 * placeholders (Tabok: GI 0.64, NDVI 0.64, 37 °C, 81 % canopy, against a
 * stored GI of 0.17), so they are never used. A barangay with no live GI is
 * left out rather than shown with made-up numbers.
 */
export function buildExploreBarangayData(
  boundaries: GeoJSON.FeatureCollection,
  live: GeoJSON.FeatureCollection,
  labels: StaticBarangayLabels[] = [],
): BarangayData[] {
  const liveByName = new Map<string, Record<string, unknown>>();
  for (const f of live.features) {
    const name = f.properties?.name;
    if (typeof name === "string" && name.trim()) {
      liveByName.set(key(name), f.properties as Record<string, unknown>);
    }
  }
  const labelByName = new Map(labels.map((l) => [key(l.name), l]));

  const out: BarangayData[] = [];
  for (const f of boundaries.features) {
    const name = f.properties?.name;
    if (typeof name !== "string" || !name.trim()) continue;
    const p = liveByName.get(key(name));
    const greeneryIndex = num(p?.greeneryIndex);
    if (!p || greeneryIndex === null) continue;

    let areaHectares: number | undefined;
    try {
      const sqm = f.geometry ? turf.area(f) : 0;
      if (Number.isFinite(sqm) && sqm > 0) areaHectares = sqm / 10_000;
    } catch {
      /* invalid geometry: leave the area unset */
    }

    const label = labelByName.get(key(name));
    out.push({
      name: name.trim(),
      greeneryIndex,
      ndvi: num(p.ndvi) ?? 0,
      lst: num(p.lst) ?? 0,
      treeCanopy: num(p.treeCanopy) ?? 0,
      greeneryLevel:
        typeof p.level === "string" && p.level ? p.level : getLevel(greeneryIndex),
      taggedTreeCount: num(p.inventoryTreeCount) ?? 0,
      inventoryCanopyFraction: num(p.inventoryCanopyFraction) ?? 0,
      areaHectares,
      floodExposure: label?.flood_exposure ?? "",
      currentIntervention: label?.current_intervention ?? "",
    });
  }
  return out;
}
