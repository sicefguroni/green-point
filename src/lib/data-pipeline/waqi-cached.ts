import { unstable_cache } from "next/cache";
import { fetchWaqiAtPoint } from "@/lib/api/environment";
import type { WaqiResult } from "@/lib/api/environment";
import {
  CACHE_TAG_WAQI_POINT,
  REVALIDATE_WAQI_POINT,
} from "@/lib/data-pipeline/constants";

function roundCoord(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export async function getCachedWaqiAtPoint(
  lat: number,
  lng: number,
): Promise<WaqiResult | null> {
  const rLat = roundCoord(lat, 3);
  const rLng = roundCoord(lng, 3);

  const cached = unstable_cache(
    async () => fetchWaqiAtPoint(rLat, rLng),
    ["data-pipeline", "waqi", String(rLat), String(rLng)],
    { revalidate: REVALIDATE_WAQI_POINT, tags: [CACHE_TAG_WAQI_POINT] },
  );

  return cached();
}
