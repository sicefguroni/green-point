"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { getGreeneryTextColor } from "@/lib/chloroplet-colors";
import { formatPHP, formatSignedQuantity } from "@/lib/format-number";
import SimulationModal from "../simulation/Simulation";

import { useBarangay } from "@/context/BarangayContext";
import { useGeoData } from "@/context/geoDataStore";
import * as turf from "@turf/turf";
import { STRATEGY_LABELS } from "@/lib/simulation/presets";
import type { InterventionType } from "@/lib/simulation/coefficients";
import { evaluateStrategies } from "@/lib/simulation/evaluate-strategies";
import { resolveStrategyKey } from "@/lib/simulation/cost-model";
import type { SimulationBaselineData } from "@/components/ui/simulation/simulation-types";
import {
  useAIRecommendations,
  type AIRecommendation,
  type BarangaySnapshot,
} from "./use-ai-recommendations";

type Status = "Excellent" | "Good" | "Fair" | "Poor";

type StrategyEvalLite = {
  costPHP: number;
  impactGI: number;
  canopyDeltaPct: number;
  coolingDeltaC: number;
  pm25KgPerYear: number;
  overallRating: number;
};

type TableRow = {
  id: number;
  barangay: string;
  equity: number;
  costPHP: number;
  costNormalized: number;
  impactGI: number;
  canopyDelta: number;
  /** ΔLST in °C. Negative (cooling) is the desirable direction. */
  coolingDeltaC: number;
  /** PM2.5 removed per year in kg (canonical run). */
  pm25KgPerYear: number;
  costPerImpact: number;
  status: Status;
  recommendedIntervention: string;
  recommendationKey: InterventionType;
  recommendationTagline: string;
  /** Most severe site challenge this intervention is meant to alleviate, if any. */
  primaryChallengeLabel?: string;
  /** 0–100 composite rating (same formula the map tab's recommendation cards use). */
  overallRating: number;
  areaHectares: number;
  source: string;
  /** Snapshot used to identify the row when fetching AI recommendations. */
  snapshot: BarangaySnapshot;
  /**
   * Pre-computed deterministic evaluation per canonical strategy. Lets the
   * row renderer instantly look up the score / cost / impact for whatever
   * strategy the AI ends up picking, without running the engine again.
   */
  evalByStrategy: Map<InterventionType, StrategyEvalLite>;
};

function floodLabelToHazard(label: string): number | null {
  const s = label.toLowerCase();
  if (s.includes("very") || s.includes("severe")) return 3;
  if (s.includes("high")) return 3;
  if (s.includes("medium") || s.includes("mod")) return 2;
  if (s.includes("low") || s === "" || s === "none") return 1;
  return null;
}

type DashboardMetricProperties = Record<string, unknown>;

type StaticBarangayMetricRow = {
  name: string;
  greenery_index?: number | null;
  ndvi?: number | null;
  lst?: number | null;
  tree_canopy?: number | null;
  flood_exposure?: string | null;
  current_intervention?: string | null;
};

