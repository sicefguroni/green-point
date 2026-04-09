import { NextResponse } from "next/server";
import { fetchGeeMetricsBulk } from "@/lib/api/gee_service";
import { computeBarangayCentroids } from "@/lib/geo/centroids";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET() {
  try {
    const boundsPath = path.join(
      process.cwd(),
      "public/geo/mandaue_barangay_boundaries.json",
    );
    const boundsRaw = await fs.readFile(boundsPath, "utf8");
    const bounds = JSON.parse(boundsRaw) as GeoJSON.FeatureCollection;

    const centroids = computeBarangayCentroids(bounds);
    const geeData = await fetchGeeMetricsBulk(centroids);

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const features: GeoJSON.Feature[] = bounds.features.map((f) => {
      const name = f.properties?.name;
      const data = name ? geeData.get(name) : null;

      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          type: "vegetation",
          name,
          ndvi: data?.ndvi ?? null,
          date: today,
          source: data?.ndvi !== null ? "Sentinel-2 (via GEE)" : "unavailable",
        },
      };
    });

    return NextResponse.json({
      type: "FeatureCollection",
      features,
    } satisfies GeoJSON.FeatureCollection);
  } catch (error) {
    console.error("Error building NDVI layer:", error);
    return NextResponse.json(
      { type: "FeatureCollection", features: [] },
      { status: 500 },
    );
  }
}
