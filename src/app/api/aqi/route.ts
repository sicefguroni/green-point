import { NextResponse } from "next/server";
import { getCachedAqiFeatureCollection } from "@/lib/data-pipeline/aqi-layer-builder";
import { jsonWithSMaxAge } from "@/lib/data-pipeline/http-cache";
import { S_MAXAGE_BARANGAY_GEOJSON } from "@/lib/data-pipeline/constants";

export async function GET() {
  try {
    const fc = await getCachedAqiFeatureCollection();
    return jsonWithSMaxAge(fc, S_MAXAGE_BARANGAY_GEOJSON);
  } catch (error) {
    console.error("Error building AQI layer:", error);
    return NextResponse.json(
      { type: "FeatureCollection", features: [] },
      { status: 500 },
    );
  }
}
