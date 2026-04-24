/**
 * Deterministic per-barangay strategy evaluator.
 *
 * Mirrors what a planner (or the RAG pipeline on the map tab) would do:
 * match the intervention to the *site context*, not just the one with the
 * cheapest unit cost. The three canonical strategies are each scored against
 * the barangay's baseline hazards, and the highest-fit strategy is surfaced
 * as the "Recommended Intervention" in the dashboard table.
 *
 * Key design choices:
 *   1. **Context fit dominates.** Flood-prone barangays → rain garden,
 *      hot + bare → urban canopy, balanced areas → green corridor. Without
 *      this, urban canopy would always win because it's the cheapest per m²
 *      and easiest to deliver — which is what users reported seeing.
 *   2. **Cost is the treated-footprint cost.** We use the engine's CAPEX
 *      (treated m² × per-m² rate), which matches the map tab's cost card
 *      to the peso. This is the real "projected budget" for delivering the
 *      strategy at moderate scale.
 *   3. **No budget binding.** Canonical runs use an unbounded budget so the
 *      dashboard shows "what it would take to build this", not "what fits
 *      inside a fixed pot". The Simulation modal is where users pick a
 *      specific budget.
 */
import { computeOverallRating } from "@/lib/recommendations";
import { runSimulationEngine } from "./engine";
import { COEFFICIENTS, type InterventionType } from "./coefficients";
import { STRATEGY_IDS, defaultClimateFromBaseline } from "./presets";
import type {
  SimulationBaselineData,
  SimulationInputsState,
} from "@/components/ui/simulation/simulation-types";

export type StrategyEvaluation = {
  strategy: InterventionType;
  /** PHP cost of the treated footprint (same pricing model as the map tab). */
  costPHP: number;
  impactGI: number;
  canopyDeltaPct: number;
  coolingDeltaC: number;
  pm25KgPerYear: number;
  /** 0–100 composite rating (relevancy-weighted, tracks the map tab ranking). */
  overallRating: number;
  axes: {
    efficiency: number;
    equity: number;
    impact: number;
    cost: number;
    relevancy: number;
    feasibility: number;
  };
};

type HazardSignals = {
  isFloody: boolean;
  isVeryFloody: boolean;
  isHot: boolean;
  isVeryHot: boolean;
  isBare: boolean;
  isVeryBare: boolean;
};

function readHazards(baseline: SimulationBaselineData): HazardSignals {
  const flood = (baseline.floodExposure ?? "").toLowerCase();
  const isFloody =
    flood.includes("high") || flood.includes("very") || flood.includes("severe");
  const isVeryFloody = flood.includes("very") || flood.includes("severe");

  const lst = baseline.lst ?? 0;
  const isHot = lst >= 33;
  const isVeryHot = lst >= 36;

  // canopyCover may arrive as fraction (0-1) or percent (0-100)
  const canopy =
    (baseline.canopyCover ?? 0) > 1
      ? (baseline.canopyCover as number)
      : (baseline.canopyCover as number) * 100;
  const isBare = canopy < 20;
  const isVeryBare = canopy < 12;

  return { isFloody, isVeryFloody, isHot, isVeryHot, isBare, isVeryBare };
}

/**
 * Returns a 0–1 context-fit score per strategy. The spread across strategies
 * is deliberately wide (up to 1.0 for the right match, down to ~0.2 for a
 * clear mismatch) so the final composite can actually differentiate them.
 */
function contextFit(
  strategy: InterventionType,
  h: HazardSignals,
): number {
  if (strategy === "rain garden") {
    if (h.isVeryFloody) return 1.0;
    if (h.isFloody) return 0.85;
    return 0.25; // trees + grading handle moderate runoff more cheaply
  }

  if (strategy === "urban canopy") {
    if (h.isVeryHot && h.isVeryBare) return 1.0;
    if (h.isHot && h.isBare) return 0.9;
    if (h.isBare) return 0.8;
    if (h.isHot) return 0.7;
    if (h.isVeryFloody) return 0.3; // trees alone don't address acute flood risk
    return 0.55; // canopy is a safe default everywhere
  }

  // green corridor — the "balanced" choice
  if (strategy === "green corridor") {
    if (h.isHot && h.isFloody) return 0.95; // cools AND slows runoff
    if (h.isHot && !h.isBare) return 0.9; // perfect for already-greened hot areas
    if (h.isFloody && !h.isVeryFloody) return 0.8;
    if (h.isHot || h.isFloody) return 0.7;
    return 0.75; // strong default for moderate-everything
  }

  return 0.5;
}

function normalise01(value: number, lo: number, hi: number): number {
  if (hi <= lo) return 0.5;
  return Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
}

/**
 * Canonical scenario — Moderate ambition, 5-year horizon, unbounded budget so
 * the engine never reports budget-binding. Strategies differ via their own
 * `treatedFractionPerCanopyPoint` coefficient, not via budget caps.
 */
const CANONICAL_BUDGET_CAP_PHP = Number.MAX_SAFE_INTEGER;

