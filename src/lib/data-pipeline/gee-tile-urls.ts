import { unstable_cache } from "next/cache";
import {
  getCanopyTileUrl,
  getGiTileUrl,
  getLstTileUrl,
  getNdviTileUrl,
} from "@/lib/api/gee_service";
import {
  CACHE_TAG_GEE_TILES,
  REVALIDATE_GEE_TILE_URLS,
} from "@/lib/data-pipeline/constants";

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

export const getCachedCanopyTileUrl = unstable_cache(
  async () => getCanopyTileUrl(),
  ["data-pipeline", "gee-tile", "canopy"],
  { revalidate: REVALIDATE_GEE_TILE_URLS, tags: [CACHE_TAG_GEE_TILES] },
);

export const getCachedGiTileUrl = unstable_cache(
  async () => getGiTileUrl(),
  ["data-pipeline", "gee-tile", "gi"],
  { revalidate: REVALIDATE_GEE_TILE_URLS, tags: [CACHE_TAG_GEE_TILES] },
);
