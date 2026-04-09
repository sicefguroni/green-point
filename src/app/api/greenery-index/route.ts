import { NextResponse } from "next/server";
import {
  buildGreeneryIndexFeatureCollection,
  getCachedBarangayGeeBundle,
} from "@/lib/data-pipeline/barangay-gee-bundle";
import { jsonWithSMaxAge } from "@/lib/data-pipeline/http-cache";
import { S_MAXAGE_BARANGAY_GEOJSON } from "@/lib/data-pipeline/constants";

export async function GET() {
  try {
    const bundle = await getCachedBarangayGeeBundle();
    const fc = buildGreeneryIndexFeatureCollection(bundle);
    return jsonWithSMaxAge(fc, S_MAXAGE_BARANGAY_GEOJSON);
  } catch (error) {
    console.error("Error building Greenery Index layer:", error);
    return NextResponse.json(
      { type: "FeatureCollection", features: [] },
      { status: 500 },
    );
  }
}
