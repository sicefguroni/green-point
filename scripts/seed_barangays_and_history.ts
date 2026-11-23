/**
 * Seed Mandaue City and its barangays from the boundary polygons.
 *
 * Creates (or keeps) one Barangay row per polygon, with its area centroid as
 * `coordinates`. It no longer writes metrics or history: those used to be a
 * single value plus random noise. Real values come from Earth Engine:
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill_barangay_history.ts
 *
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/seed_barangays_and_history.ts
 */
import * as fs from "fs";
import * as path from "path";
import * as turf from "@turf/turf";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Starting DB seed...");

  const city = await prisma.city.upsert({
    where: { cityID: "mandaue" },
    update: {},
    create: {
      cityID: "mandaue",
      cityName: "Mandaue City",
      province: "Cebu",
    },
  });

  const boundaries = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "public", "geo", "mandaue_barangay_boundaries.json"),
      "utf-8",
    ),
  ) as GeoJSON.FeatureCollection;

  let count = 0;
  for (const feature of boundaries.features) {
    const name = feature.properties?.name;
    if (typeof name !== "string" || !name.trim() || !feature.geometry) continue;
    const bName = name.trim();
    const bId = bName.toLowerCase().replace(/\s+/g, "-");
    const [lng, lat] = turf.centroid(feature).geometry.coordinates;
    const coordinates = {
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
    };

    await prisma.barangay.upsert({
      where: { barangayID: bId },
      update: { barangayName: bName, coordinates },
      create: {
        barangayID: bId,
        cityID: city.id,
        barangayName: bName,
        coordinates,
      },
    });
    count++;
  }

  console.log(
    `Seeded ${count} barangays. Run scripts/backfill_barangay_history.ts for their metrics and history.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
