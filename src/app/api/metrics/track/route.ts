import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/metrics/track
 * Tracks that a user has viewed/generated metrics for a location (Barangay, Point, or Custom).
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

  try {
    const body = await request.json();
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
    } = body;

    if (!locationType) {
      return NextResponse.json(
        { success: false, error: "Location type is required" },
        { status: 400 },
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Format coordinates consistently (lat/lng) and round to match cache key
    let dbCoords: Prisma.InputJsonValue | undefined;
    if (coordinates?.lat != null && coordinates?.lng != null) {
      dbCoords = {
        lat: Math.round(coordinates.lat * 10000) / 10000,
        lng: Math.round(coordinates.lng * 10000) / 10000,
      } as Prisma.InputJsonValue;
    }

    // 2. Check for existing record
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

    if (existing && locationType !== "CUSTOM") {
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

    // 3. Create history record
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

    // 4. Update global cache
    if (locationType === "BARANGAY" && locationName) {
      const barangay = await prisma.barangay.findFirst({
        where: {
          barangayName: { contains: locationName, mode: "insensitive" },
        },
      });
      if (barangay) {
        await prisma.barangayMetrics.upsert({
          where: { barangayID: barangay.id },
          update: {
            NDVI: ndvi,
            LST: lst,
            treeCanopy,
            airQuality: aqi,
            lastUpdated: new Date(),
          },
          create: {
            barangayID: barangay.id,
            NDVI: ndvi,
            LST: lst,
            treeCanopy,
            airQuality: aqi,
          },
        });
      }
    } else if (locationType === "POINT" && locationId) {
      await prisma.pointMetrics.upsert({
        where: { pointID: locationId },
        update: {
          NDVI: ndvi,
          LST: lst,
          GI: greeneryIndex,
          lastUpdated: new Date(),
        },
        create: {
          pointID: locationId,
          NDVI: ndvi,
          LST: lst,
          GI: greeneryIndex,
        },
      });
    }

    return NextResponse.json({ success: true, data: history });
  } catch (err) {
    console.error("[api/metrics/track] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to track metrics" },
      { status: 500 },
    );
  }
}
