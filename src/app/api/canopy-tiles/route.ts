import { NextResponse } from "next/server";
import { getCanopyTileUrl } from "@/lib/api/gee_service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = await getCanopyTileUrl();
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error creating Canopy raster tile URL:", error);
    return NextResponse.json({ error: "Failed fetching tiles" }, { status: 500 });
  }
}
