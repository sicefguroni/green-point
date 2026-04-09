import { NextResponse } from "next/server";
import {
  buildLstFeatureCollection,
  getCachedBarangayGeeBundle,
} from "@/lib/data-pipeline/barangay-gee-bundle";
import { jsonWithSMaxAge } from "@/lib/data-pipeline/http-cache";
import { S_MAXAGE_BARANGAY_GEOJSON } from "@/lib/data-pipeline/constants";

export async function GET() {
  try {
    const bundle = await getCachedBarangayGeeBundle();
    const fc = buildLstFeatureCollection(bundle);
    return jsonWithSMaxAge(fc, S_MAXAGE_BARANGAY_GEOJSON);
  } catch (error) {
    console.error("Error building LST layer:", error);
    return NextResponse.json(
      { type: "FeatureCollection", features: [] },
      { status: 500 },
    );
  }
}
