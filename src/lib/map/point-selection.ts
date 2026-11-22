import * as turf from "@turf/turf";
import { fetchMapEnvBundle } from "@/lib/data-api/client";

/** Fallback name for a pin dropped where there is no POI and no address yet. */
export const DEFAULT_PIN_NAME = "Selected point";

type BarangayFeature = GeoJSON.Feature<GeoJSON.Geometry | null, Record<string, unknown> | null>;

/**
 * Name of the barangay polygon that contains the point, or null when the point
 * is outside every polygon (i.e. outside Mandaue City).
 */
export function findBarangayNameAt(
  features: readonly BarangayFeature[],
  lng: number,
  lat: number,
): string | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const pt = turf.point([lng, lat]);
  for (const f of features) {
    const type = f.geometry?.type;
    if (type !== "Polygon" && type !== "MultiPolygon") continue;
    try {
      if (
        turf.booleanPointInPolygon(
          pt,
          f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
        )
      ) {
        const name = f.properties?.name;
        if (typeof name === "string" && name.trim()) return name;
      }
    } catch {
      // Malformed polygon: skip it.
    }
  }
  return null;
}

export type BarangayLookup =
  | { status: "inside"; name: string }
  | { status: "outside" }
  /** The boundary data couldn't be loaded, so we can't tell. */
  | { status: "unknown" };

/**
 * Resolves the barangay for a point from the map-env bundle's boundary
 * polygons. Works whether or not the barangay layer is visible on the map.
 */
export async function resolveBarangayAt(
  lng: number,
  lat: number,
): Promise<BarangayLookup> {
  try {
    const bundle = await fetchMapEnvBundle();
    const features = (bundle.barangayGeoJson.greeneryIndex.features ??
      []) as BarangayFeature[];
    if (features.length === 0) return { status: "unknown" };
    const name = findBarangayNameAt(features, lng, lat);
    return name ? { status: "inside", name } : { status: "outside" };
  } catch (err) {
    console.error("Error resolving barangay from geometry bundle:", err);
    return { status: "unknown" };
  }
}

/**
 * A short name for a dropped pin from a reverse-geocoded place name:
 * "12 A. Cortes Ave, Mandaue City, Cebu, Philippines" → "12 A. Cortes Ave".
 */
export function pinNameFromAddress(placeName: string | null | undefined): string {
  return placeName?.split(",")[0]?.trim() || DEFAULT_PIN_NAME;
}

/** Squared distance in screen pixels; used to pick the POI nearest a click. */
export function screenDistanceSq(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
