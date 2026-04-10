import {
  buildGreeneryIndexFeatureCollection,
  buildLstFeatureCollection,
  buildNdviFeatureCollection,
  getCachedBarangayGeeBundle,
} from "@/lib/data-pipeline/barangay-gee-bundle";
import { getCachedAqiFeatureCollection } from "@/lib/data-pipeline/aqi-layer-builder";
import {
  getCachedCanopyTileUrl,
  getCachedGiTileUrl,
  getCachedLstTileUrl,
  getCachedNdviTileUrl,
} from "@/lib/data-pipeline/gee-tile-urls";
import { getCachedPointEnvironmentalMetrics } from "@/lib/data-pipeline/point-environmental-metrics";
import { getCachedWaqiAtPoint } from "@/lib/data-pipeline/waqi-cached";
import {
  getCachedBarangayDetailById,
  getCachedBarangaysWithMetrics,
} from "@/lib/data-pipeline/barangays-queries";
import {
  S_MAXAGE_BARANGAY_GEOJSON,
  S_MAXAGE_POINT,
  S_MAXAGE_TILE_JSON,
  S_MAXAGE_WAQI,
} from "@/lib/data-pipeline/constants";
import type { DataResourceName, MapEnvBundle } from "./types";
import { assertValidMapEnvInclude } from "./validation";

export class DataApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DataApiError";
  }
}

async function timed<T>(
  label: string,
  promise: Promise<T>,
  timings: Record<string, number>,
): Promise<T> {
  const t0 = performance.now();
  try {
    return await promise;
  } finally {
    timings[label] = Math.round(performance.now() - t0);
  }
}

const emptyFc: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function normalizeIncludeToken(s: string): string {
  return s.trim().toLowerCase();
}

/** True if key is included in the bundle response (default: all map layers). */
function want(
  includeSet: Set<string> | null,
  ...aliases: string[]
): boolean {
  if (!includeSet) return true;
  return aliases.some((a) => includeSet.has(normalizeIncludeToken(a)));
}

export type MapEnvBundleResult = {
  bundle: MapEnvBundle;
  /** Per-upstream durations (ms); parallel fetches overlap wall-clock. */
  subTimings: Record<string, number>;
};

/**
 * Map environment bootstrap: one logical fetch; upstream caches dedupe GEE work.
 * `include` comma-list (optional) omits parts from the JSON body to save bandwidth.
 * Unknown `include` tokens throw before fetching (see assertValidMapEnvInclude).
 */
export async function getMapEnvBundle(
  includeCsv?: string | null,
): Promise<MapEnvBundleResult> {
  assertValidMapEnvInclude(includeCsv ?? null);

  const includeSet = includeCsv?.length
    ? new Set(
        includeCsv
          .split(",")
          .map(normalizeIncludeToken)
          .filter(Boolean),
      )
    : null;

  const subTimings: Record<string, number> = {};

  const [
    geeBundle,
    aqiFc,
    lstTile,
    ndviTile,
    canopyTile,
    giTile,
  ] = await Promise.all([
    timed("geeBundle", getCachedBarangayGeeBundle(), subTimings),
    timed("aqiLayer", getCachedAqiFeatureCollection(), subTimings),
    timed("tileLst", getCachedLstTileUrl(), subTimings),
    timed("tileNdvi", getCachedNdviTileUrl(), subTimings),
    timed("tileCanopy", getCachedCanopyTileUrl(), subTimings),
    timed("tileGi", getCachedGiTileUrl(), subTimings),
  ]);

  const bundle: MapEnvBundle = {
    barangayGeoJson: {
      lst: want(includeSet, "lst")
        ? buildLstFeatureCollection(geeBundle)
        : emptyFc,
      ndvi: want(includeSet, "ndvi")
        ? buildNdviFeatureCollection(geeBundle)
        : emptyFc,
      greeneryIndex: want(includeSet, "greeneryindex", "gi", "greenery")
        ? buildGreeneryIndexFeatureCollection(geeBundle)
        : emptyFc,
      aqi: want(includeSet, "aqi") ? aqiFc : emptyFc,
    },
    rasterTileUrls: {
      lst: want(includeSet, "lsttile", "lst_tile") ? lstTile : "",
      ndvi: want(includeSet, "ndvitile", "ndvi_tile") ? ndviTile : "",
      canopy: want(includeSet, "canopytile", "canopy_tile") ? canopyTile : "",
      gi: want(includeSet, "gitile", "gi_tile") ? giTile : "",
    },
    meta: { dateKey: geeBundle.dateKey },
  };

  return { bundle, subTimings };
}

export type GetResourceParams = {
  lat?: string | null;
  lng?: string | null;
  cityId?: string | null;
  id?: string | null;
};

export async function getResourcePayload(
  resource: DataResourceName,
  params: GetResourceParams,
): Promise<unknown> {
  switch (resource) {
    case "lst": {
      const b = await getCachedBarangayGeeBundle();
      return buildLstFeatureCollection(b);
    }
    case "ndvi": {
      const b = await getCachedBarangayGeeBundle();
      return buildNdviFeatureCollection(b);
    }
    case "greeneryIndex": {
      const b = await getCachedBarangayGeeBundle();
      return buildGreeneryIndexFeatureCollection(b);
    }
    case "aqi":
      return getCachedAqiFeatureCollection();
    case "lstTile":
      return { url: await getCachedLstTileUrl() };
    case "ndviTile":
      return { url: await getCachedNdviTileUrl() };
    case "canopyTile":
      return { url: await getCachedCanopyTileUrl() };
    case "giTile":
      return { url: await getCachedGiTileUrl() };
    case "point": {
      const lat = parseFloat(params.lat ?? "");
      const lng = parseFloat(params.lng ?? "");
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new DataApiError(
          "Valid lat and lng are required for resource=point",
          "BAD_PARAMS",
          400,
        );
      }
      return getCachedPointEnvironmentalMetrics(lat, lng);
    }
    case "waqi": {
      const lat = parseFloat(params.lat ?? "");
      const lng = parseFloat(params.lng ?? "");
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new DataApiError(
          "Valid lat and lng are required for resource=waqi",
          "BAD_PARAMS",
          400,
        );
      }
      return getCachedWaqiAtPoint(lat, lng);
    }
    case "barangays": {
      if (params.id) {
        const item = await getCachedBarangayDetailById(params.id);
        if (!item) {
          throw new DataApiError("Barangay not found", "NOT_FOUND", 404);
        }
        return item;
      }
      return getCachedBarangaysWithMetrics(params.cityId ?? null);
    }
    default: {
      const _exhaustive: never = resource;
      throw new DataApiError(`Unknown resource: ${_exhaustive}`, "UNKNOWN", 400);
    }
  }
}

export function getSMaxAgeForResource(resource: DataResourceName): number {
  switch (resource) {
    case "lst":
    case "ndvi":
    case "greeneryIndex":
    case "aqi":
      return S_MAXAGE_BARANGAY_GEOJSON;
    case "lstTile":
    case "ndviTile":
    case "canopyTile":
    case "giTile":
      return S_MAXAGE_TILE_JSON;
    case "point":
      return S_MAXAGE_POINT;
    case "waqi":
      return S_MAXAGE_WAQI;
    case "barangays":
      return 120;
    default:
      return 300;
  }
}
