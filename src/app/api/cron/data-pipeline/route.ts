import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import {
  CACHE_TAG_AQI_LAYER,
  CACHE_TAG_BARANGAY_GEE,
  CACHE_TAG_BARANGAYS,
  CACHE_TAG_GEE_TILES,
  CACHE_TAG_STATIC_GEO,
  CACHE_TAG_WAQI_POINT,
} from "@/lib/data-pipeline/constants";
import { prisma } from "@/lib/prisma";
import { getCachedMandaueBarangayBoundaries } from "@/lib/data-pipeline/static-geo-source";
import { getCachedTaggedTrees } from "@/lib/data-pipeline/tree-canopy";
import {
  barangayPolygons,
  lastFullMonths,
  refreshCurrentBarangayMetrics,
  upsertBarangayHistoryMonth,
} from "@/lib/data-pipeline/barangay-metrics-refresh";

/** Two Earth Engine reductions (~10-20 s each) fit within 60 s on every Vercel plan. */
export const maxDuration = 60;

/**
 * Daily environmental data pipeline and cache invalidation. Scheduled in
 * vercel.json; Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the
 * CRON_SECRET env var is set. Can also be called manually with that header.
 *
 * 1. Current NDVI/LST per barangay: 12-month mean over each barangay polygon.
 * 2. History: the previous calendar month's polygon means (idempotent upsert).
 * 3. Clean up temporary rows, then revalidate cache tags.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs: string[] = [];

  try {
    // 1. Current metrics: 12-month means over each barangay polygon
    const polygons = barangayPolygons(await getCachedMandaueBarangayBoundaries());
    logs.push(`Earth Engine: 12-month means for ${polygons.length} barangay polygons...`);
    const current = await refreshCurrentBarangayMetrics(prisma, polygons);
    logs.push(
      `Updated current metrics for ${current.updated} barangays` +
        (current.unmatched.length ? ` (no DB row: ${current.unmatched.join(", ")})` : "") +
        ".",
    );

    // 2. History: previous calendar month
    const [month] = lastFullMonths(new Date(), 1);
    const annualLst = new Map(
      [...current.metrics].map(([name, v]) => [name, v.lst] as const),
    );
    const history = await upsertBarangayHistoryMonth(
      prisma,
      polygons,
      await getCachedTaggedTrees(),
      month,
      annualLst,
    );
    logs.push(
      `History ${month}: ${history.written} rows (no clean NDVI: ${history.missingNdvi.length}, no clean LST: ${history.missingLst.length}).`,
    );
  } catch (err: unknown) {
    const errMsg = `Failed to update GEE metrics in cron: ${err instanceof Error ? err.message : String(err)}`;
    console.error(errMsg, err);
    logs.push(errMsg);
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 2. Clean up temporary cache tables
    logs.push("Cleaning up expired cache data...");
    
    const deletedPoints = await prisma.point.deleteMany({
      where: {
        isTemporary: true,
        createdAt: { lt: today },
      },
    });
    logs.push(`Cleaned up ${deletedPoints.count} temporary points.`);

    // Deleting a CustomArea cascades to its GreeningRecommendations, and from
    // there to any ProjectTimeline (and its versions) a user built on one. So
    // only remove areas with no timeline on any of their recommendations.
    const deletedCustomAreas = await prisma.customArea.deleteMany({
      where: {
        createdAt: { lt: today },
        recommendations: { none: { projectTimeline: { isNot: null } } },
      },
    });
    logs.push(`Cleaned up ${deletedCustomAreas.count} temporary custom areas (areas with a timeline are kept).`);

    const deletedHistory = await prisma.userLocationMetricHistory.deleteMany({
      where: {
        createdAt: { lt: today },
      },
    });
    logs.push(`Cleaned up ${deletedHistory.count} expired user location metric history records.`);
  } catch (err: unknown) {
    const errMsg = `Failed to clean up cache tables: ${err instanceof Error ? err.message : String(err)}`;
    console.error(errMsg, err);
    logs.push(errMsg);
  }

  // 3. Revalidate Next.js server-side tags
  revalidateTag(CACHE_TAG_BARANGAY_GEE);
  revalidateTag(CACHE_TAG_STATIC_GEO);
  revalidateTag(CACHE_TAG_GEE_TILES);
  revalidateTag(CACHE_TAG_AQI_LAYER);
  revalidateTag(CACHE_TAG_WAQI_POINT);
  revalidateTag(CACHE_TAG_BARANGAYS);
  logs.push("Next.js cache tags invalidated.");

  return NextResponse.json({
    ok: true,
    logs,
    revalidated: [
      CACHE_TAG_BARANGAY_GEE,
      CACHE_TAG_STATIC_GEO,
      CACHE_TAG_GEE_TILES,
      CACHE_TAG_AQI_LAYER,
      CACHE_TAG_WAQI_POINT,
      CACHE_TAG_BARANGAYS,
    ],
  });
}
