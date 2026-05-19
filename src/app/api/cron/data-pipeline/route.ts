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
import { computeBarangayCentroids } from "@/lib/geo/centroids";
import { fetchGeeMetricsBulk } from "@/lib/api/gee_service";

/**
 * On-demand cache invalidation and daily environmental data pipeline update.
 * Schedule via cron (e.g. Vercel Cron, GitHub Actions) with header:
 *   Authorization: Bearer <CRON_SECRET>
 */
// Cache-refresh trigger comment to force IDE types reload
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs: string[] = [];

  try {
    // 1. Fetch all barangay metrics from GEE and store them in the DB
    logs.push("Fetching Mandaue barangay boundaries and centroids...");
    const bounds = await getCachedMandaueBarangayBoundaries();
    const centroids = computeBarangayCentroids(bounds);
    
    logs.push(`Calling Google Earth Engine bulk fetch for ${centroids.length} centroids...`);
    const geeMap = await fetchGeeMetricsBulk(centroids);
    logs.push(`Successfully retrieved ${geeMap.size} barangay metrics from GEE.`);

    const refreshedAt = new Date();
    const dbBarangays = await prisma.barangay.findMany();

    let updatedCount = 0;
    for (const [name, v] of geeMap.entries()) {
      const b = dbBarangays.find(
        (bm) => bm.barangayName.toLowerCase() === name.toLowerCase()
      );
      if (b) {
        await prisma.barangayMetrics.upsert({
          where: { barangayID: b.id },
          update: {
            NDVI: v.ndvi,
            LST: v.lst,
            lastUpdated: refreshedAt,
          },
          create: {
            barangayID: b.id,
            NDVI: v.ndvi,
            LST: v.lst,
            lastUpdated: refreshedAt,
          },
        });
        updatedCount++;
      }
    }
    logs.push(`Updated/upserted database metrics for ${updatedCount} barangays.`);
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

    const deletedCustomAreas = await prisma.customArea.deleteMany({
      where: {
        createdAt: { lt: today },
      },
    });
    logs.push(`Cleaned up ${deletedCustomAreas.count} temporary custom areas.`);

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
