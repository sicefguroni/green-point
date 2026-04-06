import { NextResponse } from "next/server";
import { getLstTileUrl } from "@/lib/api/gee_service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = await getLstTileUrl();
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error creating LST raster tile URL:", error);
    return NextResponse.json({ error: "Failed fetching LST tiles" }, { status: 500 });
  }
}
