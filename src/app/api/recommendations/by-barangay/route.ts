import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { groupRecsByBarangay } from "@/lib/recommendations/barangay-backfill";

/**
 * GET /api/recommendations/by-barangay
 *
 * Returns every GreeningRecommendation (source = "AI Engine") that has a
 * barangayID, grouped by the barangay's name. Each record carries the
 * engine evaluation metrics (costPHP, impactGI, …) that were stored in
 * `implementationOptions` by the generate route, so the dashboard table
 * can derive its column values directly from the DB instead of running
 * `evaluateStrategies` a second time on the client.
 *
 * To trigger AI generation for all barangays, call POST /api/recommendations/backfill.
 */
export async function GET() {
  try {
    const recs = await prisma.greeningRecommendation.findMany({
      where: {
        source: "AI Engine",
        barangayID: { not: null },
      },
      include: {
        barangay: {
          select: { barangayName: true },
        },
      },
    });

    const grouped = groupRecsByBarangay(recs);

    return NextResponse.json({ success: true, data: grouped });
  } catch (error) {
    console.error("Error fetching recommendations by barangay:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch recommendations" },
      { status: 500 },
    );
  }
}
