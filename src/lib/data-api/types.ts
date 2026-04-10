/** Query `resource` values for GET /api/data */
export const DATA_API_RESOURCE_NAMES = [
  "lst",
  "ndvi",
  "greeneryIndex",
  "aqi",
  "lstTile",
  "ndviTile",
  "canopyTile",
  "giTile",
  "point",
  "waqi",
  "barangays",
] as const;

export type DataResourceName = (typeof DATA_API_RESOURCE_NAMES)[number];

export function isValidResource(name: string): name is DataResourceName {
  return (DATA_API_RESOURCE_NAMES as readonly string[]).includes(name);
}

/** Query `bundle` values */
export type DataBundleName = "map-env";

export type MapEnvBarangayGeoJson = {
  lst: GeoJSON.FeatureCollection;
  ndvi: GeoJSON.FeatureCollection;
  greeneryIndex: GeoJSON.FeatureCollection;
  aqi: GeoJSON.FeatureCollection;
};

/** Tile template URLs; use empty string when omitted via `include=` or missing upstream URL. */
export type MapEnvRasterTileUrls = {
  lst: string;
  ndvi: string;
  canopy: string;
  gi: string;
};

export type MapEnvBundle = {
  barangayGeoJson: MapEnvBarangayGeoJson;
  rasterTileUrls: MapEnvRasterTileUrls;
  meta: {
    dateKey: string;
  };
};

export type DataApiSuccess<T> = {
  ok: true;
  resource?: DataResourceName;
  bundle?: DataBundleName;
  data: T;
  meta?: Record<string, unknown>;
};

export type DataApiFailure = {
  ok: false;
  error: string;
  code: string;
};
