import { NextResponse } from "next/server";
import { getCachedCanopyTileUrl } from "@/lib/data-pipeline/gee-tile-urls";
import { jsonWithSMaxAge } from "@/lib/data-pipeline/http-cache";
import { S_MAXAGE_TILE_JSON } from "@/lib/data-pipeline/constants";

export async function GET() {
  try {
    const url = await getCachedCanopyTileUrl();
    return jsonWithSMaxAge({ url }, S_MAXAGE_TILE_JSON);
  } catch (error) {
    console.error("Error creating Canopy raster tile URL:", error);
    return NextResponse.json(
      { error: "Failed fetching tiles" },
      { status: 500 },
    );
  }
}
