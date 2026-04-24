import { unstable_cache } from "next/cache";
import { mergeGI } from "@/lib/MergeGI";
import {
  CACHE_TAG_AQI_LAYER,
  REVALIDATE_AQI_LAYER,
} from "@/lib/data-pipeline/constants";
import {
  getCachedMandaueBarangayBoundaries,
  getCachedMandaueBarangaysGi,
} from "@/lib/data-pipeline/static-geo-source";

async function buildAqiFeatureCollectionUncached(): Promise<GeoJSON.FeatureCollection> {
  const [bounds, gi] = await Promise.all([
    getCachedMandaueBarangayBoundaries(),
    getCachedMandaueBarangaysGi(),
  ]);

  const merged = mergeGI(bounds, gi);

  const features: GeoJSON.Feature[] = merged.features.map((f) => {
    const lst = (f.properties?.lst as number | null) ?? 30;
    const aqi = Math.max(0, Math.min(200, 20 + (lst - 25) * 5));
    const pm25 = Math.round(aqi * 0.4);
    const pm10 = Math.round(aqi * 0.6);
    const no2 = Math.round(aqi * 0.2);
    const o3 = Math.round(aqi * 0.3);
    const so2 = Math.round(aqi * 0.1);

    return {
      type: "Feature",
      geometry: f.geometry,
      properties: {
        type: "surface",
        aqi,
        pm25,
        pm10,
        no2,
        o3,
        so2,
      },
    };
  });

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
