import * as turf from "@turf/turf";
import {
  buildGreeneryIndexFeatureCollection,
  getCachedBarangayGeeBundle,
} from "@/lib/data-pipeline/barangay-gee-bundle";
import { getCachedPointEnvironmentalMetrics } from "@/lib/data-pipeline/point-environmental-metrics";
import { getCachedMandaueBarangaysGi } from "@/lib/data-pipeline/static-geo-source";
import {
  computeInventoryCanopyFraction,
  getCachedTaggedTrees,
  type TreeInventoryRecord,
} from "@/lib/data-pipeline/tree-canopy";
import { getCachedWaqiAtPoint } from "@/lib/data-pipeline/waqi-cached";
import { floodLabelToHazard } from "@/lib/hazard-levels";
import { getCustomSelectionCentroid } from "@/lib/map/custom_selection";
import { POINT_SELECTION_AREA_HECTARES } from "@/lib/selection-area";
import type { LocationSelectionMode } from "@/types/maplayers";

/**
 * Location metrics the server derives itself, from the same live data Explore
 * and the dashboard display (`/api/data?resource=greeneryIndex`, `resource=point`
 * and `resource=waqi`). Generated recommendations are saved to a cache every
 * visitor reads, so they are never built from numbers the browser sent.
 */
export interface TrustedLocationMetrics {
  /**
   * Barangay the location lies in, resolved from the boundaries. Undefined for
   * a point outside every Mandaue barangay; the prompt then says "Unknown".
   */
  areaName: string | undefined;
  ndvi: number;
  lst: number;
  treeCanopy: number;
  greeneryIndex: number;
  greeneryLevel: string;
  taggedTreeCount: number;
  inventoryCanopyFraction: number;
  areaHectares: number | null;
  /** 1–3 from the host barangay's flood-exposure label; null when unknown. */
  floodHazard: number | null;
  /** Nearest WAQI station; null when the station or the API is unavailable. */
  aqi: number | null;
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

export interface FloodLabel {
  name: string;
  flood_exposure?: string;
}

export interface TrustedMetricsLoaders {
  loadGreeneryIndex: () => Promise<GeoJSON.FeatureCollection>;
  loadPointMetrics: (lat: number, lng: number) => Promise<Record<string, unknown>>;
  loadTaggedTrees: () => Promise<TreeInventoryRecord[]>;
  loadFloodLabels: () => Promise<FloodLabel[]>;
  loadAqiAt: (lat: number, lng: number) => Promise<number | null>;
}

const defaultLoaders: TrustedMetricsLoaders = {
  loadGreeneryIndex: async () =>
    buildGreeneryIndexFeatureCollection(await getCachedBarangayGeeBundle()),
  loadPointMetrics: async (lat, lng) =>
    (await getCachedPointEnvironmentalMetrics(lat, lng)).metrics,
  loadTaggedTrees: () => getCachedTaggedTrees(),
  loadFloodLabels: () => getCachedMandaueBarangaysGi(),
  loadAqiAt: async (lat, lng) => (await getCachedWaqiAtPoint(lat, lng))?.aqi ?? null,
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const nameKey = (name: string) => name.trim().toLowerCase();

function isPolygon(value: unknown): value is GeoJSON.Polygon {
  if (!value || typeof value !== "object") return false;
  const g = value as { type?: unknown; coordinates?: unknown };
  return (
    g.type === "Polygon" &&
    Array.isArray(g.coordinates) &&
    Array.isArray(g.coordinates[0]) &&
    g.coordinates[0].length >= 4
  );
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

/** Centre of mass of an area as { lat, lng }; the point Explore samples AQI at. */
function centreOf(geometry: GeoJSON.Geometry | null): { lat: number; lng: number } | null {
  if (!isAreaGeometry(geometry)) return null;
  try {
    const [lng, lat] = turf.centerOfMass(geometry).geometry.coordinates;
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/**
 * Environmental metrics of one barangay's live greenery-index feature, in the
 * shape Explore builds them (see buildExploreBarangayData).
 *
 * The bundle fills a barangay with no stored metrics with placeholders (NDVI
 * 0.3, LST 30 °C) and `lastUpdated: null`. Those are not live data, so such a
 * barangay has no metrics here.
 */
export function metricsFromGreeneryFeature(
  feature: GeoJSON.Feature,
): Omit<TrustedLocationMetrics, "floodHazard" | "aqi"> | null {
  const p = (feature.properties ?? {}) as Record<string, unknown>;
  if (typeof p.lastUpdated !== "string" || !p.lastUpdated) return null;
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
 * The centre is the one Explore uses (getCustomSelectionCentroid, a centre of
 * mass), so both pick the same barangay however densely the lasso was traced.
 */
export function metricsForCustomArea(
  polygon: GeoJSON.Polygon,
  greeneryIndex: GeoJSON.FeatureCollection,
  trees: TreeInventoryRecord[],
): Omit<TrustedLocationMetrics, "floodHazard" | "aqi"> | null {
  let centre: { lat: number; lng: number };
  let areaHectares: number | null;
  try {
    centre = getCustomSelectionCentroid(polygon);
    areaHectares = areaHectaresOf(polygon);
  } catch {
    return null;
  }
  if (!Number.isFinite(centre.lat) || !Number.isFinite(centre.lng)) return null;
  const host = featureContaining(greeneryIndex, [centre.lng, centre.lat]);
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

/**
 * Point metrics from `resource=point`. A point whose NDVI or LST is a
 * placeholder (cloud-masked pixel, no LST source) has no live metrics; so has
 * a payload without the `estimated` list, which cannot say either way.
 */
export function metricsFromPointPayload(
  m: Record<string, unknown>,
): Omit<TrustedLocationMetrics, "areaName" | "floodHazard" | "aqi"> | null {
  if (!Array.isArray(m.estimated) || m.estimated.length > 0) return null;
  const greeneryIndex = num(m.greeneryIndex);
  const ndvi = num(m.ndvi);
  const lst = num(m.lst);
  const treeCanopy = num(m.treeCanopy);
  if (greeneryIndex === null || ndvi === null || lst === null || treeCanopy === null) {
    return null;
  }
  return {
    ndvi,
    lst,
    treeCanopy,
    greeneryIndex,
    greeneryLevel: typeof m.greeneryLevel === "string" ? m.greeneryLevel : "",
    taggedTreeCount: num(m.nearbyTaggedTreeCount) ?? 0,
    inventoryCanopyFraction: num(m.inventoryCanopyFraction) ?? 0,
    areaHectares: POINT_SELECTION_AREA_HECTARES,
  };
}

async function floodHazardFor(
  areaName: string | undefined,
  loaders: TrustedMetricsLoaders,
): Promise<number | null> {
  if (!areaName) return null;
  try {
    const labels = await loaders.loadFloodLabels();
    const label = labels.find((l) => nameKey(l.name) === nameKey(areaName));
    return typeof label?.flood_exposure === "string"
      ? floodLabelToHazard(label.flood_exposure)
      : null;
  } catch (err) {
    console.warn("Flood labels unavailable for recommendation context:", err);
    return null;
  }
}

/** AQI is context, not a requirement: a failed station lookup leaves it null. */
async function aqiAt(
  at: { lat: number; lng: number } | null,
  loaders: TrustedMetricsLoaders,
): Promise<number | null> {
  if (!at) return null;
  try {
    const aqi = num(await loaders.loadAqiAt(at.lat, at.lng));
    return aqi !== null && aqi >= 0 ? aqi : null;
  } catch (err) {
    console.warn("AQI unavailable for recommendation context:", err);
    return null;
  }
}

type BaseResult =
  | { ok: true; base: Omit<TrustedLocationMetrics, "floodHazard" | "aqi">; at: { lat: number; lng: number } | null }
  | { ok: false; reason: "not_found" | "unavailable" };

async function resolveBase(
  target: TrustedMetricsTarget,
  loaders: TrustedMetricsLoaders,
): Promise<BaseResult> {
  if (target.mode === "barangay") {
    if (!target.barangayName) return { ok: false, reason: "not_found" };
    const fc = await loaders.loadGreeneryIndex();
    const wanted = nameKey(target.barangayName);
    const feature = fc.features.find((f) => {
      const name = featureName(f);
      return name !== null && nameKey(name) === wanted;
    });
    const base = feature ? metricsFromGreeneryFeature(feature) : null;
    return base && feature
      ? { ok: true, base, at: centreOf(feature.geometry) }
      : { ok: false, reason: "not_found" };
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
    const point = metricsFromPointPayload(m);
    if (!point) return { ok: false, reason: "not_found" };
    const host = featureContaining(fc, [lng, lat]);
    return {
      ok: true,
      base: { ...point, areaName: host ? (featureName(host) ?? undefined) : undefined },
      at: { lat, lng },
    };
  }

  if (target.mode === "custom") {
    if (!isPolygon(target.customSelectionGeometry)) {
      return { ok: false, reason: "not_found" };
    }
    const polygon = target.customSelectionGeometry;
    const [fc, trees] = await Promise.all([
      loaders.loadGreeneryIndex(),
      loaders.loadTaggedTrees(),
    ]);
    const base = metricsForCustomArea(polygon, fc, trees);
    if (!base) return { ok: false, reason: "not_found" };
    let at: { lat: number; lng: number } | null = null;
    try {
      at = getCustomSelectionCentroid(polygon);
    } catch {
      /* metricsForCustomArea already found a centre, so this does not happen */
    }
    return { ok: true, base, at };
  }

  return { ok: false, reason: "not_found" };
}

export async function resolveTrustedLocationMetrics(
  target: TrustedMetricsTarget,
  loaders: TrustedMetricsLoaders = defaultLoaders,
): Promise<TrustedMetricsResult> {
  let resolved: BaseResult;
  try {
    resolved = await resolveBase(target, loaders);
  } catch (err) {
    console.error("Error resolving location metrics:", err);
    return { ok: false, reason: "unavailable" };
  }
  if (!resolved.ok) return resolved;

  const [floodHazard, aqi] = await Promise.all([
    floodHazardFor(resolved.base.areaName, loaders),
    aqiAt(resolved.at, loaders),
  ]);
  return { ok: true, metrics: { ...resolved.base, floodHazard, aqi } };
}

/**
 * Storm-surge levels exist only in the browser's map layers, so the request's
 * value is used, but only as a real level (0–3).
 */
export function boundedHazardLevel(value: unknown): number | null {
  const n = num(value);
  return n !== null && Number.isInteger(n) && n >= 0 && n <= 3 ? n : null;
}
