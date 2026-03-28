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

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const features: GeoJSON.Feature[] = merged.features.map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        type: "surface",
        temperature: f.properties?.lst ?? null,
        date: today,
      },
    }));

    return NextResponse.json({
      type: "FeatureCollection",
      features,
    } satisfies GeoJSON.FeatureCollection);
  } catch (error) {
    console.error("Error building LST layer:", error);
    return NextResponse.json(
      { type: "FeatureCollection", features: [] },
      { status: 500 },
    );
  }
}

