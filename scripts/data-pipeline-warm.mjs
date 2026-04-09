#!/usr/bin/env node
/**
 * Warms server-side caches by hitting pipeline endpoints (after deploy or on a schedule).
 * Usage:
 *   BASE_URL=https://your-app.vercel.app CRON_SECRET=xxx node scripts/data-pipeline-warm.mjs
 * Optional: append ?warm=1 if you add auth to routes (not required by default).
 */

const base =
  process.env.BASE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`
    : "http://localhost:3000");

const paths = [
  "/api/greenery-index",
  "/api/lst",
  "/api/ndvi",
  "/api/aqi",
  "/api/lst-tiles",
  "/api/ndvi-tiles",
  "/api/canopy-tiles",
  "/api/gi-tiles",
];

async function main() {
  const secret = process.env.CRON_SECRET;
  const headers = secret
    ? { Authorization: `Bearer ${secret}` }
    : undefined;

  if (secret) {
    const cronUrl = `${base.replace(/\/$/, "")}/api/cron/data-pipeline`;
    const r = await fetch(cronUrl, { headers });
    console.log("cron revalidate:", r.status, await r.text());
  }

  for (const p of paths) {
    const url = `${base.replace(/\/$/, "")}${p}`;
    try {
      const res = await fetch(url);
      console.log(p, res.status, res.ok ? "ok" : await res.text().then((t) => t.slice(0, 80)));
    } catch (e) {
      console.error(p, e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
