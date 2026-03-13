import { NextResponse } from "next/server";
import { mergeGI } from "@/lib/MergeGI";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET() {
  try {
    const baseDir = process.cwd();

    const [boundsRaw, giRaw] = await Promise.all([
      fs.readFile(
        path.join(baseDir, "public/geo/mandaue_barangay_boundaries.json"),
        "utf8",
      ),
      fs.readFile(
        path.join(baseDir, "public/geo/mandaue_barangays_gi.geojson"),
        "utf8",
      ),
    ]);

    const bounds = JSON.parse(boundsRaw) as GeoJSON.FeatureCollection;
    const gi = JSON.parse(giRaw) as {
      name: string;
      greenery_index: number;
      ndvi: number;
      lst: number;
      tree_canopy: number;
      flood_exposure: string;
      current_intervention: string;
    }[];

    const merged = mergeGI(bounds, gi);

    const features: GeoJSON.Feature[] = merged.features.map((f) => {
      const lst = (f.properties?.lst as number | null) ?? 30;
      const aqi = Math.max(0, Math.min(200, 20 + (lst - 25) * 5));

      const pm25 = Math.round(aqi * 0.4);
      const pm10 = Math.round(aqi * 0.6);
      const no2 = Math.round(aqi * 0.2);
      const o3 = Math.round(aqi * 0.3);
      const so2 = Math.round(aqi * 0.1);

      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          type: "surface",
          aqi,
          pm25,
          pm10,
          no2,
          o3,
          so2,
        },
      };
    });

    return NextResponse.json({
      type: "FeatureCollection",
      features,
    } satisfies GeoJSON.FeatureCollection);
  } catch (error) {
    console.error("Error building AQI layer:", error);
    return NextResponse.json(
      { type: "FeatureCollection", features: [] },
      { status: 500 },
    );
  }
}

