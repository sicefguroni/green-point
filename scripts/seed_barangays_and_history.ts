import * as fs from "fs";
import * as path from "path";
import { prisma } from "../src/lib/prisma";
import { estimateTreeCanopy } from "../src/lib/api/greenery_index";
import {
  computeInventoryCanopyFraction,
  blendCanopy,
  groupTreesByBarangay,
} from "../src/lib/data-pipeline/tree-canopy";

interface BarangayGeoJsonItem {
  name: string;
  ndvi?: number;
  lst?: number;
  tree_canopy?: number;
}

function polygonAreaM2(geometry: GeoJSON.Geometry): number {
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return 0;
  const rings =
    geometry.type === "Polygon"
      ? [geometry.coordinates[0]]
      : geometry.coordinates.map((p: any) => p[0]);

  let totalArea = 0;
  const DEG_TO_M_LAT = 111_320;
  for (const ring of rings) {
    const lat =
      ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length;
    const degToMLng = DEG_TO_M_LAT * Math.cos((lat * Math.PI) / 180);
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      area +=
        ring[j][0] * degToMLng * (ring[i][1] * DEG_TO_M_LAT) -
        ring[i][0] * degToMLng * (ring[j][1] * DEG_TO_M_LAT);
    }
    totalArea += Math.abs(area) / 2;
  }
  return totalArea;
}

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

  // 1. Load Tagged Trees
  const allTrees = await prisma.taggedTree.findMany({
    select: {
      latitude: true,
      longitude: true,
      dbhCm: true,
      heightFt: true,
      barangay: true,
    },
  });
  const treesByBarangay = groupTreesByBarangay(allTrees as any);

  // 2. Load Current DB Metrics for baselines
  const dbBarangays = await prisma.barangay.findMany({
    include: { metrics: true },
  });

  // 3. Load GeoJSON Boundaries
  const boundariesPath = path.join(
    process.cwd(),
    "public",
    "geo",
    "mandaue_barangay_boundaries.json",
  );
  const boundaries = JSON.parse(
    fs.readFileSync(boundariesPath, "utf-8"),
  ) as GeoJSON.FeatureCollection;

  // 4. Load Static Data (Fallback only)
  const geoJsonPath = path.join(
    process.cwd(),
    "public",
    "geo",
    "mandaue_barangays_gi.geojson",
  );
  if (!fs.existsSync(geoJsonPath)) {
    console.error(`GeoJSON file not found at ${geoJsonPath}`);
    process.exit(1);
  }
  const data = JSON.parse(
    fs.readFileSync(geoJsonPath, "utf-8"),
  ) as BarangayGeoJsonItem[];

  console.log(`Found ${data.length} static barangay records.`);

  let count = 0;
  for (const item of data) {
    if (item.name) {
      const bName = item.name;
      const bId = bName.toLowerCase().replace(/\s+/g, "-");

      // Find the DB record to get live metrics
      const dbMatch = dbBarangays.find((b) => b.barangayID === bId);

      const ndvi =
        (dbMatch?.metrics as any)?.NDVI ??
        (typeof item.ndvi === "number" ? item.ndvi : 0.3);
      const lst =
        (dbMatch?.metrics as any)?.LST ??
        (typeof item.lst === "number" ? item.lst : 30);

      // Calculate baseline exactly like the live dashboard
      const spectralCanopy = estimateTreeCanopy(ndvi, lst);
      const barangayTrees = treesByBarangay[bName] || [];
      const boundaryFeature = boundaries.features.find(
        (f: any) => f.properties?.name === bName,
      );
      const areaM2 = boundaryFeature?.geometry
        ? polygonAreaM2(boundaryFeature.geometry)
        : 0;

      const inventoryCanopy = computeInventoryCanopyFraction(
        barangayTrees,
        areaM2,
      );
      const baseCanopy = blendCanopy(
        inventoryCanopy,
        spectralCanopy,
        barangayTrees.length > 0,
      );

      const bRecord = await prisma.barangay.upsert({
        where: { barangayID: bId },
        update: {
          barangayName: bName,
        },
        create: {
          barangayID: bId,
          cityID: city.id,
          barangayName: bName,
          coordinates: { lat: 10.33, lng: 123.93 },
        },
      });

      if (bRecord) {
        const now = new Date();
        for (let i = 0; i < 12; i++) {
          const d = new Date(now);
          d.setMonth(d.getMonth() - i);

          const year = d.getFullYear();
          const monthNum = d.getMonth() + 1;
          const monthStr = `${year}-${monthNum.toString().padStart(2, "0")}`;

          const isDry = monthNum >= 3 && monthNum <= 5;
          const ndviVariation = isDry ? -0.05 : Math.random() * 0.04 - 0.02;
          const lstVariation = isDry ? 1.5 : Math.random() * 2 - 1;

          const currentNdvi = Math.max(0, ndvi + ndviVariation);
          const currentLst = lst + lstVariation;

          const currentCanopy = Math.max(0, baseCanopy + ndviVariation * 0.5);

          await prisma.barangayHistoricalMetrics.upsert({
            where: {
              barangayID_month: {
                barangayID: bRecord.id,
                month: monthStr,
              },
            },
            update: {
              NDVI: currentNdvi,
              LST: currentLst,
              treeCanopy: currentCanopy,
            },
            create: {
              barangayID: bRecord.id,
              month: monthStr,
              year: year,
              NDVI: currentNdvi,
              LST: currentLst,
              treeCanopy: currentCanopy,
            },
          });
        }
      }
      count++;
    }
  }

  console.log(
    `Successfully seeded ${count} barangays and their 12-month historical data.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
