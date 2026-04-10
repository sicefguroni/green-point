/**
 * Citywide aggregates from the live greenery-index FeatureCollection (`/api/data?resource=greeneryIndex`).
 */

export type CityMetricAggregates = {
  meanGreeneryIndex: number;
  meanNdvi: number;
  meanTreeCanopy: number;
  meanLst: number;
  barangayCount: number;
  /** Pipeline `dateKey` from feature properties when present */
  datasetDate: string | null;
};

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export function computeCityAggregatesFromGreeneryFc(
  fc: GeoJSON.FeatureCollection,
): CityMetricAggregates {
  let sumGi = 0;
  let sumNdvi = 0;
  let sumTc = 0;
  let sumLst = 0;
  let count = 0;
  let datasetDate: string | null = null;

  for (const f of fc.features) {
    const p = f.properties;
    if (!p || typeof p.name !== "string") continue;
    const gi = toNum(p.greeneryIndex);
    if (gi === null) continue;
    sumGi += gi;
    sumNdvi += toNum(p.ndvi) ?? 0;
    sumTc += toNum(p.treeCanopy) ?? 0;
    sumLst += toNum(p.lst) ?? 0;
    count++;
    if (!datasetDate && typeof p.date === "string") datasetDate = p.date;
  }

  if (count === 0) {
    return {
      meanGreeneryIndex: 0,
      meanNdvi: 0,
      meanTreeCanopy: 0,
      meanLst: 0,
      barangayCount: 0,
      datasetDate: null,
    };
  }

  return {
    meanGreeneryIndex: sumGi / count,
    meanNdvi: sumNdvi / count,
    meanTreeCanopy: sumTc / count,
    meanLst: sumLst / count,
    barangayCount: count,
    datasetDate,
  };
}

/** Short label aligned with chloroplet tiers (0–1 GI). */
export function greeneryIndexClassLabel(gi: number): string {
  if (gi >= 0.7) return "High";
  if (gi >= 0.5) return "Medium";
  if (gi >= 0.3) return "Fair";
  return "Low";
}

export async function fetchCityMetricAggregates(): Promise<CityMetricAggregates> {
  const res = await fetch("/api/data?resource=greeneryIndex");
  const json = (await res.json()) as {
    ok?: boolean;
    data?: GeoJSON.FeatureCollection;
  };
  if (!res.ok || !json.ok || !json.data) {
    throw new Error("Failed to load city metrics");
  }
  return computeCityAggregatesFromGreeneryFc(json.data);
}
