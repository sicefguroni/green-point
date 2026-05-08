import { fetchGeeMetricsBulk } from "../src/lib/api/gee_service";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Starting backfill for Barangay historical metrics...");

  // Fetch all barangays
  const barangays = await prisma.barangay.findMany();
  
  if (barangays.length === 0) {
    console.log("No barangays found in the database. Ensure the DB is seeded.");
    process.exit(1);
  }

  console.log(`Found ${barangays.length} barangays.`);

  const coords = barangays.map((b) => {
    // Some barangays might have centroid coordinates stored differently.
    // Let's assume the coordinates are valid. 
    // Wait, the coordinates field is a Json object like { lat: 10.3, lng: 123.9 }
    const coordData = b.coordinates as any;
    return {
      id: b.id,
      name: b.barangayName,
      lat: coordData?.lat ?? 10.33,
      lng: coordData?.lng ?? 123.93,
    };
  });

  // Calculate the dates for the last 12 months
  const now = new Date();
  const datesToFetch: { monthStr: string; year: number; dateObj: Date }[] = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    // Use the 15th of each month as a representative date
    d.setDate(15);
    
    const year = d.getFullYear();
    const monthNum = d.getMonth() + 1;
    const monthStr = `${year}-${monthNum.toString().padStart(2, '0')}`;
    
    datesToFetch.push({ monthStr, year, dateObj: d });
  }

  // Fetch in reverse chronological order or chronological
  // Let's go oldest to newest
  datesToFetch.reverse();

  for (const { monthStr, year, dateObj } of datesToFetch) {
    console.log(`Fetching GEE data for ${monthStr}...`);
    
    // Convert to the exact coordinates array expected by fetchGeeMetricsBulk
    const bulkCoords = coords.map(c => ({ name: c.id, lat: c.lat, lng: c.lng }));
    
    try {
      const results = await fetchGeeMetricsBulk(bulkCoords, dateObj);
      
      let insertedCount = 0;
      
      for (const b of coords) {
        const result = results.get(b.id);
        if (result && result.ndvi !== null && result.lst !== null) {
          // Derive a dummy tree canopy from NDVI to keep it complete
          // We can use the same heuristic we use elsewhere
          const treeCanopy = Math.max(0, result.ndvi * 0.7);

          await prisma.barangayHistoricalMetrics.upsert({
            where: {
              barangayID_month: {
                barangayID: b.id,
                month: monthStr,
              }
            },
            update: {
              NDVI: result.ndvi,
              LST: result.lst,
              treeCanopy: treeCanopy,
            },
            create: {
              barangayID: b.id,
              month: monthStr,
              year: year,
              NDVI: result.ndvi,
              LST: result.lst,
              treeCanopy: treeCanopy,
            }
          });
          insertedCount++;
        }
      }
      console.log(`Successfully saved data for ${insertedCount}/${coords.length} barangays in ${monthStr}.`);
    } catch (e) {
      console.error(`Failed to fetch/save for ${monthStr}:`, e);
    }
    
    // Avoid hitting GEE rate limits by waiting a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log("Historical data backfill complete!");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
