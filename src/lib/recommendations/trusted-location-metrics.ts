import * as turf from "@turf/turf";
import {
  buildGreeneryIndexFeatureCollection,
  getCachedBarangayGeeBundle,
} from "@/lib/data-pipeline/barangay-gee-bundle";
import { getCachedPointEnvironmentalMetrics } from "@/lib/data-pipeline/point-environmental-metrics";
import {
  computeInventoryCanopyFraction,
  getCachedTaggedTrees,
  type TreeInventoryRecord,
} from "@/lib/data-pipeline/tree-canopy";
import { POINT_SELECTION_AREA_HECTARES } from "@/lib/selection-area";
import type { LocationSelectionMode } from "@/types/maplayers";

/**
 * Location metrics the server derives itself, from the same live data Explore
 * and the dashboard display (`/api/data?resource=greeneryIndex` and
 * `resource=point`). Generated recommendations are saved to a cache every
 * visitor reads, so they are never built from numbers the browser sent.
 */
export interface TrustedLocationMetrics {
  /** Barangay the location lies in, resolved from the boundaries. */
  areaName: string | undefined;
  ndvi: number;
  lst: number;
  treeCanopy: number;
  greeneryIndex: number;
  greeneryLevel: string;
  taggedTreeCount: number;
  inventoryCanopyFraction: number;
  areaHectares: number | null;
}

export type TrustedMetricsResult =
  | { ok: true; metrics: TrustedLocationMetrics }
  | { ok: false; reason: "not_found" | "unavailable" };

export interface TrustedMetricsTarget {
  mode: LocationSelectionMode | undefined;
  /** Canonical DB name of the barangay (barangay mode). */
  barangayName?: string;
  coords?: { lat: number; lng: number };
  customSelectionGeometry?: unknown;
}

export interface TrustedMetricsLoaders {
  loadGreeneryIndex: () => Promise<GeoJSON.FeatureCollection>;
  loadPointMetrics: (lat: number, lng: number) => Promise<Record<string, unknown>>;
  loadTaggedTrees: () => Promise<TreeInventoryRecord[]>;
}

