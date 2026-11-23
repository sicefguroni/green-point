import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A metric the browser reports, or null/absent. Out-of-range values are
 * rejected; zod 4's z.number() already rejects Infinity and NaN.
 */
const metric = (min: number, max: number) =>
  z.number().min(min).max(max).nullish();

/**
 * Per-user cap on new history rows per day. The client fires a track call per
 * selection and ignores the response, so this never affects normal use; it
 * stops a script from filling the table (the nightly cleanup may not run).
 */
const MAX_TRACKED_LOCATIONS_PER_DAY = 300;

const trackSchema = z.object({
  locationType: z.enum(["BARANGAY", "POINT", "CUSTOM"]),
  locationId: z.string().trim().max(128).nullish(),
  locationName: z.string().trim().max(120).nullish(),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullish(),
  ndvi: metric(-1, 1),
  lst: metric(-30, 70),
  treeCanopy: metric(0, 1),
  greeneryIndex: metric(0, 1),
  greeneryLevel: z.string().trim().max(40).nullish(),
  // The hazard layer uses AQI -1 for "no reading" (get_hazard_data.ts), so a
  // negative AQI means unknown rather than an invalid request.
  aqi: z.preprocess(
    (v) => (typeof v === "number" && v < 0 ? null : v),
    metric(0, 1000),
  ),
});

/**
 * POST /api/metrics/track
 * Records, in the signed-in user's own history, that they viewed metrics for a
 * location (Barangay, Point, or Custom).
 *
 * The metric values come from the browser, so they are only ever stored in the
 * user's own `UserLocationMetricHistory` rows. This route never writes the
 * shared `BarangayMetrics` or `PointMetrics` tables: those feed the dashboard
 * and map for everyone and are written only by the server-side data pipeline
 * (`/api/cron/data-pipeline`). Before, any signed-in user could overwrite a
 * barangay's city-wide NDVI/LST, and a pin dropped in a barangay replaced the
 * whole barangay's values with that one point's reading.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = trackSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid tracking payload",
        fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".")))],
      },
      { status: 400 },
    );
  }

  const {
    locationType,
    locationId,
    locationName,
    coordinates,
    ndvi,
    lst,
    treeCanopy,
    greeneryIndex,
    greeneryLevel,
    aqi,
  } = parsed.data;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Format coordinates consistently (lat/lng) and round to match cache key
    let dbCoords: Prisma.InputJsonValue | undefined;
    if (coordinates) {
      dbCoords = {
        lat: Math.round(coordinates.lat * 10000) / 10000,
        lng: Math.round(coordinates.lng * 10000) / 10000,
      } as Prisma.InputJsonValue;
    }

    // 2. Check for an existing record today (this user's only)
    const existing = await prisma.userLocationMetricHistory.findFirst({
      where: {
        supabaseUserId: user.id,
        locationType,
        locationId: locationId || undefined,
        locationName: locationName || undefined,
        createdAt: { gte: today },
        // For custom points without IDs, we match by rounded coordinates
        ...(dbCoords && !locationId
          ? { coordinates: { equals: dbCoords } }
          : {}),
      },
    });

    // Applies to every type, CUSTOM included (matched by its rounded
    // coordinates above): one row per location per user per day.
    if (existing) {
      const hasNullMetrics =
        existing.ndvi == null &&
        existing.lst == null &&
        existing.treeCanopy == null &&
        existing.greeneryIndex == null;
      const hasRealValues =
        ndvi != null ||
        lst != null ||
        treeCanopy != null ||
        greeneryIndex != null;

      if (hasNullMetrics && hasRealValues) {
        const updated = await prisma.userLocationMetricHistory.update({
          where: { id: existing.id },
          data: {
            ndvi: ndvi ?? null,
            lst: lst ?? null,
            treeCanopy: treeCanopy ?? null,
            greeneryIndex: greeneryIndex ?? null,
            greeneryLevel: greeneryLevel || null,
            aqi: aqi ?? null,
          },
        });
        return NextResponse.json({
          success: true,
          message: "Updated existing record with metrics",
          data: updated,
        });
      }

      return NextResponse.json({
        success: true,
        message: "Already tracked today",
        data: existing,
      });
    }

    // 3. Create this user's history record, within the daily cap
    const trackedToday = await prisma.userLocationMetricHistory.count({
      where: { supabaseUserId: user.id, createdAt: { gte: today } },
    });
    if (trackedToday >= MAX_TRACKED_LOCATIONS_PER_DAY) {
      return NextResponse.json(
        { success: false, error: "Too many tracked locations today" },
        { status: 429 },
      );
    }

    const history = await prisma.userLocationMetricHistory.create({
      data: {
        supabaseUserId: user.id,
        locationType,
        locationId: locationId || null,
        locationName: locationName || null,
        coordinates: dbCoords ?? Prisma.JsonNull,
        ndvi: ndvi ?? null,
        lst: lst ?? null,
        treeCanopy: treeCanopy ?? null,
        greeneryIndex: greeneryIndex ?? null,
        greeneryLevel: greeneryLevel || null,
        aqi: aqi ?? null,
      },
    });

    return NextResponse.json({ success: true, data: history });
  } catch (err) {
    console.error("[api/metrics/track] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to track metrics" },
      { status: 500 },
    );
  }
}
