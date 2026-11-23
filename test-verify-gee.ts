// Manual check: 12-month NDVI/LST means over each barangay polygon.
//   npx dotenv -e .env.local -- npx tsx test-verify-gee.ts
import fs from "node:fs/promises";
import path from "node:path";
import { fetchGeeMetricsForPolygons } from "./src/lib/api/gee_service";
import { annualWindow, barangayPolygons } from "./src/lib/data-pipeline/barangay-metrics-refresh";

async function verifyData() {
  const boundsPath = path.join(process.cwd(), "public/geo/mandaue_barangay_boundaries.json");
  const bounds = JSON.parse(await fs.readFile(boundsPath, "utf8"));
  const polygons = barangayPolygons(bounds);
  console.log(`${polygons.length} barangay polygons. Fetching GEE data...`);

  const start = Date.now();
  const data = await fetchGeeMetricsForPolygons(polygons, annualWindow(new Date()));
  console.log(`Fetched in ${Date.now() - start}ms.`);
  for (const [name, metrics] of data.entries()) {
    console.log(`${name.padEnd(20)} | NDVI: ${metrics.ndvi} | LST: ${metrics.lst}°C`);
  }
}

verifyData().catch(console.error);