function buildCanonicalInputs(
  strategy: InterventionType,
  baseline: SimulationBaselineData,
): SimulationInputsState {
  const climate = defaultClimateFromBaseline(baseline);
  const climateRates: Record<
    ReturnType<typeof defaultClimateFromBaseline>,
    { t: number; r: number; f: "low" | "medium" | "high" }
  > = {
    stable: { t: 0.02, r: 0, f: "low" },
    warming: { t: 0.04, r: 10, f: "medium" },
    severe: { t: 0.08, r: 20, f: "high" },
  };
  const pick = climateRates[climate];

  return {
    temperature_increase_rate: pick.t,
    rainfall_change_rate: pick.r,
    flooding_severity: pick.f,
    canopy_target_percent: 15, // moderate
    ndvi_target: 0.1,
    intervention_type: strategy,
    total_budget_cap: CANONICAL_BUDGET_CAP_PHP,
    cost_per_sqm: COEFFICIENTS[strategy].costPerSqm.mid,
    maintenance_cost_rate: 6,
    time_horizon: 5,
  };
}

/**
 * Evaluate all three strategies for a given baseline. Returned array is
 * sorted by overallRating descending; `result[0]` is the recommended one.
 */
export function evaluateStrategies(
  baseline: SimulationBaselineData,
): StrategyEvaluation[] {
  const hazards = readHazards(baseline);

  const raw = STRATEGY_IDS.map((strategy) => {
    const inputs = buildCanonicalInputs(strategy, baseline);
    const estimates = runSimulationEngine({ inputs, baseline });

    const impactGI = estimates.metrics.find((m) => m.key === "gi")?.delta ?? 0;
    const canopyDeltaPct =
      estimates.metrics.find((m) => m.key === "canopy")?.delta ?? 0;
    const coolingDeltaC =
      estimates.metrics.find((m) => m.key === "lst")?.delta ?? 0;
    const pm25KgPerYear =
      estimates.metrics.find((m) => m.key === "pm25")?.projected ?? 0;

    // CAPEX = treated m² × per-m² rate, i.e. exactly what the map tab's
    // cost card shows when you size the intervention to the treated area.
    const costPHP = estimates.costProjection.capex;

    return {
      strategy,
      impactGI,
      canopyDeltaPct,
      coolingDeltaC,
      pm25KgPerYear,
      costPHP,
    };
  });

  const costs = raw.map((r) => r.costPHP).filter((c) => Number.isFinite(c));
  const minCost = costs.length ? Math.min(...costs) : 0;
  const maxCost = costs.length ? Math.max(...costs) : 1;

  const impacts = raw.map((r) => r.impactGI);
  const minImpact = Math.min(...impacts);
  const maxImpact = Math.max(...impacts);

  const greeneryIndex = Number.isFinite(baseline.greeneryIndex)
    ? baseline.greeneryIndex
    : 0.5;
  const equityAxis = Math.max(0, Math.min(1, 1 - greeneryIndex));

  const evaluations: StrategyEvaluation[] = raw.map((r) => {
    const fit = contextFit(r.strategy, hazards);
    const impactNorm = normalise01(r.impactGI, minImpact, maxImpact);
    const costNorm = normalise01(r.costPHP, minCost, maxCost); // 1 = most expensive

    // Feasibility is close across strategies — within ±0.1 — so it doesn't
    // steamroll the site-fit signal the way 0.55 vs. 0.85 did.
    const feasibility =
      r.strategy === "urban canopy"
        ? 0.8
        : r.strategy === "green corridor"
          ? 0.75
          : 0.7;

    // Cost-efficiency (0-100): ΔGI per ₱ spent, scaled relative to the best
    // candidate in this barangay.
    const costPerImpact = r.impactGI > 0 ? r.costPHP / r.impactGI : Infinity;
    const validCPIs = raw
      .map((x) => (x.impactGI > 0 ? x.costPHP / x.impactGI : Infinity))
      .filter((v) => Number.isFinite(v));
    const minCPI = validCPIs.length ? Math.min(...validCPIs) : 1;
    const efficiency = Number.isFinite(costPerImpact)
      ? Math.max(30, Math.min(100, (minCPI / costPerImpact) * 95))
      : 30;

    // Custom composite — site fit dominates (0.65) so the recommended
    // intervention genuinely varies with the barangay's hazards. Cost,
    // impact, and feasibility serve as tie-breakers between same-fit
    // strategies. Without a dominant fit weight, urban canopy would sweep
    // everything thanks to its cheapest-per-m² rate, which isn't how a
    // planner would actually triage these interventions.
    const composite =
      0.65 * fit +
      0.10 * impactNorm +
      0.08 * (1 - costNorm) + // cheaper = better
      0.08 * feasibility +
      0.05 * equityAxis +
      0.04 * (efficiency / 100);
    const overallRating =
      Math.round(Math.min(100, Math.max(0, composite * 100)) * 10) / 10;

    // We also retain the axis values for tooltips / CSV. `computeOverallRating`
    // is imported but not used here — kept around in case a caller wants the
    // map-tab-exact formula.
    void computeOverallRating;

    return {
      strategy: r.strategy,
      costPHP: r.costPHP,
      impactGI: r.impactGI,
      canopyDeltaPct: r.canopyDeltaPct,
      coolingDeltaC: r.coolingDeltaC,
      pm25KgPerYear: r.pm25KgPerYear,
      overallRating,
      axes: {
        efficiency,
        equity: equityAxis,
        impact: impactNorm,
        cost: costNorm,
        relevancy: fit,
        feasibility,
      },
    };
  });

  return evaluations.sort((a, b) => b.overallRating - a.overallRating);
}
