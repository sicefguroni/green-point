import { NextResponse } from "next/server";
import {
  DataApiError,
  getMapEnvBundle,
  getMapEnvEtagDateKey,
  getResourcePayload,
  getSMaxAgeForResource,
} from "@/lib/data-api/service";
import {
  buildSMaxAgeCacheControl,
  jsonWithSMaxAge,
} from "@/lib/data-pipeline/http-cache";
import { S_MAXAGE_MAP_BUNDLE } from "@/lib/data-pipeline/constants";
import type { DataApiSuccess, DataBundleName, DataResourceName } from "@/lib/data-api/types";
import { ifNoneMatchMatches } from "@/lib/data-api/etag-match";
import {
  InvalidIncludeError,
  parseDataApiQuery,
} from "@/lib/data-api/validation";

function serverTimingParts(
  primary: string,
  primaryDur: number,
  sub?: Record<string, number>,
): string {
  const parts = [`${primary};dur=${primaryDur}`];
  if (sub) {
    for (const [k, v] of Object.entries(sub)) {
      const safe = k.replace(/[^a-zA-Z0-9_-]/g, "_");
      parts.push(`${safe};dur=${v}`);
    }
  }
  return parts.join(", ");
}

/**
 * Unified data API — environmental + map layers + point metrics + barangay reads.
 *
 * **Caching / ETag (`bundle=map-env`):** Weak ETag is `W/"map-env-${dateKey}"`. `dateKey` comes from
 * the GEE barangay bundle when any LST/NDVI/greenery layer is included (or when `include` is
 * omitted); otherwise it is the current UTC calendar day (`YYYYMMDD`). A matching `If-None-Match`
 * returns **304** after only resolving that date key — **not** after building the full JSON body.
 * Note: AQI and raster tile URL changes within the same `dateKey` do not invalidate this ETag; use
 * shorter `s-maxage` or a composite ETag if that staleness is unacceptable.
 *
 * @example Bundle (one round-trip for map): GET /api/data?bundle=map-env
 * @example Bundle subset: GET /api/data?bundle=map-env&include=lst,ndvi,aqi
 * @example Single resource: GET /api/data?resource=greeneryIndex
 * @example Point: GET /api/data?resource=point&lat=10.3&lng=123.95
 * @example WAQI (flat `data`): GET /api/data?resource=waqi&lat=…&lng=… — `data` is WaqiResult or null
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseDataApiQuery(searchParams);

  if (!parsed.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error,
        code: parsed.code,
      } satisfies { ok: false; error: string; code: string },
      { status: 400 },
    );
  }

  try {
    if (parsed.query.mode === "bundle") {
      const inm = request.headers.get("if-none-match");
      if (inm?.trim()) {
        const tEtag = performance.now();
        const dateKey = await getMapEnvEtagDateKey(parsed.query.include);
        const etagMs = Math.round(performance.now() - tEtag);
        const etag = `W/"map-env-${dateKey}"`;
        if (ifNoneMatchMatches(inm, etag)) {
          return new NextResponse(null, {
            status: 304,
            headers: {
              "Cache-Control": buildSMaxAgeCacheControl(S_MAXAGE_MAP_BUNDLE),
              ETag: etag,
              "Server-Timing": serverTimingParts("bundle", etagMs),
            },
          });
        }
      }

      const t0 = performance.now();
      const { bundle: data, subTimings } = await getMapEnvBundle(
        parsed.query.include,
      );
      const durMs = Math.round(performance.now() - t0);
      const etag = `W/"map-env-${data.meta.dateKey}"`;
      const body: DataApiSuccess<typeof data> = {
        ok: true,
        bundle: "map-env" as DataBundleName,
        data,
        meta: {
          include: parsed.query.include ?? "all",
        },
      };
      return jsonWithSMaxAge(body, S_MAXAGE_MAP_BUNDLE, {
        ETag: etag,
        "Server-Timing": serverTimingParts("bundle", durMs, subTimings),
      });
    }

    const q = parsed.query;
    const t0 = performance.now();
    const data = await getResourcePayload(q.resource, {
      lat: q.lat,
      lng: q.lng,
      cityId: q.cityId,
      id: q.id,
    });
    const durMs = Math.round(performance.now() - t0);

    const body: DataApiSuccess<unknown> = {
      ok: true,
      resource: q.resource as DataResourceName,
      data,
    };

    const maxAge = getSMaxAgeForResource(q.resource);
    return jsonWithSMaxAge(body, maxAge, {
      "Server-Timing": serverTimingParts("resource", durMs),
    });
  } catch (e) {
    if (e instanceof InvalidIncludeError) {
      return NextResponse.json(
        { ok: false, error: e.message, code: e.apiCode },
        { status: 400 },
      );
    }
    if (e instanceof DataApiError) {
      return NextResponse.json(
        { ok: false, error: e.message, code: e.code },
        { status: e.status },
      );
    }
    console.error("[api/data]", e);
    return NextResponse.json(
      { ok: false, error: "Internal data error", code: "INTERNAL" },
      { status: 500 },
    );
  }
}
