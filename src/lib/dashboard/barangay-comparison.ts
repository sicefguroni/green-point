import * as turf from "@turf/turf";

/**
 * Pure helpers for the dashboard's "View More Details" charts. They only
 * report what the data actually contains: missing values stay `null` instead
 * of falling back to placeholder numbers.
 */

export interface CityComparison {
  greeneryIndex: number | null;
  ndvi: number | null;
  treeCanopy: number | null;
  /** Barangay polygon area in hectares, keyed by lower-cased name. */
  areaHaByName: Map<string, number>;
  meanAreaHa: number | null;
  maxAreaHa: number | null;
}

function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** City means and polygon areas from the dashboard's merged barangay features. */
export function computeCityComparison(
  features: GeoJSON.Feature[],
): CityComparison {
  const gi: number[] = [];
  const ndvi: number[] = [];
  const canopy: number[] = [];
  const areaHaByName = new Map<string, number>();

  for (const f of features) {
    const p = f.properties ?? {};
    const g = finite(p.greenery_index);
    const n = finite(p.ndvi);
    const c = finite(p.tree_canopy);
    if (g !== null) gi.push(g);
    if (n !== null) ndvi.push(n);
    if (c !== null) canopy.push(c);

    if (typeof p.name === "string" && f.geometry) {
      try {
        const sqm = turf.area(f);
        if (Number.isFinite(sqm) && sqm > 0) {
          areaHaByName.set(p.name.trim().toLowerCase(), sqm / 10_000);
        }
      } catch {
        /* invalid geometry: leave the area out */
      }
    }
  }

  const areas = [...areaHaByName.values()];
  return {
    greeneryIndex: mean(gi),
    ndvi: mean(ndvi),
    treeCanopy: mean(canopy),
    areaHaByName,
    meanAreaHa: mean(areas),
    maxAreaHa: areas.length ? Math.max(...areas) : null,
  };
}

export interface RadarRow {
  metric: string;
  barangay: number;
  city: number;
}

export interface RadarBarangay {
  name: string;
  greeneryIndex: number;
  ndvi: number;
  treeCanopy: number;
}

/**
 * Radar rows for one barangay vs the city mean. A metric is left out when the
 * city has no value for it. "Area" is the share of the largest barangay (0–1).
 */
export function buildRadarRows(
  barangay: RadarBarangay,
  city: CityComparison,
): RadarRow[] {
  const rows: RadarRow[] = [];
  if (city.greeneryIndex !== null)
    rows.push({
      metric: "Greenery Index",
      barangay: barangay.greeneryIndex,
      city: city.greeneryIndex,
    });
  if (city.ndvi !== null)
    rows.push({ metric: "NDVI", barangay: barangay.ndvi, city: city.ndvi });
  if (city.treeCanopy !== null)
    rows.push({
      metric: "Canopy %",
      barangay: barangay.treeCanopy,
      city: city.treeCanopy,
    });

  const area = city.areaHaByName.get(barangay.name.trim().toLowerCase());
  if (area !== undefined && city.maxAreaHa && city.meanAreaHa !== null) {
    rows.push({
      metric: "Area",
      barangay: area / city.maxAreaHa,
      city: city.meanAreaHa / city.maxAreaHa,
    });
  }
  return rows;
}

export interface HistoryRecord {
  month: string;
  year: number;
  /** "YYYY-MM" */
  fullDate: string;
  NDVI: number | null;
  LST: number | null;
  canopy: number | null;
}

export interface YearlyPoint {
  month: string;
  NDVI: number;
  LST: number;
}

/**
 * Yearly NDVI and LST means, only for calendar years with all 12 months on
 * record, so a partial year doesn't read as a trend.
 */
export function yearlyMeans(history: HistoryRecord[]): YearlyPoint[] {
  const byYear = new Map<number, HistoryRecord[]>();
  for (const r of history) {
    const list = byYear.get(r.year) ?? [];
    list.push(r);
    byYear.set(r.year, list);
  }

  const points: YearlyPoint[] = [];
  for (const [year, rows] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    if (new Set(rows.map((r) => r.fullDate)).size < 12) continue;
    const n = mean(rows.map((r) => r.NDVI).filter((v): v is number => v !== null));
    const l = mean(rows.map((r) => r.LST).filter((v): v is number => v !== null));
    if (n === null || l === null) continue;
    points.push({ month: String(year), NDVI: n, LST: l });
  }
  return points;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "20261014" or "2026-10-14" → "14 Oct 2026". Anything else is returned as is. */
export function formatDatasetDate(raw: string): string {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(raw.trim());
  if (!m) return raw;
  const [, y, mo, d] = m;
  const monthIdx = Number(mo) - 1;
  if (monthIdx < 0 || monthIdx > 11 || Number(d) < 1 || Number(d) > 31) return raw;
  return `${Number(d)} ${MONTHS[monthIdx]} ${y}`;
}
