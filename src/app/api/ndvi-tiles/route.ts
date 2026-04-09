import { NextResponse } from "next/server";
import { getNdviTileUrl } from "@/lib/api/gee_service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = await getNdviTileUrl();
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error creating NDVI raster tile URL:", error);
    return NextResponse.json({ error: "Failed fetching tiles" }, { status: 500 });
  }
}
