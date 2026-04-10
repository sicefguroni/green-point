import { unstable_cache } from "next/cache";
import fs from "node:fs/promises";
import path from "node:path";
import {
  CACHE_TAG_STATIC_GEO,
  REVALIDATE_STATIC_GEO,
} from "@/lib/data-pipeline/constants";

async function readMandaueBarangayBoundariesUncached(): Promise<GeoJSON.FeatureCollection> {
  const boundsPath = path.join(
    process.cwd(),
    "public/geo/mandaue_barangay_boundaries.json",
  );
  const raw = await fs.readFile(boundsPath, "utf8");
  return JSON.parse(raw) as GeoJSON.FeatureCollection;
}

export const getCachedMandaueBarangayBoundaries = unstable_cache(
  readMandaueBarangayBoundariesUncached,
  ["data-pipeline", "mandaue-barangay-boundaries"],
  {
    revalidate: REVALIDATE_STATIC_GEO,
    tags: [CACHE_TAG_STATIC_GEO],
  },
);

export type MandaueGiRow = {
  name: string;
  greenery_index: number;
  ndvi: number;
  lst: number;
  tree_canopy: number;
  flood_exposure: string;
  current_intervention: string;
};

async function readMandaueBarangaysGiUncached(): Promise<MandaueGiRow[]> {
  const p = path.join(process.cwd(), "public/geo/mandaue_barangays_gi.geojson");
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw) as MandaueGiRow[];
}

export const getCachedMandaueBarangaysGi = unstable_cache(
  readMandaueBarangaysGiUncached,
  ["data-pipeline", "mandaue-barangays-gi"],
  {
    revalidate: REVALIDATE_STATIC_GEO,
    tags: [CACHE_TAG_STATIC_GEO],
  },
);