function readFiniteNumber(
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

function readOptionalFiniteNumber(
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

function readString(
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

function rowToFeature(
  row: StaticBarangayMetricRow,
): GeoJSON.Feature<GeoJSON.Geometry | null> {
  return {
    type: "Feature",
    geometry: null,
    properties: row as DashboardMetricProperties,
  };
}

function normalizeFeatureCollection(
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
    const fallback = name ? fallbackByName.get(name.trim().toLowerCase()) : undefined;
    if (!fallback) return feature;

    return {
      ...feature,
      properties: {
        ...fallback,
        ...props,
        greenery_index:
          readOptionalFiniteNumber(props, ["greenery_index", "greeneryIndex", "GI"]) ??
          fallback.greenery_index,
        ndvi: readOptionalFiniteNumber(props, ["ndvi", "NDVI"]) ?? fallback.ndvi,
        lst:
          readOptionalFiniteNumber(props, ["lst", "LST", "temperature"]) ??
          fallback.lst,
        tree_canopy:
          readOptionalFiniteNumber(
            props,
            ["tree_canopy", "treeCanopy", "canopyCover"],
          ) ?? fallback.tree_canopy,
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
 *
 * Default values were chosen to be neutral / typical for Mandaue barangays
 * (slightly green, moderately warm, mostly low flood) so that rows with
 * incomplete data do not collapse onto a degenerate `0/0/0` baseline that
 * would always recommend the cheapest urban-canopy default.
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
 * Build a row per barangay. For each one we evaluate all canonical creation
 * strategies and take the highest-rated as the "Recommended Intervention".
 * Cost comes from the shared cost model so it matches the map tab's cost card
 * to the peso, and budget-binding is deliberately disabled — the dashboard
 * shows "what it would take to build this", not "what fits inside a fixed pot".
 */
function buildRowFromFeature(
  feature: GeoJSON.Feature<GeoJSON.Geometry | null>,
  idx: number,
): TableRow | null {
  const baseline = featureToBaseline(feature, idx);
  if (!baseline) return null;
  const name = baseline.name ?? `Barangay ${idx}`;
  const areaHectares = baseline.areaHectares ?? 0;

  const ranked = evaluateStrategies(baseline);
  const best = ranked[0];
  const strategy = best.strategy;

  // Cache the deterministic engine's verdict for *every* canonical strategy,
  // not just the top one. The renderer can then look up the score / cost /
  // impact for whatever strategy the AI ends up picking — without needing to
  // re-run the engine.
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

  // Snapshot fed to the same RAG pipeline the map tab uses. Tree canopy is
  // normalised to a 0-1 fraction so the AI prompt's metric block matches
  // the map tab exactly.
  const canopyFraction =
    baseline.canopyCover > 1 ? baseline.canopyCover / 100 : baseline.canopyCover;
  const snapshot: BarangaySnapshot = {
    name,
    ndvi: baseline.ndvi,
    lst: baseline.lst,
    treeCanopy: canopyFraction,
    greeneryIndex: baseline.greeneryIndex,
    floodHazard: floodLabelToHazard(baseline.floodExposure),
    areaHectares: baseline.areaHectares ?? null,
  };

  // When a clear primary challenge exists and this intervention meaningfully
  // alleviates it, lead the tagline with that — so the table tells the user
  // *why* this is the chosen intervention for this barangay.
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
    costNormalized: 0, // filled in a second pass below
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
    source: "ESA / NASA / NOAH",
    snapshot,
    evalByStrategy,
  };
}

/**
 * Pick what to display in the dashboard's recommendation cell. The
 * **strategy** is always the deterministic ranker's top pick — that's the
 * same canonical strategy the simulation's strategy step badges as "Top fit",
 * so the two views never disagree on what the best fit is.
 *
 * The AI is used purely as **descriptive copy**: when it returned a
 * recommendation whose `interventionType` *and* whose headline `name` both
 * resolve to the same canonical strategy, we surface that AI rec's name and
 * summary. Internally-inconsistent AI responses (e.g. `name: "Pocket Parks…"`
 * paired with an Urban Canopy `interventionType`) are rejected so the
 * dashboard can never show a headline that contradicts the actual strategy.
 */
function resolveDisplayStrategy(
  row: TableRow,
  aiList: AIRecommendation[] | null,
): {
  strategy: InterventionType;
  aiRec: AIRecommendation | null;
  evalForStrategy: StrategyEvalLite;
} {
  const strategy = row.recommendationKey;
  const evalForStrategy =
    row.evalByStrategy.get(strategy) ?? {
      costPHP: row.costPHP,
      impactGI: row.impactGI,
      canopyDeltaPct: row.canopyDelta,
      coolingDeltaC: row.coolingDeltaC,
      pm25KgPerYear: row.pm25KgPerYear,
      overallRating: row.overallRating,
    };

  const aiRec =
    aiList?.find(
      (r) =>
        resolveStrategyKey(r.interventionType) === strategy &&
        resolveStrategyKey(r.name) === strategy,
    ) ?? null;

  return { strategy, aiRec, evalForStrategy };
}

function finalizeRows(rows: TableRow[]): TableRow[] {
  if (rows.length === 0) return rows;
  const costs = rows.map((r) => r.costPHP).filter((c) => Number.isFinite(c));
  const minCost = costs.length ? Math.min(...costs) : 0;
  const maxCost = costs.length ? Math.max(...costs) : 1;
  const span = Math.max(1, maxCost - minCost);

  return rows.map((r) => {
    const costNormalized = (r.costPHP - minCost) / span;
    // Status tracks the composite overall rating so it matches the map-tab
    // recommendation cards' ranking (same formula: `computeOverallRating`).
    let status: Status;
    if (r.overallRating >= 80) status = "Excellent";
    else if (r.overallRating >= 65) status = "Good";
    else if (r.overallRating >= 50) status = "Fair";
    else status = "Poor";
    return { ...r, costNormalized, status };
  });
}

export default function InterventionAnalysisTable() {
  const [equityRange, setEquityRange] = useState([0, 1]);
  const [costRange, setCostRange] = useState([0, 1]);
  const [sortColumn, setSortColumn] = useState<keyof TableRow>("costPerImpact");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const [fallbackRows, setFallbackRows] = useState<StaticBarangayMetricRow[]>([]);

  const { setSimulationBarangay } = useBarangay();
  const geoData = useGeoData((state) => state.geoData);

  useEffect(() => {
    let isMounted = true;
    fetch("/geo/mandaue_barangays_gi.geojson")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        if (!isMounted || !Array.isArray(rows)) return;
        setFallbackRows(
          rows.filter(
            (row): row is StaticBarangayMetricRow =>
              row &&
              typeof row === "object" &&
              typeof (row as StaticBarangayMetricRow).name === "string",
          ),
        );
      })
      .catch(() => {
        if (isMounted) setFallbackRows([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function selectByName(name: string, recommendedStrategy?: InterventionType) {
    const features = normalizeFeatureCollection(geoData, fallbackRows);
    if (features.length === 0) return;

    const feature = features.find(
      (f: GeoJSON.Feature<GeoJSON.Geometry | null>) =>
        f.properties?.name?.toLowerCase() === name.toLowerCase(),
    );
    if (!feature) return console.warn("Barangay not found:", name);

    // Use the same helper the dashboard table uses so the simulation modal
    // gets *exactly* the baseline that produced the row's recommendation.
    // Without this, divergent default values (e.g. canopyCover 0 vs 45) made
    // the simulation rank against a different baseline than the dashboard.
    const baseline = featureToBaseline(feature, 0);
    if (!baseline) return console.warn("Could not build baseline:", name);

    setSimulationBarangay({
      name: baseline.name ?? name,
      greeneryIndex: baseline.greeneryIndex,
      ndvi: baseline.ndvi,
      lst: baseline.lst,
      treeCanopy: baseline.canopyCover,
      floodExposure: baseline.floodExposure,
      currentIntervention: baseline.currentIntervention,
      areaHectares: baseline.areaHectares,
      // The simulation modal preselects this strategy so the user lands on
      // the exact intervention the dashboard recommended (instead of the
      // simulation's deterministic default, which might differ).
      recommendedStrategy,
    });
  }

  const tableData = useMemo(() => {
    const features = normalizeFeatureCollection(geoData, fallbackRows);
    const raw = features
      .map((f, i) => buildRowFromFeature(f, i))
      .filter((r): r is TableRow => r !== null);
    return finalizeRows(raw);
  }, [geoData, fallbackRows]);

  // Run the same RAG/OpenAI pipeline the map tab uses, per barangay, with
  // localStorage caching so we don't spend tokens on every page load.
  const snapshots = useMemo(
    () => tableData.map((r) => r.snapshot),
    [tableData],
  );
  const { byName: aiByName, refresh: refreshAI, isFetching: isFetchingAI } =
    useAIRecommendations(snapshots);

  const filteredData = useMemo(() => {
    const filtered = tableData.filter((row) => {
      const equityMatch =
        row.equity >= equityRange[0] && row.equity <= equityRange[1];
      const costMatch =
        row.costNormalized >= costRange[0] &&
        row.costNormalized <= costRange[1];
      return equityMatch && costMatch;
    });

    filtered.sort((a: TableRow, b: TableRow) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (typeof aVal !== "number" || typeof bVal !== "number") return 0;
      const aSafe = Number.isFinite(aVal) ? aVal : Number.MAX_SAFE_INTEGER;
      const bSafe = Number.isFinite(bVal) ? bVal : Number.MAX_SAFE_INTEGER;
      return sortDirection === "asc" ? aSafe - bSafe : bSafe - aSafe;
    });

    return filtered;
  }, [tableData, equityRange, costRange, sortColumn, sortDirection]);

  const handleSort = (column: keyof TableRow) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "costPerImpact" || column === "costPHP" ? "asc" : "desc");
    }
  };

  const getStatusColor = (status: Status) => {
    const colors = {
      Excellent: "bg-green-100 text-green-700 border-green-200",
      Good: "bg-emerald-100 text-emerald-700 border-emerald-200",
      Fair: "bg-yellow-100 text-yellow-700 border-yellow-200",
      Poor: "bg-red-100 text-red-700 border-red-200",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const resetFilters = () => {
    setEquityRange([0, 1]);
    setCostRange([0, 1]);
    setSortColumn("costPerImpact");
    setSortDirection("asc");
  };

  const exportCSV = () => {
    if (filteredData.length === 0) return;
    const header = [
      "Barangay",
      "Equity Index",
      "Area (ha)",
      "Est. Cost (PHP)",
      "Impact (ΔGI)",
      "Canopy Δ (%)",
      "Cooling ΔLST (°C)",
      "PM2.5 removed (kg/yr)",
      "PHP per ΔGI",
      "Status",
      "Recommended Strategy",
      "AI Headline",
      "Overall Rating",
    ];
    const rows = filteredData.map((r) => {
      const ai = aiByName[r.barangay];
      const aiList = ai?.status === "ready" ? ai.recommendations : null;
      const display = resolveDisplayStrategy(r, aiList);
      const aiHeadline = display.aiRec?.name ?? "";
      const evalForStrategy = display.evalForStrategy;
      return [
        r.barangay,
        r.equity.toFixed(3),
        r.areaHectares.toFixed(2),
        evalForStrategy.costPHP,
        evalForStrategy.impactGI.toFixed(3),
        evalForStrategy.canopyDeltaPct.toFixed(1),
        evalForStrategy.coolingDeltaC.toFixed(2),
        evalForStrategy.pm25KgPerYear.toFixed(2),
        evalForStrategy.impactGI > 0
          ? Math.round(evalForStrategy.costPHP / evalForStrategy.impactGI)
          : "n/a",
        r.status,
        STRATEGY_LABELS[display.strategy].label,
        aiHeadline,
        evalForStrategy.overallRating.toFixed(1),
      ];
    });
    const csv = [header, ...rows]
      .map((line) =>
        line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intervention-analysis-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="h-[480px] bg-white dark:bg-neutral-900 rounded-xl shadow-sm shadow-black/5 dark:shadow-black/20 border border-gray-200 dark:border-neutral-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-neutral-100">
                Barangay Cost-Effectiveness Intervention Analysis
              </h3>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
                Showing {filteredData.length} of {tableData.length} barangays ·
                Strategy + score come from the simulation&apos;s ranker (per-barangay
                context fit, impact, and cost) · descriptions are pulled from
                the AI recommendation that matches each strategy
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isFetchingAI && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-500/30"
                  title="Pulling fresh interventions for every barangay."
                >
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  Syncing…
                </span>
              )}
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-300 uppercase tracking-widest bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700">
                Source: ESA / NASA / NOAH
              </span>
              <button
                onClick={refreshAI}
                disabled={isFetchingAI}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-neutral-200 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Re-run the recommendations pipeline for every barangay."
              >
                <RefreshCw
                  className={`w-4 h-4 ${isFetchingAI ? "animate-spin" : ""}`}
                />
                Refresh interventions
              </button>
              <button
                onClick={exportCSV}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-neutral-200 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50 dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
                    Barangay
                  </th>
                  <SortableTh
                    label="Equity Index"
                    active={sortColumn === "equity"}
                    onClick={() => handleSort("equity")}
                  />
                  <SortableTh
                    label="Est. Cost"
                    active={sortColumn === "costPHP"}
                    onClick={() => handleSort("costPHP")}
                  />
                  <SortableTh
                    label="Impact ΔGI"
                    active={sortColumn === "impactGI"}
                    onClick={() => handleSort("impactGI")}
                  />
                  <SortableTh
                    label="Cooling ΔLST"
                    active={sortColumn === "coolingDeltaC"}
                    onClick={() => handleSort("coolingDeltaC")}
                  />
                  <SortableTh
                    label="PM2.5 removed"
                    active={sortColumn === "pm25KgPerYear"}
                    onClick={() => handleSort("pm25KgPerYear")}
                  />
                  <SortableTh
                    label="PHP per ΔGI"
                    active={sortColumn === "costPerImpact"}
                    onClick={() => handleSort("costPerImpact")}
                  />
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
                    Recommended Intervention
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                {filteredData.length > 0 ? (
                  filteredData.map((row, index) => {
                    // AI-driven recommendation per row. The AI's top pick
                    // (when available) drives the displayed strategy + the
                    // simulation modal's preselected strategy; the
                    // deterministic engine just supplies the per-strategy
                    // score so dashboard and simulation always agree.
                    const aiState = aiByName[row.barangay];
                    const isAILoading = aiState?.status === "loading";
                    const aiList =
                      aiState?.status === "ready"
                        ? aiState.recommendations
                        : null;
                    const display = resolveDisplayStrategy(row, aiList);
                    return (
                    <tr
                      key={row.id}
                      className={`${index % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-gray-50 dark:bg-neutral-950"} hover:bg-blue-50 dark:hover:bg-neutral-800 transition-colors`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900 dark:text-neutral-100">
                          {row.barangay}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-neutral-500">
                          {row.areaHectares.toFixed(1)} ha
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm font-semibold ${getGreeneryTextColor(row.equity)}`}
                        >
                          {row.equity.toFixed(2)}
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        title={`₱${row.costPHP.toLocaleString()} — same pricing as the map tab's cost estimate card.`}
                      >
                        <div className="text-sm font-semibold text-gray-800 dark:text-neutral-200 tabular-nums">
                          {formatPHP(row.costPHP)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-800 dark:text-neutral-200 tabular-nums">
                          {formatSignedQuantity(row.impactGI, "")}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-neutral-500">
                          +{row.canopyDelta.toFixed(1)}% canopy
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        title="Change in Land Surface Temperature. Negative (blue) means cooler; positive (red) means the scenario warms net of climate drift."
                      >
                        <div
                          className={`text-sm font-semibold tabular-nums ${
                            row.coolingDeltaC < 0
                              ? "text-sky-600 dark:text-sky-400"
                              : row.coolingDeltaC > 0.05
                                ? "text-red-600 dark:text-red-400"
                                : "text-gray-700 dark:text-neutral-200"
                          }`}
                        >
                          {row.coolingDeltaC > 0 ? "+" : ""}
                          {row.coolingDeltaC.toFixed(2)}°C
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        title="PM2.5 removed per year by the new vegetation (i-Tree Eco coefficients). Higher is better."
                      >
                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                          {row.pm25KgPerYear.toFixed(1)} kg/yr
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800 dark:text-neutral-200 tabular-nums">
                        {Number.isFinite(row.costPerImpact)
                          ? formatPHP(row.costPerImpact)
                          : "n/a"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {(() => {
                          const canonicalLabel =
                            STRATEGY_LABELS[display.strategy].label;
                          // Headline = the AI's natural-language name when it
                          // mapped cleanly to a canonical strategy; otherwise
                          // the canonical label that the simulation will use.
                          const headline =
                            display.aiRec?.name ?? canonicalLabel;
                          const tagline = display.aiRec
                            ? display.aiRec.summary ||
                              display.aiRec.justification
                            : row.recommendationTagline;
                          const ratingValue =
                            display.evalForStrategy.overallRating;
                          // Strategy + score on this row both flow from the
                          // same engine the simulation's strategy step uses,
                          // so every row is architecturally synced with the
                          // simulation. Show the pill whenever we are not
                          // actively pulling fresh AI copy.
                          const isSynced = !isAILoading;
                          return (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p
                                  className="text-sm font-medium text-neutral-700 dark:text-neutral-200 max-w-[220px] truncate"
                                  title={headline}
                                >
                                  {headline}
                                </p>
                                <span
                                  className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                                  title="Composite overall rating — same formula the simulation's strategy step uses."
                                >
                                  {ratingValue.toFixed(0)}
                                </span>
                                {isSynced && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                                    title="Strategy and score match what the simulation will compute for this barangay."
                                    aria-label="Synced"
                                  >
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    synced
                                  </span>
                                )}
                                {isAILoading && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 dark:text-neutral-400"
                                    title="Pulling the recommendation for this barangay."
                                  >
                                    <Sparkles className="w-2.5 h-2.5 animate-pulse" />
                                    syncing…
                                  </span>
                                )}
                              </div>
                              <p
                                className="text-[11px] text-gray-500 dark:text-neutral-500 max-w-[260px] truncate"
                                title={tagline}
                              >
                                {tagline}
                              </p>
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          className="hover:bg-primary-green/90 transition-colors duration-200 bg-primary-green text-white text-sm px-3 py-1 rounded-md cursor-pointer"
                          onClick={() => {
                            // Hand the AI-resolved strategy to the simulation
                            // modal so it preselects the same intervention
                            // the dashboard is showing for this row.
                            selectByName(row.barangay, display.strategy);
                            setIsSimulationOpen(true);
                          }}
                        >
                          Simulate
                        </button>
                      </td>
                    </tr>
                  );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center">
                      <div className="text-gray-400 dark:text-neutral-500">
                        <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg font-medium text-gray-600 dark:text-neutral-300">
                          No barangays match your filters
                        </p>
                        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                          Try adjusting the range sliders above
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm shadow-black/5 dark:shadow-black/20 border border-gray-200 dark:border-neutral-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-gray-600 dark:text-neutral-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-neutral-100">
              Weighting Scenario by Equity and Cost
            </h3>
          </div>
          <button
            className="text-sm text-neutral-black dark:text-neutral-200 hover:text-neutral-black/80 dark:hover:text-white font-medium transition-colors"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <RangeControl
            label="Equity Index"
            accent="green"
            min={0}
            max={1}
            step={0.01}
            value={equityRange}
            onChange={setEquityRange}
            formatValue={(v) => v.toFixed(2)}
            footerLabels={["0.00", "1.00"]}
          />
          <RangeControl
            label="Cost (relative to dataset)"
            accent="emerald"
            min={0}
            max={1}
            step={0.01}
            value={costRange}
            onChange={setCostRange}
            formatValue={(v) => v.toFixed(2)}
            footerLabels={[
              tableData.length
                ? formatPHP(Math.min(...tableData.map((r) => r.costPHP)))
                : "—",
              tableData.length
                ? formatPHP(Math.max(...tableData.map((r) => r.costPHP)))
                : "—",
            ]}
          />
        </div>
      </div>

      {isSimulationOpen && (
        <SimulationModal
          isOpen={isSimulationOpen}
          setIsOpen={setIsSimulationOpen}
        />
      )}
    </div>
  );
}

function SortableTh({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors select-none"
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`w-3 h-3 ${active ? "text-green-600" : ""}`}
        />
      </div>
    </th>
  );
}

function RangeControl({
  label,
  accent,
  min,
  max,
  step,
  value,
  onChange,
  formatValue,
  footerLabels,
}: {
  label: string;
  accent: "green" | "emerald";
  min: number;
  max: number;
  step: number;
  value: number[];
  onChange: (v: number[]) => void;
  formatValue: (v: number) => string;
  footerLabels: [string, string];
}) {
  const valueColor =
    accent === "green"
      ? "text-green-600 dark:text-green-400"
      : "text-emerald-600 dark:text-emerald-400";
  const sliderColor =
    accent === "green" ? "accent-green-500" : "accent-emerald-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">
          {label}
        </label>
        <span className={`text-sm font-semibold ${valueColor}`}>
          {formatValue(value[0])} - {formatValue(value[1])}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-neutral-500 mb-1 block">
              Min
            </label>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value[0]}
              onChange={(e) =>
                onChange([parseFloat(e.target.value), value[1]])
              }
              className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${sliderColor}`}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-neutral-500 mb-1 block">
              Max
            </label>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value[1]}
              onChange={(e) =>
                onChange([value[0], parseFloat(e.target.value)])
              }
              className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${sliderColor}`}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 dark:text-neutral-500">
          <span>{footerLabels[0]}</span>
          <span>{footerLabels[1]}</span>
        </div>
      </div>
    </div>
  );
}
