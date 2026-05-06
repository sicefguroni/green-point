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
import {
  blendCanopy,
  computeInventoryCanopyFraction,
  getCachedTaggedTrees,
  groupTreesByBarangay,
  type TreeInventoryRecord,
} from "@/lib/data-pipeline/tree-canopy";
import { prisma } from "@/lib/prisma";

export type BarangayGeeMetrics = { ndvi: number | null; lst: number | null };

export type BarangayGeeBundle = {
  byName: Record<string, BarangayGeeMetrics>;
  bounds: GeoJSON.FeatureCollection;
  dateKey: string;
  treesByBarangay: Record<string, TreeInventoryRecord[]>;
};

/**
 * Single GEE reduceRegions pass for all barangay centroids (used by LST, NDVI, Greenery Index layers).
 */
async function loadBarangayGeeBundleUncached(): Promise<BarangayGeeBundle> {
  const [bounds, allTrees] = await Promise.all([
    getCachedMandaueBarangayBoundaries(),
    getCachedTaggedTrees(),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Check database for existing metrics from today
  const existingMetrics = await prisma.barangay.findMany({
    include: {
      metrics: {
        where: {
          lastUpdated: {
            gte: today,
          },
        },
      },
    },
  });

  const byName: Record<string, BarangayGeeMetrics> = {};
  const missingBarangays: { name: string; lat: number; lng: number }[] = [];

  const centroids = computeBarangayCentroids(bounds);

  for (const c of centroids) {
    const dbMatch = existingMetrics.find(
      (b) => b.barangayName.toLowerCase() === c.name.toLowerCase(),
    );

    if (dbMatch?.metrics) {
      // Use DB cache
      byName[c.name] = {
        ndvi: dbMatch.metrics.NDVI,
        lst: dbMatch.metrics.LST,
      };
    } else {
      // Add to list for GEE fetch
      missingBarangays.push(c);
    }
  }

  // 2. Fetch missing metrics from Earth Engine if needed
  if (missingBarangays.length > 0) {
    const geeMap = await fetchGeeMetricsBulk(missingBarangays);

    for (const [name, v] of geeMap) {
      byName[name] = v;

      // 3. Update DB cache for these barangays
      const b = existingMetrics.find(
        (bm) => bm.barangayName.toLowerCase() === name.toLowerCase(),
      );
      if (b) {
        await prisma.barangayMetrics.upsert({
          where: { barangayID: b.id },
          update: {
            NDVI: v.ndvi,
            LST: v.lst,
            lastUpdated: new Date(),
          },
          create: {
            barangayID: b.id,
            NDVI: v.ndvi,
            LST: v.lst,
          },
        });
      }
    }
  }

  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const treesByBarangay = groupTreesByBarangay(allTrees);

  return { byName, bounds, dateKey, treesByBarangay };
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

function polygonAreaM2(geometry: GeoJSON.Geometry): number {
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return 0;
  const rings =
    geometry.type === "Polygon"
      ? [geometry.coordinates[0]]
      : geometry.coordinates.map((p) => p[0]);

  let totalArea = 0;
  const DEG_TO_M_LAT = 111_320;
  for (const ring of rings) {
    const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    const degToMLng = DEG_TO_M_LAT * Math.cos((lat * Math.PI) / 180);
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      area +=
        ring[j][0] * degToMLng * (ring[i][1] * DEG_TO_M_LAT) -
        ring[i][0] * degToMLng * (ring[j][1] * DEG_TO_M_LAT);
    }
    totalArea += Math.abs(area) / 2;
  }
  return totalArea;
}

export function buildGreeneryIndexFeatureCollection(
  bundle: BarangayGeeBundle,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = bundle.bounds.features.map((f) => {
    const name = f.properties?.name;
    const data = name ? bundle.byName[name] : undefined;
    const lst = data?.lst ?? 30;
    const ndvi = data?.ndvi ?? 0.3;
    const spectralCanopy = estimateTreeCanopy(ndvi, lst);

    const barangayTrees = name ? (bundle.treesByBarangay[name] ?? []) : [];
    const areaM2 = f.geometry ? polygonAreaM2(f.geometry) : 0;
    const inventoryCanopy = computeInventoryCanopyFraction(
      barangayTrees,
      areaM2,
    );
    const treeCanopy = blendCanopy(
      inventoryCanopy,
      spectralCanopy,
      barangayTrees.length > 0,
    );

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
        inventoryTreeCount: barangayTrees.length,
        inventoryCanopyFraction: inventoryCanopy,
        date: bundle.dateKey,
      },
    };
  });
  return { type: "FeatureCollection", features };
}
