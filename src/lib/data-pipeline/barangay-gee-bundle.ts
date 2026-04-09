import { unstable_cache } from "next/cache";
import { fetchGeeMetricsBulk } from "@/lib/api/gee_service";
import {
  calculateGreeneryIndex,
  estimateGreenArea,
  estimateTreeCanopy,
} from "@/lib/api/greenery_index";
import { computeBarangayCentroids } from "@/lib/geo/centroids";
import {
  CACHE_TAG_BARANGAY_GEE,
  REVALIDATE_BARANGAY_GEE_BUNDLE,
} from "@/lib/data-pipeline/constants";
import { getCachedMandaueBarangayBoundaries } from "@/lib/data-pipeline/static-geo-source";

export type BarangayGeeMetrics = { ndvi: number | null; lst: number | null };

export type BarangayGeeBundle = {
  byName: Record<string, BarangayGeeMetrics>;
  bounds: GeoJSON.FeatureCollection;
  dateKey: string;
};

/**
 * Single GEE reduceRegions pass for all barangay centroids (used by LST, NDVI, Greenery Index layers).
 */
async function loadBarangayGeeBundleUncached(): Promise<BarangayGeeBundle> {
  const bounds = await getCachedMandaueBarangayBoundaries();
  const centroids = computeBarangayCentroids(bounds);
  const map = await fetchGeeMetricsBulk(centroids);

  const byName: Record<string, BarangayGeeMetrics> = {};
  for (const [name, v] of map) {
    byName[name] = v;
  }

  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return { byName, bounds, dateKey };
}

export const getCachedBarangayGeeBundle = unstable_cache(
  loadBarangayGeeBundleUncached,
  ["data-pipeline", "barangay-gee-bundle", "mandaue-v1"],
  {
    revalidate: REVALIDATE_BARANGAY_GEE_BUNDLE,
    tags: [CACHE_TAG_BARANGAY_GEE],
  },
);

export function buildLstFeatureCollection(
  bundle: BarangayGeeBundle,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = bundle.bounds.features.map((f) => {
    const name = f.properties?.name;
    const data = name ? bundle.byName[name] : undefined;
    return {
      type: "Feature",
      geometry: f.geometry,
      properties: {
        type: "surface",
        name,
        temperature: data?.lst ?? null,
        date: bundle.dateKey,
        source: "MODIS (via GEE)",
      },
    };
  });
  return { type: "FeatureCollection", features };
}

export function buildNdviFeatureCollection(
  bundle: BarangayGeeBundle,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = bundle.bounds.features.map((f) => {
    const name = f.properties?.name;
    const data = name ? bundle.byName[name] : undefined;
    return {
      type: "Feature",
      geometry: f.geometry,
      properties: {
        type: "vegetation",
        name,
        ndvi: data?.ndvi ?? null,
        date: bundle.dateKey,
        source: data?.ndvi !== null ? "Sentinel-2 (via GEE)" : "unavailable",
      },
    };
  });
  return { type: "FeatureCollection", features };
}

export function buildGreeneryIndexFeatureCollection(
  bundle: BarangayGeeBundle,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = bundle.bounds.features.map((f) => {
    const name = f.properties?.name;
    const data = name ? bundle.byName[name] : undefined;
    const lst = data?.lst ?? 30;
    const ndvi = data?.ndvi ?? 0.3;
    const treeCanopy = estimateTreeCanopy(ndvi, lst);
    const greenArea = estimateGreenArea(ndvi, 1);
    const gi = calculateGreeneryIndex({ ndvi, lst, treeCanopy, greenArea });

    return {
      type: "Feature",
      geometry: f.geometry,
      properties: {
        type: "greenery",
        name,
        greeneryIndex: gi.greeneryIndex,
        level: gi.level,
        ndvi: gi.metrics.ndvi,
        lst: gi.metrics.lst,
        treeCanopy: gi.metrics.treeCanopy,
        date: bundle.dateKey,
      },
    };
  });
  return { type: "FeatureCollection", features };
}
