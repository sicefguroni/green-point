import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const barangayID = decodeURIComponent(id)
      .toLowerCase()
      .replace(/\s+/g, "-");

    // Newest 60 months (5 years), returned oldest first. Taking the first 12
    // in ascending order would freeze the chart on the oldest year on record.
    const history = (
      await prisma.barangayHistoricalMetrics.findMany({
        where: { barangay: { barangayID } },
        orderBy: { month: "desc" },
        take: 60,
      })
    ).reverse();

    if (!history || history.length === 0) {
      return NextResponse.json(
        { success: false, error: "No historical data found" },
        { status: 404 },
      );
    }

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const monthlyData = history.map((record) => {
      const parts = record.month.split("-");
      const mIdx = parseInt(parts[1], 10) - 1;
      return {
        month: monthNames[mIdx],
        year: record.year,
        fullDate: record.month,
        NDVI: record.NDVI,
        LST: record.LST,
        canopy: record.treeCanopy,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        monthly: monthlyData,
      },
    });
  } catch (error) {
    console.error("Error fetching barangay history:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
