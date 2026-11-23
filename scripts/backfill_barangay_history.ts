/**
 * Rebuild barangay satellite data from Earth Engine, measured over each
 * barangay polygon:
 *
 *   1. Barangay.coordinates  <- area centroid of each boundary polygon
 *   2. BarangayMetrics        <- 12-month NDVI/LST means ending now
 *   3. BarangayHistoricalMetrics <- one row per barangay per calendar month,
 *      for the last N full months (default 60). Months with no usable imagery
 *      are stored as null, not filled in.
 *
 * Usage (needs DATABASE_URL and Earth Engine credentials: gee-key.json or
 * GEE_SERVICE_ACCOUNT_JSON):
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill_barangay_history.ts [--months 60] [--history-only]
 *
 * Safe to re-run: every write is an upsert keyed by barangay (and month).
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { fetchGeeMetricsForPolygons } from "../src/lib/api/gee_service";
import {
  annualWindow,
  barangayPolygons,
  lastFullMonths,
  refreshCurrentBarangayMetrics,
  setBarangayCentroids,
  upsertBarangayHistoryMonth,
} from "../src/lib/data-pipeline/barangay-metrics-refresh";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const months = Number(arg("--months") ?? 60);
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    throw new Error("--months must be an integer from 1 to 120");
  }
  const historyOnly = process.argv.includes("--history-only");

  const boundaries = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "public/geo/mandaue_barangay_boundaries.json"),
      "utf8",
    ),
  ) as GeoJSON.FeatureCollection;
  const polygons = barangayPolygons(boundaries);
  console.log(`${polygons.length} barangay polygons.`);

  let annualLst = new Map<string, number | null>();
  if (!historyOnly) {
    console.log(`Barangay.coordinates: ${await setBarangayCentroids(prisma, polygons)} updated.`);
    const current = await refreshCurrentBarangayMetrics(prisma, polygons);
    console.log(
      `BarangayMetrics: ${current.updated} updated` +
        (current.unmatched.length ? `; no DB row for ${current.unmatched.join(", ")}` : "") +
        ".",
    );
    annualLst = new Map([...current.metrics].map(([n, v]) => [n, v.lst] as const));
  } else {
    const annual = await fetchGeeMetricsForPolygons(polygons, annualWindow(new Date()));
    annualLst = new Map([...annual].map(([n, v]) => [n, v.lst] as const));
  }

  const trees = await prisma.taggedTree.findMany({
    select: { latitude: true, longitude: true, dbhCm: true, heightFt: true, barangay: true },
  });

  const keys = lastFullMonths(new Date(), months);
  console.log(`History: ${keys[0]} .. ${keys[keys.length - 1]} (${keys.length} months).`);
  const failed: string[] = [];
  for (const month of keys) {
    try {
      const r = await upsertBarangayHistoryMonth(prisma, polygons, trees, month, annualLst);
      console.log(
        `  ${month}: ${r.written} rows; no clean NDVI ${r.missingNdvi.length}, no clean LST ${r.missingLst.length}`,
      );
    } catch (err) {
      failed.push(month);
      console.error(`  ${month}: FAILED`, err instanceof Error ? err.message : err);
    }
  }
  if (failed.length) {
    console.error(`Failed months (re-run with --history-only): ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
