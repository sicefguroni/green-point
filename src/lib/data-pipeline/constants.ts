/** next/cache tags — use with revalidateTag from cron or admin actions */
export const CACHE_TAG_BARANGAY_GEE = "dp-barangay-gee";
export const CACHE_TAG_STATIC_GEO = "dp-static-geo";
export const CACHE_TAG_GEE_TILES = "dp-gee-tiles";
export const CACHE_TAG_AQI_LAYER = "dp-aqi-layer";
export const CACHE_TAG_WAQI_POINT = "dp-waqi-point";
export const CACHE_TAG_BARANGAYS = "dp-barangays";

/** Server revalidate windows (seconds) */
export const REVALIDATE_STATIC_GEO = 86_400; // 24h — local JSON
export const REVALIDATE_BARANGAY_GEE_BUNDLE = 6 * 3600; // 6h — Sentinel/MODIS stack
export const REVALIDATE_GEE_TILE_URLS = 4 * 3600; // 4h — map tile templates
export const REVALIDATE_AQI_LAYER = 3600; // 1h — derived from static merge
export const REVALIDATE_POINT_METRICS = 3600; // 1h — NASA + GEE point
export const REVALIDATE_WAQI_POINT = 1200; // 20m — station AQI
export const REVALIDATE_BARANGAYS_LIST = 300; // 5m — Prisma list
export const REVALIDATE_BARANGAY_BY_ID = 120; // 2m — single record

/** CDN / browser hints (seconds) for Route Handler responses */
export const S_MAXAGE_BARANGAY_GEOJSON = 3600;
export const S_MAXAGE_TILE_JSON = 1800;
export const S_MAXAGE_POINT = 600;
export const S_MAXAGE_WAQI = 600;
