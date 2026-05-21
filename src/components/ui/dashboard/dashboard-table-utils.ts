import * as turf from "@turf/turf";
import { STRATEGY_LABELS } from "@/lib/simulation/presets";
import type { InterventionType } from "@/lib/simulation/coefficients";
import { evaluateStrategies } from "@/lib/simulation/evaluate-strategies";
import {
  estimateCost,
  resolveStrategyKey,
} from "@/lib/simulation/cost-model";
import { COEFFICIENTS, CANONICAL_CANOPY_TARGET_PCT } from "@/lib/simulation/coefficients";
import type { SimulationBaselineData } from "@/components/ui/simulation/simulation-types";
import type { AIRecommendation } from "./use-ai-recommendations";
import type {
  Status,
  StrategyEvalLite,
  TableRow,
  DashboardMetricProperties,
  StaticBarangayMetricRow,
  BulkRecEntry,
} from "./dashboard-table-types";

// ─── Utility helpers ──────────────────────────────────────────────────────

function floodLabelToHazard(label: string): number | null {
  const s = label.toLowerCase();
  if (s.includes("very") || s.includes("severe")) return 3;
  if (s.includes("high")) return 3;
  if (s.includes("medium") || s.includes("mod")) return 2;
  if (s.includes("low") || s === "" || s === "none") return 1;
  return null;
}

