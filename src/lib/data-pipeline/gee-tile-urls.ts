import { unstable_cache } from "next/cache";
import {
  getCanopyTileUrl,
  getGiTileUrl,
  getLstTileUrl,
  getNdviTileUrl,
  type TreePoint,
} from "@/lib/api/gee_service";
import {
  CACHE_TAG_GEE_TILES,
  REVALIDATE_GEE_TILE_URLS,
} from "@/lib/data-pipeline/constants";
import { getCachedTaggedTrees } from "@/lib/data-pipeline/tree-canopy";

export const getCachedNdviTileUrl = unstable_cache(
  async () => getNdviTileUrl(),
  ["data-pipeline", "gee-tile", "ndvi"],
  { revalidate: REVALIDATE_GEE_TILE_URLS, tags: [CACHE_TAG_GEE_TILES] },
);

export const getCachedLstTileUrl = unstable_cache(
  async () => getLstTileUrl(),
  ["data-pipeline", "gee-tile", "lst"],
  { revalidate: REVALIDATE_GEE_TILE_URLS, tags: [CACHE_TAG_GEE_TILES] },
);

async function loadCanopyTileUrl(): Promise<string> {
  let points: TreePoint[] = [];
  try {
    const trees = await getCachedTaggedTrees();
    points = trees.map((t) => ({
      lat: t.latitude,
      lng: t.longitude,
      dbhCm: t.dbhCm,
    }));
  } catch (err) {
    console.warn("[canopy tile] DB unavailable, using spectral fallback:", err);
  }
  return getCanopyTileUrl(points);
}

export const getCachedCanopyTileUrl = unstable_cache(
  loadCanopyTileUrl,
  ["data-pipeline", "gee-tile", "canopy-v4"],
  { revalidate: REVALIDATE_GEE_TILE_URLS, tags: [CACHE_TAG_GEE_TILES] },
);

async function loadGiTileUrl(): Promise<string> {
  let points: TreePoint[] = [];
  try {
    const trees = await getCachedTaggedTrees();
    points = trees.map((t) => ({
      lat: t.latitude,
      lng: t.longitude,
      dbhCm: t.dbhCm,
    }));
  } catch (err) {
    console.warn("[gi tile] DB unavailable, using spectral fallback:", err);
  }
  return getGiTileUrl(points);
}

export const getCachedGiTileUrl = unstable_cache(
  loadGiTileUrl,
  ["data-pipeline", "gee-tile", "gi-v4"],
  { revalidate: REVALIDATE_GEE_TILE_URLS, tags: [CACHE_TAG_GEE_TILES] },
);
