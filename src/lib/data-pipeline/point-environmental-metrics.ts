import { unstable_cache } from "next/cache";
import { fetchNasaPowerPoint } from "@/lib/api/nasa_power";
import { fetchGeeMetricsPoint } from "@/lib/api/gee_service";
import {
  calculateGreeneryIndex,
  estimateGreenArea,
  estimateTreeCanopy,
} from "@/lib/api/greenery_index";
import { REVALIDATE_POINT_METRICS } from "@/lib/data-pipeline/constants";
import {
  blendCanopy,
  computePointInventoryCanopy,
  getCachedTaggedTrees,
} from "@/lib/data-pipeline/tree-canopy";
import { prisma } from "@/lib/prisma";

export type PointEnvironmentalPayload = {
  success: true;
  coordinates: { lat: number; lng: number };
  metrics: {
    lst: number;
    t2m: number | null;
    humidity: number | null;
    precipitation: number | null;
    ndvi: number;
    treeCanopy: number;
    inventoryCanopyFraction: number;
    nearbyTaggedTreeCount: number;
    greenArea: number;
    greeneryIndex: number;
    greeneryLevel: string;
    aqi: number | null;
    breakdown: ReturnType<typeof calculateGreeneryIndex>["breakdown"];
    timestamp: string;
  };
  sources: Record<string, string>;
};

function roundCoord(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

async function computePointEnvironmentalMetrics(
  lat: number,
  lng: number,
): Promise<PointEnvironmentalPayload> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Check DB for recent history at these coordinates (using exact object match on rounded coords)
  const existing = await prisma.userLocationMetricHistory.findFirst({
    where: {
      locationType: { in: ["POINT", "CUSTOM"] },
      createdAt: { gte: today },
      coordinates: {
        equals: { lat, lng },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const giResult = calculateGreeneryIndex({
      ndvi: existing.ndvi ?? 0.3,
      lst: existing.lst ?? 30,
      treeCanopy: existing.treeCanopy ?? 0.1,
      greenArea: 0,
    });

    return {
      success: true,
      coordinates: { lat, lng },
      metrics: {
        lst: existing.lst ?? 30,
        ndvi: existing.ndvi ?? 0.3,
        treeCanopy: existing.treeCanopy ?? 0.1,
        greeneryIndex: existing.greeneryIndex ?? giResult.greeneryIndex,
        greeneryLevel: existing.greeneryLevel ?? giResult.level,
        aqi: existing.aqi ?? 50,
        t2m: null,
        humidity: null,
        precipitation: null,
        inventoryCanopyFraction: 0,
        nearbyTaggedTreeCount: 0,
        greenArea: 0,
        breakdown: giResult.breakdown,
        timestamp: existing.createdAt.toISOString(),
      },
      sources: {
        cache: "Database History Cache (Today)",
      },
    };
  }

  const [nasaData, geeData, allTrees] = await Promise.all([
    fetchNasaPowerPoint(lat, lng),
    fetchGeeMetricsPoint(lat, lng),
    getCachedTaggedTrees(),
  ]);

  const lst = geeData.lst ?? nasaData.lst ?? 30;
  const ndvi = geeData.ndvi ?? 0.3;
  const spectralCanopy = estimateTreeCanopy(ndvi, lst);
  const inventoryCanopy = computePointInventoryCanopy(lat, lng, allTrees);
  const nearbyCount = allTrees.filter((t) => {
    const dx = Math.abs(t.latitude - lat);
    const dy = Math.abs(t.longitude - lng);
    return dx < 0.002 && dy < 0.002;
  }).length;
  const treeCanopy = blendCanopy(
    inventoryCanopy,
    spectralCanopy,
    nearbyCount > 0,
  );

  const greenArea = estimateGreenArea(ndvi, 1);
  const giResult = calculateGreeneryIndex({
    ndvi,
    lst,
    treeCanopy,
    greenArea,
  });

  return {
    success: true,
    coordinates: { lat, lng },
    metrics: {
      lst,
      t2m: nasaData.t2m,
      humidity: nasaData.humidity,
      precipitation: nasaData.precipitation,
      ndvi,
      treeCanopy,
      inventoryCanopyFraction: inventoryCanopy,
      nearbyTaggedTreeCount: nearbyCount,
      greenArea,
      greeneryIndex: giResult.greeneryIndex,
      greeneryLevel: giResult.level,
      aqi: null, // AQI for points is handled separately via the 'waqi' resource
      breakdown: giResult.breakdown,
      timestamp: nasaData.timestamp,
    },
    sources: {
      lst: "MODIS LST via Google Earth Engine",
      ndvi: "Sentinel-2 via Google Earth Engine",
      treeCanopy:
        nearbyCount > 0
          ? `Blended: ${nearbyCount} tagged tree(s) within 150m + NDVI spectral estimate`
          : "Derived from NDVI and LST (no tagged trees nearby)",
      greeneryIndex:
        "Weighted calculation (NDVI 35%, LST 25%, Canopy 25%, Green Area 15%)",
    },
  };
}

export async function getCachedPointEnvironmentalMetrics(
  lat: number,
  lng: number,
): Promise<PointEnvironmentalPayload> {
  const rLat = roundCoord(lat, 4);
  const rLng = roundCoord(lng, 4);

  const cached = unstable_cache(
    async () => computePointEnvironmentalMetrics(rLat, rLng),
    ["data-pipeline", "point-environmental", String(rLat), String(rLng)],
    { revalidate: REVALIDATE_POINT_METRICS },
  );

  return cached();
}