export function readFiniteNumber(
  props: DashboardMetricProperties,
  keys: string[],
  fallback: number,
): number {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

export function readOptionalFiniteNumber(
  props: DashboardMetricProperties,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

export function readString(
  props: DashboardMetricProperties,
  keys: string[],
  fallback: string,
): string {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

export function readOptionalString(
  props: DashboardMetricProperties,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

// ─── Data transformation ──────────────────────────────────────────────────

function rowToFeature(
  row: StaticBarangayMetricRow,
): GeoJSON.Feature<GeoJSON.Geometry | null> {
  return {
    type: "Feature",
    geometry: null,
    properties: row as DashboardMetricProperties,
  };
}

export function normalizeFeatureCollection(
  data: GeoJSON.FeatureCollection | null,
  fallbackRows: StaticBarangayMetricRow[],
): GeoJSON.Feature<GeoJSON.Geometry | null>[] {
  const fallbackByName = new Map(
    fallbackRows.map((row) => [row.name.trim().toLowerCase(), row]),
  );

  if (!data?.features?.length) {
    return fallbackRows.map(rowToFeature);
  }

  return data.features.map((feature) => {
    const props = (feature.properties ?? {}) as DashboardMetricProperties;
    const name = readString(props, ["name", "barangay"], "");
    const fallback = name
      ? fallbackByName.get(name.trim().toLowerCase())
      : undefined;
    if (!fallback) return feature;

    return {
      ...feature,
      properties: {
        ...fallback,
        ...props,
        greenery_index:
          readOptionalFiniteNumber(props, [
            "greenery_index",
            "greeneryIndex",
            "GI",
          ]) ?? fallback.greenery_index,
        ndvi:
          readOptionalFiniteNumber(props, ["ndvi", "NDVI"]) ?? fallback.ndvi,
        lst:
          readOptionalFiniteNumber(props, ["lst", "LST", "temperature"]) ??
          fallback.lst,
        tree_canopy:
          readOptionalFiniteNumber(props, [
            "tree_canopy",
            "treeCanopy",
            "canopyCover",
          ]) ?? fallback.tree_canopy,
        flood_exposure:
          readString(
            props,
            ["flood_exposure", "floodExposure", "floodHazard"],
            "",
          ) || fallback.flood_exposure,
        current_intervention:
          readString(
            props,
            ["current_intervention", "currentIntervention"],
            "",
          ) || fallback.current_intervention,
      },
    };
  });
}

/**
 * Single source of truth for converting a normalized GeoJSON feature into a
 * `SimulationBaselineData`. Both the dashboard's per-row evaluation and the
 * "Simulate" handoff *must* go through this helper so they hand identical
 * inputs to `evaluateStrategies` — otherwise the dashboard's recommended
 * intervention can diverge from the simulation modal's strategy step purely
 * because of inconsistent default values for missing properties.
 */
export function featureToBaseline(
  feature: GeoJSON.Feature<GeoJSON.Geometry | null>,
  idx: number = 0,
): SimulationBaselineData | null {
  const p = feature.properties;
  if (!p || typeof p !== "object") return null;
  const props = p as Record<string, unknown>;

  const name = readString(props, ["name", "barangay"], `Barangay ${idx}`);

  let areaHectares = 0;
  try {
    if (feature.geometry) {
      const sqm = turf.area(feature as unknown as GeoJSON.Feature);
      if (Number.isFinite(sqm) && sqm > 0) areaHectares = sqm / 10_000;
    }
  } catch {
    /* ignored */
  }
  if (areaHectares <= 0) {
    const km2 =
      typeof props.area_km2 === "number" && props.area_km2 > 0
        ? props.area_km2
        : 1;
    areaHectares = km2 * 100;
  }

  return {
    name,
    ndvi: readFiniteNumber(props, ["ndvi", "NDVI"], 0.4),
    lst: readFiniteNumber(props, ["lst", "LST", "temperature"], 32),
    floodExposure: readString(
      props,
      ["flood_exposure", "floodExposure", "floodHazard"],
      "Low",
    ),
    greeneryIndex: readFiniteNumber(
      props,
      ["greenery_index", "greeneryIndex", "GI"],
      0.5,
    ),
    canopyCover: readFiniteNumber(
      props,
      ["tree_canopy", "treeCanopy", "canopyCover"],
      45,
    ),
    currentIntervention: readString(
      props,
      ["current_intervention", "currentIntervention"],
      "None",
    ),
    areaHectares,
  };
}

/**
 * Build a per-strategy evaluation map from a list of recommendation entries
 * that carry engine metrics (costPHP, impactGI, …). These come from the DB
 * (via `/api/recommendations/by-barangay`) or from the per-barangay AI hook.
 * This map becomes the single source of truth for dashboard column values
 * when DB data is available, so we never run the engine twice.
 */
export function buildEvalByStrategyFromRecs(
  recs: BulkRecEntry[] | AIRecommendation[],
): Map<InterventionType, StrategyEvalLite> {
  const map = new Map<InterventionType, StrategyEvalLite>();
  for (const rec of recs) {
    const strategy = resolveStrategyKey(rec.interventionType);
    if (rec.costPHP != null) {
      map.set(strategy, {
        costPHP: rec.costPHP,
        impactGI: rec.impactGI ?? 0,
        canopyDeltaPct: rec.canopyDeltaPct ?? 0,
        coolingDeltaC: rec.coolingDeltaC ?? 0,
        pm25KgPerYear: rec.pm25KgPerYear ?? 0,
        overallRating: rec.overallRating,
      });
    }
  }
  return map;
}

/**
 * Build a row per barangay.
 *
 * **Primary data source:** DB-stored GreeningRecommendation records (via
 * `bulkRecs` from `/api/recommendations/by-barangay`). When available, the
 * engine evaluation metrics (costPHP, impactGI, …) are derived from these
 * records — exactly what the API route's `evaluateStrategies()` computed,
 * so dashboard values match explore sidebar and simulation exactly.
 *
 * **Fallback:** When no DB records exist for a barangay, we run
 * `evaluateStrategies()` client-side with the same baseline defaults the
 * API route uses, so the table always has data even before any barangay
 * has been explored.
 */
export function buildRowFromFeature(
  feature: GeoJSON.Feature<GeoJSON.Geometry | null>,
  idx: number,
  bulkRecs?: BulkRecEntry[] | null,
): TableRow | null {
  const baseline = featureToBaseline(feature, idx);
  if (!baseline) return null;
  const name = baseline.name ?? `Barangay ${idx}`;
  const areaHectares = baseline.areaHectares ?? 0;
  const props = (feature.properties ?? {}) as DashboardMetricProperties;

  const snapshot = buildSnapshot(name, baseline, props);

  // ---- Primary: derive from DB recommendations when available ----
  if (bulkRecs && bulkRecs.length > 0) {
    const evalByStrategy = buildEvalByStrategyFromRecs(bulkRecs);
    if (evalByStrategy.size > 0) {
      return buildRowFromEval(
        idx,
        name,
        areaHectares,
        baseline,
        evalByStrategy,
        bulkRecs,
      );
    }
  }

  // ---- Fallback: run evaluateStrategies client-side ----
  const ranked = evaluateStrategies(baseline);
  const best = ranked[0];
  const strategy = best.strategy;

  const treatedFraction =
    (COEFFICIENTS[strategy]?.treatedFractionPerCanopyPoint?.mid ?? 0.01) *
    CANONICAL_CANOPY_TARGET_PCT;
  const lifecycleCost = estimateCost(
    strategy,
    areaHectares * 10000 * treatedFraction,
  ).totalEstimate;

  const evalByStrategy = new Map<InterventionType, StrategyEvalLite>(
    ranked.map((r) => [
      r.strategy,
      {
        costPHP: r.costPHP,
        impactGI: r.impactGI,
        canopyDeltaPct: r.canopyDeltaPct,
        coolingDeltaC: r.coolingDeltaC,
        pm25KgPerYear: r.pm25KgPerYear,
        overallRating: r.overallRating,
      },
    ]),
  );

  const costPerImpact =
    best.impactGI > 0 ? best.costPHP / best.impactGI : Number.POSITIVE_INFINITY;

  const primaryChallengeLabel =
    best.primaryChallenge && (best.primaryAlleviation ?? 0) >= 0.55
      ? best.primaryChallenge.label
      : undefined;
  const tagline = primaryChallengeLabel
    ? `Alleviates ${primaryChallengeLabel.toLowerCase()}`
    : STRATEGY_LABELS[strategy].tagline;

  return {
    id: idx,
    barangay: name,
    equity: baseline.greeneryIndex,
    costPHP: best.costPHP,
    costNormalized: 0,
    impactGI: best.impactGI,
    canopyDelta: best.canopyDeltaPct,
    coolingDeltaC: best.coolingDeltaC,
    pm25KgPerYear: best.pm25KgPerYear,
    costPerImpact,
    status: "Fair",
    recommendedIntervention: STRATEGY_LABELS[strategy].label,
    recommendationKey: strategy,
    recommendationTagline: tagline,
    primaryChallengeLabel,
    overallRating: best.overallRating,
    areaHectares,
    lifecycleCost,
    source: "ESA / NASA / NOAH",
    snapshot,
    evalByStrategy,
  };
}

/** Build a BarangaySnapshot from baseline + feature properties. */
function buildSnapshot(
  name: string,
  baseline: SimulationBaselineData,
  props: DashboardMetricProperties,
) {
  const canopyFraction =
    baseline.canopyCover > 1
      ? baseline.canopyCover / 100
      : baseline.canopyCover;
  return {
    name,
    ndvi: baseline.ndvi,
    lst: baseline.lst,
    treeCanopy: canopyFraction,
    greeneryIndex: baseline.greeneryIndex,
    greeneryLevel: readOptionalString(props, [
      "greenery_level",
      "greeneryLevel",
      "level",
      "gi_level",
    ]),
    floodHazard: floodLabelToHazard(baseline.floodExposure),
    stormHazard:
      readOptionalFiniteNumber(props, [
        "storm_hazard",
        "stormHazard",
        "storm_surge_level",
      ]) ?? null,
    aqi:
      readOptionalFiniteNumber(props, [
        "aqi",
        "AQI_Level",
        "air_quality",
      ]) ?? null,
    taggedTreeCount:
      readOptionalFiniteNumber(props, [
        "tagged_tree_count",
        "taggedTreeCount",
        "inventory_tree_count",
      ]) ?? null,
    inventoryCanopyFraction:
      readOptionalFiniteNumber(props, [
        "inventory_canopy_fraction",
        "inventoryCanopyFraction",
      ]) ?? null,
    areaHectares: baseline.areaHectares ?? null,
  };
}

/**
 * Build a row from an existing evalByStrategy map (derived from DB recs).
 */
function buildRowFromEval(
  idx: number,
  name: string,
  areaHectares: number,
  baseline: SimulationBaselineData,
  evalByStrategy: Map<InterventionType, StrategyEvalLite>,
  bulkRecs: BulkRecEntry[] | AIRecommendation[],
): TableRow {
  let bestStrategy: InterventionType | null = null;
  let bestRating = -1;
  for (const [strategy, eval_] of evalByStrategy) {
    if (eval_.overallRating > bestRating) {
      bestRating = eval_.overallRating;
      bestStrategy = strategy;
    }
  }
  const strategy =
    bestStrategy ?? (evalByStrategy.keys().next().value as InterventionType);
  const best = evalByStrategy.get(strategy)!;

  const costPerImpact =
    best.impactGI > 0 ? best.costPHP / best.impactGI : Number.POSITIVE_INFINITY;
  const treatedFraction =
    (COEFFICIENTS[strategy]?.treatedFractionPerCanopyPoint?.mid ?? 0.01) *
    CANONICAL_CANOPY_TARGET_PCT;
  const lifecycleCost = estimateCost(
    strategy,
    areaHectares * 10000 * treatedFraction,
  ).totalEstimate;

  const topRec = bulkRecs[0];
  const tagline =
    topRec?.summary || STRATEGY_LABELS[strategy]?.tagline || "";

  return {
    id: idx,
    barangay: name,
    equity: baseline.greeneryIndex,
    costPHP: best.costPHP,
    costNormalized: 0,
    impactGI: best.impactGI,
    canopyDelta: best.canopyDeltaPct,
    coolingDeltaC: best.coolingDeltaC,
    pm25KgPerYear: best.pm25KgPerYear,
    costPerImpact,
    status: "Fair",
    recommendedIntervention: STRATEGY_LABELS[strategy]?.label ?? strategy,
    recommendationKey: strategy,
    recommendationTagline: tagline,
    overallRating: best.overallRating,
    areaHectares,
    lifecycleCost,
    source: "GreeningRecommendation DB",
    snapshot: buildSnapshot(name, baseline, {}),
    evalByStrategy,
  };
}

/**
 * Build a per-strategy evaluation map from the per-barangay AI hook response
 * (same format as bulk recs).
 */
export function buildEvalByStrategyFromAI(
  aiList: AIRecommendation[],
): Map<InterventionType, StrategyEvalLite> {
  return buildEvalByStrategyFromRecs(aiList);
}

/**
 * Align the dashboard with **Explore**: same `/api/recommendations/generate`
 * ordering (lead card = highest `overallRating` from the API). Strategy for
 * simulation preselect = `resolveStrategyKey` on that lead card's
 * `interventionType`. When AI is unavailable, fall back to the deterministic
 * planning row (`evaluateStrategies`).
 */
export function resolveDisplayStrategy(
  row: TableRow,
  aiList: AIRecommendation[] | null,
): {
  strategy: InterventionType;
  aiRec: AIRecommendation | null;
  evalForStrategy: StrategyEvalLite;
} {
  const fallbackEval = row.evalByStrategy.get(row.recommendationKey) ?? {
    costPHP: row.costPHP,
    impactGI: row.impactGI,
    canopyDeltaPct: row.canopyDelta,
    coolingDeltaC: row.coolingDeltaC,
    pm25KgPerYear: row.pm25KgPerYear,
    overallRating: row.overallRating,
  };

  if (aiList && aiList.length > 0) {
    const aiTop = aiList[0];
    const strategy = resolveStrategyKey(aiTop.interventionType);
    const aiEvalMap = buildEvalByStrategyFromAI(aiList);
    const evalForStrategy = aiEvalMap.get(strategy) ?? fallbackEval;
    return { strategy, aiRec: aiTop, evalForStrategy };
  }

  return {
    strategy: row.recommendationKey,
    aiRec: null,
    evalForStrategy: fallbackEval,
  };
}

/**
 * Finalize rows: normalize costs, derive status labels from overallRating.
 */
export function finalizeRows(rows: TableRow[]): TableRow[] {
  if (rows.length === 0) return rows;
  // Normalise based on lifecycleCost (estimateCost matching explore sidebar)
  // so the cost slider aligns with the displayed cost column.
  const costs = rows.map((r) => r.lifecycleCost).filter((c) => Number.isFinite(c));
  const minCost = costs.length ? Math.min(...costs) : 0;
  const maxCost = costs.length ? Math.max(...costs) : 1;
  const span = Math.max(1, maxCost - minCost);

  return rows.map((r) => {
    const costNormalized = (r.lifecycleCost - minCost) / span;
    let status: Status;
    if (r.overallRating >= 80) status = "Excellent";
    else if (r.overallRating >= 65) status = "Good";
    else if (r.overallRating >= 50) status = "Fair";
    else status = "Poor";
    return { ...r, costNormalized, status };
  });
}

// ─── Badge/style helpers ──────────────────────────────────────────────────

export function equityBadgeClass(value: number): string {
  if (value >= 0.7)
    return "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 ring-green-200 dark:ring-green-800/50";
  if (value >= 0.5)
    return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-800/50";
  if (value >= 0.3)
    return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-800/50";
  return "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 ring-red-200 dark:ring-red-800/50";
}

export function impactGiBadgeClass(value: number): string {
  if (value >= 0.05)
    return "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 ring-green-200 dark:ring-green-800/50";
  if (value >= 0.025)
    return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-800/50";
  if (value >= 0.01)
    return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-800/50";
  return "bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 ring-neutral-200 dark:ring-neutral-700";
}

export const STATUS_BADGE_STYLES: Record<
  Status,
  { dot: string; bg: string; text: string; ring: string }
> = {
  Excellent: {
    dot: "bg-green-500",
    bg: "bg-green-50 dark:bg-green-950/40",
    text: "text-green-700 dark:text-green-400",
    ring: "ring-green-200 dark:ring-green-800/50",
  },
  Good: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "ring-emerald-200 dark:ring-emerald-800/50",
  },
  Fair: {
    dot: "bg-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    ring: "ring-amber-200 dark:ring-amber-800/50",
  },
  Poor: {
    dot: "bg-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-400",
    ring: "ring-red-200 dark:ring-red-800/50",
  },
};
