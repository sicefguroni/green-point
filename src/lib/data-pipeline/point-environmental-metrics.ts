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

/**
 * Cached per rounded lat/lng to collapse nearby clicks and speed up the map.
 */
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
