import * as turf from "@turf/turf";
import {
  fetchGeeMetricsForPolygons,
  type BarangayPolygon,
  type PolygonMetrics,
} from "@/lib/api/gee_service";
import { estimateTreeCanopy } from "@/lib/api/greenery_index";
import {
  blendCanopy,
  computeInventoryCanopyFraction,
  groupTreesByBarangay,
  type TreeInventoryRecord,
} from "@/lib/data-pipeline/tree-canopy";
import type { prisma as prismaClient } from "@/lib/prisma";

/**
 * Barangay satellite metrics, measured as the mean over each barangay's
 * polygon (not one pixel at its centroid):
 *
 * - Current values: a 12-month window ending now, written to `BarangayMetrics`
 *   (what the dashboard, map and Explore read).
 * - Monthly history: one calendar month per row in `BarangayHistoricalMetrics`.
 *
 * Used by the daily cron (`/api/cron/data-pipeline`) and by
 * `scripts/backfill_barangay_history.ts`.
 */

type Db = typeof prismaClient;

export function barangayPolygons(
  boundaries: GeoJSON.FeatureCollection,
): BarangayPolygon[] {
  const out: BarangayPolygon[] = [];
  for (const f of boundaries.features) {
    const name = f.properties?.name;
    const g = f.geometry;
    if (typeof name !== "string" || !name.trim() || !g) continue;
    if (g.type !== "Polygon" && g.type !== "MultiPolygon") continue;
    out.push({ name: name.trim(), geometry: g });
  }
  return out;
}

/** "YYYY-MM" for a date, in UTC. */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** [start, end) of a "YYYY-MM" month, in UTC. */
export function monthWindow(key: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`Invalid month key: ${key}`);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) throw new Error(`Invalid month key: ${key}`);
  return {
    start: new Date(Date.UTC(y, mo, 1)),
    end: new Date(Date.UTC(y, mo + 1, 1)),
  };
}

/** The `count` calendar months before the current one, oldest first. */
export function lastFullMonths(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = count; i >= 1; i--) {
    keys.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return keys;
}

/** The 12 months ending at `now`. */
export function annualWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setUTCFullYear(now.getUTCFullYear() - 1);
  return { start, end: now };
}

/**
 * Canopy for a barangay, computed the same way as the live greenery-index
 * layer (spectral estimate blended with the tagged-tree inventory). LST only
 * applies a small heat penalty (at most 0.1); when the month has no clean LST,
 * `fallbackLst` (the barangay's 12-month LST) is used for that penalty.
 */
export function barangayCanopy(
  ndvi: number | null,
  lst: number | null,
  fallbackLst: number | null,
  trees: TreeInventoryRecord[],
  areaM2: number,
): number | null {
  if (ndvi === null) return null;
  const heat = lst ?? fallbackLst;
  const spectral = estimateTreeCanopy(ndvi, heat ?? 0);
  const inventory = computeInventoryCanopyFraction(trees, areaM2);
  return blendCanopy(inventory, spectral, trees.length > 0);
}

async function barangayIdsByName(db: Db): Promise<Map<string, string>> {
  const rows = await db.barangay.findMany({ select: { id: true, barangayName: true } });
  return new Map(rows.map((r) => [r.barangayName.trim().toLowerCase(), r.id]));
}

/**
 * Write the current 12-month polygon means to `BarangayMetrics`. A barangay
 * whose NDVI or LST came back empty keeps its previous value for that field.
 */
export async function refreshCurrentBarangayMetrics(
  db: Db,
  polygons: BarangayPolygon[],
  now = new Date(),
): Promise<{ updated: number; unmatched: string[]; metrics: Map<string, PolygonMetrics> }> {
  const metrics = await fetchGeeMetricsForPolygons(polygons, annualWindow(now));
  const ids = await barangayIdsByName(db);
  let updated = 0;
  const unmatched: string[] = [];

  for (const [name, v] of metrics) {
    const barangayID = ids.get(name.toLowerCase());
    if (!barangayID) {
      unmatched.push(name);
      continue;
    }
    const data = {
      ...(v.ndvi !== null ? { NDVI: v.ndvi } : {}),
      ...(v.lst !== null ? { LST: v.lst } : {}),
      lastUpdated: now,
    };
    await db.barangayMetrics.upsert({
      where: { barangayID },
      update: data,
      create: { barangayID, ...data },
    });
    updated++;
  }
  return { updated, unmatched, metrics };
}

/**
 * Write one calendar month of polygon means to `BarangayHistoricalMetrics`.
 * Months with no usable imagery are stored as null rather than filled in.
 */
export async function upsertBarangayHistoryMonth(
  db: Db,
  polygons: BarangayPolygon[],
  trees: TreeInventoryRecord[],
  month: string,
  annualLstByName: Map<string, number | null> = new Map(),
): Promise<{ written: number; missingNdvi: string[]; missingLst: string[] }> {
  const metrics = await fetchGeeMetricsForPolygons(polygons, monthWindow(month));
  const ids = await barangayIdsByName(db);
  const treesByName = groupTreesByBarangay(trees);
  const year = Number(month.slice(0, 4));
  let written = 0;
  const missingNdvi: string[] = [];
  const missingLst: string[] = [];

  for (const p of polygons) {
    const barangayID = ids.get(p.name.toLowerCase());
    if (!barangayID) continue;
    const v = metrics.get(p.name) ?? { ndvi: null, lst: null };
    if (v.ndvi === null) missingNdvi.push(p.name);
    if (v.lst === null) missingLst.push(p.name);

    const areaM2 = turf.area({ type: "Feature", properties: {}, geometry: p.geometry });
    const treeCanopy = barangayCanopy(
      v.ndvi,
      v.lst,
      annualLstByName.get(p.name) ?? null,
      treesByName[p.name] ?? [],
      areaM2,
    );
    const data = { NDVI: v.ndvi, LST: v.lst, treeCanopy, year };
    await db.barangayHistoricalMetrics.upsert({
      where: { barangayID_month: { barangayID, month } },
      update: data,
      create: { barangayID, month, ...data },
    });
    written++;
  }
  return { written, missingNdvi, missingLst };
}

/** Area centroid of each barangay polygon, as `Barangay.coordinates` { lat, lng }. */
export async function setBarangayCentroids(
  db: Db,
  polygons: BarangayPolygon[],
): Promise<number> {
  const ids = await barangayIdsByName(db);
  let n = 0;
  for (const p of polygons) {
    const barangayID = ids.get(p.name.toLowerCase());
    if (!barangayID) continue;
    const [lng, lat] = turf.centroid({ type: "Feature", properties: {}, geometry: p.geometry }).geometry.coordinates;
    await db.barangay.update({
      where: { id: barangayID },
      data: {
        coordinates: {
          lat: Math.round(lat * 1e6) / 1e6,
          lng: Math.round(lng * 1e6) / 1e6,
        },
      },
    });
    n++;
  }
  return n;
}
