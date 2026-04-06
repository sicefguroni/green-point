import { NextResponse } from "next/server";
import { getGiTileUrl } from "@/lib/api/gee_service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = await getGiTileUrl();
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error creating GI raster tile URL:", error);
    return NextResponse.json({ error: "Failed fetching tiles" }, { status: 500 });
  }
}
