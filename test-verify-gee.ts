import fs from "node:fs/promises";
import path from "node:path";
import { fetchGeeMetricsBulk } from "./src/lib/api/gee_service";
import { computeBarangayCentroids } from "./src/lib/geo/centroids";

async function verifyData() {
  const boundsPath = path.join(process.cwd(), "public/geo/mandaue_barangay_boundaries.json");
  const boundsRaw = await fs.readFile(boundsPath, "utf8");
  const bounds = JSON.parse(boundsRaw);
  
  const centroids = computeBarangayCentroids(bounds);
  console.log(`Computed ${centroids.length} centroids. Fetching GEE data...`);
  
  const start = Date.now();
  const data = await fetchGeeMetricsBulk(centroids);
  const ms = Date.now() - start;
  
  console.log(`Fetched in ${ms}ms. Verified Data:`);
  let count = 0;
  for (const [name, metrics] of data.entries()) {
    console.log(`${name.padEnd(20)} | NDVI: ${metrics.ndvi} | LST: ${metrics.lst}°C`);
    if (++count >= 10) break; // just show top 10
  }
}

verifyData().catch(console.error);
