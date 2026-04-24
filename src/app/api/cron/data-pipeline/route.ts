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

/**
 * On-demand cache invalidation for the environmental data pipeline.
 * Schedule via cron (e.g. Vercel Cron, GitHub Actions) with header:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag(CACHE_TAG_BARANGAY_GEE);
  revalidateTag(CACHE_TAG_STATIC_GEO);
  revalidateTag(CACHE_TAG_GEE_TILES);
  revalidateTag(CACHE_TAG_AQI_LAYER);
  revalidateTag(CACHE_TAG_WAQI_POINT);
  revalidateTag(CACHE_TAG_BARANGAYS);

  return NextResponse.json({
    ok: true,
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
