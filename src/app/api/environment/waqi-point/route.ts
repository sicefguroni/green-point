import { NextResponse } from "next/server";
import { getCachedWaqiAtPoint } from "@/lib/data-pipeline/waqi-cached";
import { jsonWithSMaxAge } from "@/lib/data-pipeline/http-cache";
import { S_MAXAGE_WAQI } from "@/lib/data-pipeline/constants";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { success: false, error: "Valid lat and lng are required." },
      { status: 400 },
    );
  }

  const data = await getCachedWaqiAtPoint(lat, lng);
  return jsonWithSMaxAge({ success: true, data }, S_MAXAGE_WAQI);
}
