import type { MapEnvBundle } from "./types";
import { fetchGreeneryIndexResourceDeduped } from "./greenery-index-resource-client";
import type { PointEnvironmentalPayload } from "@/lib/data-pipeline/point-environmental-metrics";
import type { WaqiResult } from "@/lib/api/environment";

type MapEnvApiResponse = {
  ok: true;
  bundle: "map-env";
  data: MapEnvBundle;
  meta?: { include?: string };
};

type PointApiResponse = {
  ok: true;
  resource: "point";
  data: PointEnvironmentalPayload;
};

export async function fetchMapEnvBundle(
  include?: string,
): Promise<MapEnvBundle> {
  const q = include
    ? `?bundle=map-env&include=${encodeURIComponent(include)}`
    : "?bundle=map-env";
  const res = await fetch(`/api/data${q}`);
  const json = (await res.json()) as MapEnvApiResponse | { ok: false };
  if (!res.ok || !("ok" in json) || !json.ok) {
    throw new Error("Failed to load map environment bundle");
  }
  return json.data;
}

export async function fetchPointEnvironmentalMetrics(
  lat: number,
  lng: number,
): Promise<PointApiResponse["data"]> {
  const res = await fetch(
    `/api/data?resource=point&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
  );
  const json = (await res.json()) as PointApiResponse | { ok: false };
  if (!res.ok || !json.ok) {
    throw new Error("Failed to load point metrics");
  }
  return json.data;
}

export async function fetchWaqiPoint(
  lat: number,
  lng: number,
): Promise<WaqiResult | null> {
  const res = await fetch(
    `/api/data?resource=waqi&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
  );
  const json = (await res.json()) as
    | { ok: true; resource: "waqi"; data: WaqiResult | null }
    | { ok: false };
  if (!res.ok || !json.ok) {
    throw new Error("Failed to load WAQI");
  }
  return json.data;
}

export async function fetchGreeneryIndexGeoJson(): Promise<GeoJSON.FeatureCollection> {
  const result = await fetchGreeneryIndexResourceDeduped();
  if (!result.ok) {
    throw new Error("Failed to load greenery index layer");
  }
  return result.data;
}
