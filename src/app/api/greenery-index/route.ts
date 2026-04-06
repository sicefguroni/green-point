import { NextResponse } from "next/server";
import { fetchGeeMetricsBulk } from "@/lib/api/gee_service";
import {
  calculateGreeneryIndex,
  estimateTreeCanopy,
  estimateGreenArea,
} from "@/lib/api/greenery_index";
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

    const giLookup = new Map<string, ReturnType<typeof calculateGreeneryIndex>>();
    
    for (const [name, data] of geeData.entries()) {
      const lst = data.lst ?? 30;
      const ndvi = data.ndvi ?? 0.3;
      const treeCanopy = estimateTreeCanopy(ndvi, lst);
      const greenArea = estimateGreenArea(ndvi, 1);

      const gi = calculateGreeneryIndex({ ndvi, lst, treeCanopy, greenArea });
      giLookup.set(name, gi);
    }

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const features: GeoJSON.Feature[] = bounds.features.map((f) => {
      const name = f.properties?.name;
      const gi = name ? giLookup.get(name) : undefined;

      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          type: "greenery",
          name,
          greeneryIndex: gi?.greeneryIndex ?? null,
          level: gi?.level ?? null,
          ndvi: gi?.metrics.ndvi ?? null,
          lst: gi?.metrics.lst ?? null,
          treeCanopy: gi?.metrics.treeCanopy ?? null,
          date: today,
        },
      };
    });

    return NextResponse.json({
      type: "FeatureCollection",
      features,
    } satisfies GeoJSON.FeatureCollection);
  } catch (error) {
    console.error("Error building Greenery Index layer:", error);
    return NextResponse.json(
      { type: "FeatureCollection", features: [] },
      { status: 500 },
    );
  }
}