const defaultLoaders: TrustedMetricsLoaders = {
  loadGreeneryIndex: async () =>
    buildGreeneryIndexFeatureCollection(await getCachedBarangayGeeBundle()),
  loadPointMetrics: async (lat, lng) =>
    (await getCachedPointEnvironmentalMetrics(lat, lng)).metrics,
  loadTaggedTrees: () => getCachedTaggedTrees(),
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const nameKey = (name: string) => name.trim().toLowerCase();

function isPolygon(value: unknown): value is GeoJSON.Polygon {
  if (!value || typeof value !== "object") return false;
  const g = value as { type?: unknown; coordinates?: unknown };
  return g.type === "Polygon" && Array.isArray(g.coordinates);
}

function featureName(f: GeoJSON.Feature): string | null {
  const name = f.properties?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function isAreaGeometry(
  g: GeoJSON.Geometry | null,
): g is GeoJSON.Polygon | GeoJSON.MultiPolygon {
  return g?.type === "Polygon" || g?.type === "MultiPolygon";
}

/** The barangay feature containing a [lng, lat] position, if any. */
function featureContaining(
  fc: GeoJSON.FeatureCollection,
  position: [number, number],
): GeoJSON.Feature | null {
  const pt = turf.point(position);
  for (const f of fc.features) {
    if (!isAreaGeometry(f.geometry)) continue;
    try {
      if (turf.booleanPointInPolygon(pt, f.geometry)) return f;
    } catch {
      /* invalid boundary geometry: skip it */
    }
  }
  return null;
}

function areaHectaresOf(geometry: GeoJSON.Geometry | null): number | null {
  if (!geometry) return null;
  try {
    const sqm = turf.area(geometry);
    return Number.isFinite(sqm) && sqm > 0 ? sqm / 10_000 : null;
  } catch {
    return null;
  }
}

/**
 * Metrics of one barangay's live greenery-index feature, in the shape Explore
 * builds them (see buildExploreBarangayData). A feature with no live GI has
 * no metrics.
 */
export function metricsFromGreeneryFeature(
  feature: GeoJSON.Feature,
): TrustedLocationMetrics | null {
  const p = (feature.properties ?? {}) as Record<string, unknown>;
  const greeneryIndex = num(p.greeneryIndex);
  const ndvi = num(p.ndvi);
  const lst = num(p.lst);
  const treeCanopy = num(p.treeCanopy);
  if (greeneryIndex === null || ndvi === null || lst === null || treeCanopy === null) {
    return null;
  }
  return {
    areaName: featureName(feature) ?? undefined,
    ndvi,
    lst,
    treeCanopy,
    greeneryIndex,
    greeneryLevel: typeof p.level === "string" ? p.level : "",
    taggedTreeCount: num(p.inventoryTreeCount) ?? 0,
    inventoryCanopyFraction: num(p.inventoryCanopyFraction) ?? 0,
    areaHectares: areaHectaresOf(feature.geometry),
  };
}

/**
 * A drawn area takes the environmental metrics of the barangay its centre lies
 * in, and the tree inventory inside the polygon itself, as Explore shows it.
 */
export function metricsForCustomArea(
  polygon: GeoJSON.Polygon,
  greeneryIndex: GeoJSON.FeatureCollection,
  trees: TreeInventoryRecord[],
): TrustedLocationMetrics | null {
  let centre: [number, number];
  let areaHectares: number | null;
  try {
    centre = turf.centroid(polygon).geometry.coordinates as [number, number];
    areaHectares = areaHectaresOf(polygon);
  } catch {
    return null;
  }
  const host = featureContaining(greeneryIndex, centre);
  const base = host ? metricsFromGreeneryFeature(host) : null;
  if (!base) return null;

  const inside = trees.filter((t) => {
    try {
      return turf.booleanPointInPolygon(
        turf.point([t.longitude, t.latitude]),
        polygon,
      );
    } catch {
      return false;
    }
  });
  return {
    ...base,
    taggedTreeCount: inside.length,
    inventoryCanopyFraction:
      areaHectares !== null
        ? computeInventoryCanopyFraction(inside, areaHectares * 10_000)
        : 0,
    areaHectares,
  };
}

export async function resolveTrustedLocationMetrics(
  target: TrustedMetricsTarget,
  loaders: TrustedMetricsLoaders = defaultLoaders,
): Promise<TrustedMetricsResult> {
  try {
    if (target.mode === "barangay") {
      if (!target.barangayName) return { ok: false, reason: "not_found" };
      const fc = await loaders.loadGreeneryIndex();
      const wanted = nameKey(target.barangayName);
      const feature = fc.features.find((f) => {
        const name = featureName(f);
        return name !== null && nameKey(name) === wanted;
      });
      const metrics = feature ? metricsFromGreeneryFeature(feature) : null;
      return metrics ? { ok: true, metrics } : { ok: false, reason: "not_found" };
    }

    if (target.mode === "poi") {
      const { coords } = target;
      if (!coords || num(coords.lat) === null || num(coords.lng) === null) {
        return { ok: false, reason: "not_found" };
      }
      // Same rounding as the shared cache key the result is saved under.
      const lat = Math.round(coords.lat * 10000) / 10000;
      const lng = Math.round(coords.lng * 10000) / 10000;
      const [m, fc] = await Promise.all([
        loaders.loadPointMetrics(lat, lng),
        loaders.loadGreeneryIndex(),
      ]);
      const greeneryIndex = num(m.greeneryIndex);
      const ndvi = num(m.ndvi);
      const lst = num(m.lst);
      const treeCanopy = num(m.treeCanopy);
      if (greeneryIndex === null || ndvi === null || lst === null || treeCanopy === null) {
        return { ok: false, reason: "unavailable" };
      }
      const host = featureContaining(fc, [lng, lat]);
      return {
        ok: true,
        metrics: {
          areaName: host ? (featureName(host) ?? undefined) : undefined,
          ndvi,
          lst,
          treeCanopy,
          greeneryIndex,
          greeneryLevel: typeof m.greeneryLevel === "string" ? m.greeneryLevel : "",
          taggedTreeCount: num(m.nearbyTaggedTreeCount) ?? 0,
          inventoryCanopyFraction: num(m.inventoryCanopyFraction) ?? 0,
          areaHectares: POINT_SELECTION_AREA_HECTARES,
        },
      };
    }

    if (target.mode === "custom") {
      if (!isPolygon(target.customSelectionGeometry)) {
        return { ok: false, reason: "not_found" };
      }
      const [fc, trees] = await Promise.all([
        loaders.loadGreeneryIndex(),
        loaders.loadTaggedTrees(),
      ]);
      const metrics = metricsForCustomArea(target.customSelectionGeometry, fc, trees);
      return metrics ? { ok: true, metrics } : { ok: false, reason: "not_found" };
    }

    return { ok: false, reason: "not_found" };
  } catch (err) {
    console.error("Error resolving location metrics:", err);
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Hazard levels (0–3) and AQI only exist in the browser's map layers, so they
 * are still taken from the request, but only as values in their real range.
 */
export function boundedHazardLevel(value: unknown): number | null {
  const n = num(value);
  return n !== null && Number.isInteger(n) && n >= 0 && n <= 3 ? n : null;
}

export function boundedAqi(value: unknown): number | null {
  const n = num(value);
  return n !== null && n >= 0 && n <= 500 ? n : null;
}
