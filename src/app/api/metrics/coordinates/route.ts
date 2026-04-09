import { NextResponse } from "next/server";
import { getCachedPointEnvironmentalMetrics } from "@/lib/data-pipeline/point-environmental-metrics";
import { jsonWithSMaxAge } from "@/lib/data-pipeline/http-cache";
import { S_MAXAGE_POINT } from "@/lib/data-pipeline/constants";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Latitude and Longitude are required." },
        { status: 400 },
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: "Invalid coordinate format." },
        { status: 400 },
      );
    }

    const payload = await getCachedPointEnvironmentalMetrics(
      latitude,
      longitude,
    );
    return jsonWithSMaxAge(payload, S_MAXAGE_POINT);
  } catch (error) {
    console.error("Error fetching environmental metrics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch metrics" },
      { status: 500 },
    );
  }
}
