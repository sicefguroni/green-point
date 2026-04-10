import { fetchGeeMetricsPoint } from "./src/lib/api/gee_service";

async function test() {
  console.log("Starting GEE point fetch test...");
  try {
    const start = Date.now();
    const metrics = await fetchGeeMetricsPoint(10.3333, 123.9333);
    const ms = Date.now() - start;
    console.log(`Success in ${ms}ms!`, metrics);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
