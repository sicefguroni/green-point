import { unstable_cache } from "next/cache";
import {
  CACHE_TAG_AQI_LAYER,
  REVALIDATE_AQI_LAYER,
} from "@/lib/data-pipeline/constants";
import { getCachedMandaueBarangayBoundaries } from "@/lib/data-pipeline/static-geo-source";

/**
 * Per-barangay air-quality layer. There is no barangay-level AQI source yet,
 * so every value is null. It used to derive "AQI" and pollutant figures from
 * the placeholder LST in mandaue_barangays_gi.geojson (aqi = 20 + (lst - 25) * 5),
 * which looked like measurements but weren't. Point AQI comes from WAQI
 * (`resource=waqi`). No map layer draws this collection.
 */
async function buildAqiFeatureCollectionUncached(): Promise<GeoJSON.FeatureCollection> {
  const bounds = await getCachedMandaueBarangayBoundaries();
  const features: GeoJSON.Feature[] = bounds.features.map((f) => ({
    type: "Feature",
    geometry: f.geometry,
    properties: {
      type: "surface",
      name: f.properties?.name ?? null,
      aqi: null,
      pm25: null,
      pm10: null,
      no2: null,
      o3: null,
      so2: null,
    },
  }));
  return { type: "FeatureCollection", features };
}

export const getCachedAqiFeatureCollection = unstable_cache(
  buildAqiFeatureCollectionUncached,
  ["data-pipeline", "aqi-layer", "mandaue-v1"],
  {
    revalidate: REVALIDATE_AQI_LAYER,
    tags: [CACHE_TAG_AQI_LAYER],
  },
);
