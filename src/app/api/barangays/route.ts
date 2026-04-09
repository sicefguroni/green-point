import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCachedBarangayDetailById,
  getCachedBarangaysWithMetrics,
} from "@/lib/data-pipeline/barangays-queries";
import { CACHE_TAG_BARANGAYS } from "@/lib/data-pipeline/constants";

/**
 * GET /api/barangays - Fetch all barangays
 * GET /api/barangays?cityId=xxx - Fetch barangays by city
 * GET /api/barangays?id=xxx - Fetch barangay details with metrics
 */
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    const cityId = request.nextUrl.searchParams.get("cityId");

    if (id) {
      const barangay = await getCachedBarangayDetailById(id);

      if (!barangay) {
        return NextResponse.json(
          { success: false, error: "Barangay not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({ success: true, data: barangay });
    }

    const barangays = await getCachedBarangaysWithMetrics(cityId);

    return NextResponse.json({ success: true, data: barangays });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch barangays" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/barangays - Create a new barangay
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      barangayID,
      cityID,
      barangayName,
      population,
      area,
      boundary,
      coordinates,
    } = body;

    if (!barangayID || !cityID || !barangayName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const barangay = await prisma.barangay.create({
      data: {
        barangayID,
        cityID,
        barangayName,
        population,
        area,
        boundary,
        coordinates,
      },
    });

    revalidateTag(CACHE_TAG_BARANGAYS);

    return NextResponse.json(
      { success: true, data: barangay },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Barangay already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to create barangay" },
      { status: 500 },
    );
  }
}
