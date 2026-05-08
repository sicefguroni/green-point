/**
 * Deterministic per-barangay strategy evaluator.
 *
 * Mirrors what a planner (or the RAG pipeline on the map tab) would do:
 * match the intervention to the *site context*, not just the one with the
 * cheapest unit cost. The creation strategies are each scored against
 * the barangay's baseline hazards, and the highest-fit strategy is surfaced
 * as the "Recommended Intervention" in the dashboard table.
 *
 * Key design choices:
 *   1. **Creation outranks stewardship by construction.** The candidate
 *      strategies are all *creation* interventions that add new greenery or
 *      green infrastructure. Stewardship / maintenance is intentionally not a
 *      candidate for the dashboard's "Recommended Intervention" column — that
 *      recommendation is meant to describe the highest-fit way to *expand*
 *      greenery in the barangay.
 *      The map-tab AI recommendations apply the same creation > stewardship
 *      ranking via `intervention-context-scoring.ts`.
 *   2. **Context fit dominates.** Flood-prone barangays → rain garden,
 *      hot + bare → urban canopy, balanced areas → green corridor. Without
 *      this, urban canopy would always win because it's the cheapest per m²
 *      and easiest to deliver — which is what users reported seeing.
 *   3. **Cost is the treated-footprint cost.** We use the engine's CAPEX
 *      (treated m² × per-m² rate), which matches the map tab's cost card
 *      to the peso. This is the real "projected budget" for delivering the
 *      strategy at moderate scale.
 *   4. **No budget binding.** Canonical runs use an unbounded budget so the
 *      dashboard shows "what it would take to build this", not "what fits
 *      inside a fixed pot". The Simulation modal is where users pick a
 *      specific budget.
 */
import { computeOverallRating } from "@/lib/recommendations";
import {
  analyzeInterventionContext,
  classificationAlleviates,
  identifyPrimaryChallenges,
  type ChallengeAssessment,
  type InterventionClassification,
  type InterventionPlanningSignals,
  type PlanningChallenge,
} from "@/lib/intervention-context-scoring";
import { runSimulationEngine } from "./engine";
import { type InterventionType } from "./coefficients";
import { basePricePerSqm } from "./cost-model";
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
  stormwaterLitersPerYear: number;
  pm25KgPerYear: number;
  /** 0–100 composite rating (relevancy-weighted, tracks the map tab ranking). */
  overallRating: number;
  /**
   * Most severe site challenge this strategy is being measured against, if any.
   * Surfaced in the dashboard tagline so the user sees which problem the
   * recommended intervention is meant to alleviate.
   */
  primaryChallenge?: ChallengeAssessment;
  /** 0–1 alleviation score for the primary challenge, undefined if none. */
  primaryAlleviation?: number;
  axes: {
    efficiency: number;
    equity: number;
    impact: number;
    cost: number;
    relevancy: number;
    feasibility: number;
  };
};

const ZERO_CLASSIFICATION: InterventionClassification = {
  isBroadTreePlanting: false,
  isTargetedTreePlanting: false,
  isStewardship: false,
  isUnderstoryOrShrub: false,
  isEnvelopeGreening: false,
  isStormwater: false,
  isGreenCorridor: false,
  isPocketOrCommunity: false,
  isPermeableOrCoolSurface: false,
  isCoastalOrRiparian: false,
  isBufferPlanting: false,
};

/**
 * Each canonical strategy maps to one (or two) classification flags so we can
 * reuse `classificationAlleviates` without duplicating the challenge table.
 * Stewardship is intentionally absent — see the file header comment.
 */
const STRATEGY_CLASSIFICATIONS: Record<InterventionType, InterventionClassification> = {
  "urban canopy": { ...ZERO_CLASSIFICATION, isBroadTreePlanting: true },
  "targeted infill": { ...ZERO_CLASSIFICATION, isTargetedTreePlanting: true },
  "understory shrubs": { ...ZERO_CLASSIFICATION, isUnderstoryOrShrub: true },
  "green roof": { ...ZERO_CLASSIFICATION, isEnvelopeGreening: true },
  "vertical greening": { ...ZERO_CLASSIFICATION, isEnvelopeGreening: true },
  "green corridor": { ...ZERO_CLASSIFICATION, isGreenCorridor: true },
  "pocket park": { ...ZERO_CLASSIFICATION, isPocketOrCommunity: true },
  "rain garden": { ...ZERO_CLASSIFICATION, isStormwater: true },
  "permeable surface": { ...ZERO_CLASSIFICATION, isPermeableOrCoolSurface: true },
  "riparian buffer": {
    ...ZERO_CLASSIFICATION,
    isCoastalOrRiparian: true,
    isBufferPlanting: true,
  },
};

function strategyAlleviates(
  strategy: InterventionType,
  challenge: PlanningChallenge,
): number {
  return classificationAlleviates(STRATEGY_CLASSIFICATIONS[strategy], challenge);
}

type HazardSignals = {
  isFloody: boolean;
  isVeryFloody: boolean;
  isHot: boolean;
  isVeryHot: boolean;
  isBare: boolean;
  isVeryBare: boolean;
};

type PlanningSignals = HazardSignals & InterventionPlanningSignals;

function readHazards(baseline: SimulationBaselineData): PlanningSignals {
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

  const planningSignals = analyzeInterventionContext({
    ndvi: baseline.ndvi,
    lst: baseline.lst,
    treeCanopy: baseline.canopyCover,
    greeneryIndex: baseline.greeneryIndex,
    floodHazard: isVeryFloody ? 3 : isFloody ? 2 : 1,
    areaHectares: baseline.areaHectares,
  });

  return {
    ...planningSignals,
    isFloody,
    isVeryFloody,
    isHot,
    isVeryHot,
    isBare,
    isVeryBare,
  };
}

/**
 * Returns a 0–1 context-fit score per strategy. The spread across strategies
 * is deliberately wide (up to 1.0 for the right match, down to ~0.2 for a
 * clear mismatch) so the final composite can actually differentiate them.
 *
 * The base heuristic captures the canonical "matches" (rain garden ↔ flood,
 * urban canopy ↔ hot+bare, …) and is then biased by the area's *biggest*
 * challenge so the recommendation always leans toward the intervention that
 * most directly alleviates the primary issue on site.
 */
function contextFit(
  strategy: InterventionType,
  h: PlanningSignals,
  challenges: ChallengeAssessment[],
): number {
  const baseFit = baseContextFit(strategy, h);
  if (challenges.length === 0) return baseFit;

  const primary = challenges[0];
  const primaryAlleviation = strategyAlleviates(strategy, primary.challenge);
  // Context matters, but it should not overpower worse GI/cooling outcomes or
  // poor value-for-money. Keep the primary-challenge swing meaningful but
  // bounded so impact and cost can still move the top recommendation.
  let adjusted = baseFit + (primaryAlleviation - 0.5) * 0.24 * primary.severity;

  if (challenges.length >= 2) {
    const secondary = challenges[1];
    const secondaryAlleviation = strategyAlleviates(strategy, secondary.challenge);
    adjusted += (secondaryAlleviation - 0.5) * 0.1 * secondary.severity;
  }

  return Math.max(0, Math.min(1, adjusted));
}

function baseContextFit(
  strategy: InterventionType,
  h: PlanningSignals,
): number {
  if (strategy === "rain garden") {
    if (h.isVeryFloody) return 1.0;
    if (h.isFloody && h.hasHighCanopy) return 0.92;
    if (h.isFloody) return 0.85;
    if (h.hasSevereFloodPressure) return 0.9;
    return h.hasHighCanopy ? 0.4 : 0.25; // trees + grading handle moderate runoff more cheaply
  }

  if (strategy === "permeable surface") {
    if (h.hasSevereFloodPressure && h.likelyTightGround) return 0.92;
    if (h.hasFloodPressure && h.likelyTightGround) return 0.84;
    if (h.hasHeatStress && h.likelyTightGround) return 0.72;
    if (h.hasFloodPressure) return 0.68;
    return 0.35;
  }

  if (strategy === "riparian buffer") {
    if (h.hasStormPressure && h.hasFloodPressure) return 0.94;
    if (h.hasSevereFloodPressure) return 0.9;
    if (h.hasFloodPressure) return 0.78;
    return 0.34;
  }

  if (strategy === "urban canopy") {
    if (h.hasHighTreeInventory || h.hasVeryHighCanopy) {
      if (h.isVeryHot && h.hasGreenDeficit && !h.likelyTightGround) return 0.65;
      if (h.isHot && h.hasGreenDeficit && !h.likelyTightGround) return 0.58;
      return 0.25;
    }
    if (h.hasHighCanopy) {
      if (h.isVeryHot && h.isBare && !h.likelyTightGround) return 0.72;
      if (h.isHot && !h.likelyTightGround) return 0.5;
      return 0.35;
    }
    if (h.likelyTightGround) return h.isVeryHot ? 0.55 : 0.45;
    if (h.isVeryHot && h.isVeryBare) return 1.0;
    if (h.isHot && h.isBare) return 0.9;
    if (h.isBare) return 0.8;
    if (h.isHot) return 0.7;
    if (h.isVeryFloody) return 0.3; // trees alone don't address acute flood risk
    return 0.55; // canopy is a safe default everywhere
  }

  if (strategy === "targeted infill") {
    if (h.hasHighCanopy || h.hasHighTreeInventory) {
      if (h.hasHeatStress || h.hasPoorAirQuality) return 0.78;
      return 0.68;
    }
    if (h.isBare && h.isHot && !h.likelyTightGround) return 0.86;
    if (h.isBare && !h.likelyTightGround) return 0.76;
    if (h.likelyTightGround) return 0.55;
    return 0.66;
  }

  if (strategy === "understory shrubs") {
    if (h.hasHighCanopy || h.hasHighTreeInventory) {
      if (h.hasHeatStress || h.hasFloodPressure) return 0.82;
      return 0.76;
    }
    if (h.likelyTightGround) return 0.62;
    if (h.hasGreenDeficit) return 0.58;
    return 0.64;
  }

  if (strategy === "green roof") {
    if (h.likelyTightGround && h.hasFloodPressure) return 0.9;
    if (h.likelyTightGround && h.hasHeatStress) return 0.86;
    if (h.hasHeatStress && h.hasHighCanopy) return 0.74;
    if (h.hasFloodPressure && h.hasHighCanopy) return 0.72;
    return 0.38;
  }

  if (strategy === "vertical greening") {
    if (h.likelyTightGround && h.hasHeatStress) return 0.88;
    if (h.hasHeatStress && h.hasHighCanopy) return 0.8;
    if (h.hasPoorAirQuality && h.likelyTightGround) return 0.72;
    if (h.likelyTightGround) return 0.68;
    return 0.42;
  }

  // green corridor — the "balanced" choice
  if (strategy === "green corridor") {
    if (h.isHot && h.isFloody) return 0.95; // cools AND slows runoff
    if (h.hasHighCanopy && h.isHot) return 0.92; // manage/connect existing shade
    if (h.likelyTightGround && h.hasHeatStress) return 0.86;
    if (h.isHot && !h.isBare) return 0.9; // perfect for already-greened hot areas
    if (h.isFloody && !h.isVeryFloody) return 0.8;
    if (h.isHot || h.isFloody) return 0.7;
    return 0.75; // strong default for moderate-everything
  }

  if (strategy === "pocket park") {
    if (h.isSmallArea && h.hasGreenDeficit && h.hasHeatStress) return 0.9;
    if (h.likelyTightGround && h.hasGreenDeficit) return 0.82;
    if (h.hasGreenDeficit && !h.isLargeArea) return 0.76;
    if (h.hasHeatStress || h.hasFloodPressure) return 0.68;
    return 0.6;
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
    cost_per_sqm: basePricePerSqm(strategy),
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
  const challenges = identifyPrimaryChallenges(hazards);
  const primary = challenges[0];

  const raw = STRATEGY_IDS.map((strategy) => {
    const inputs = buildCanonicalInputs(strategy, baseline);
    const estimates = runSimulationEngine({ inputs, baseline });

    const impactGI = estimates.metrics.find((m) => m.key === "gi")?.delta ?? 0;
    const canopyDeltaPct =
      estimates.metrics.find((m) => m.key === "canopy")?.delta ?? 0;
    const coolingDeltaC =
      estimates.metrics.find((m) => m.key === "lst")?.delta ?? 0;
    const stormwaterLitersPerYear =
      estimates.metrics.find((m) => m.key === "stormwater")?.projected ?? 0;
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
      stormwaterLitersPerYear,
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
  const coolingBenefits = raw.map((r) => Math.max(0, -r.coolingDeltaC));
  const minCooling = Math.min(...coolingBenefits);
  const maxCooling = Math.max(...coolingBenefits);
  const stormwaterBenefits = raw.map((r) => r.stormwaterLitersPerYear);
  const minStormwater = Math.min(...stormwaterBenefits);
  const maxStormwater = Math.max(...stormwaterBenefits);

  const greeneryIndex = Number.isFinite(baseline.greeneryIndex)
    ? baseline.greeneryIndex
    : 0.5;
  const equityAxis = Math.max(0, Math.min(1, 1 - greeneryIndex));

  const evaluations: StrategyEvaluation[] = raw.map((r) => {
    const fit = contextFit(r.strategy, hazards, challenges);
    const primaryAlleviation = primary
      ? strategyAlleviates(r.strategy, primary.challenge)
      : undefined;
    const impactNorm = normalise01(r.impactGI, minImpact, maxImpact);
    const coolingNorm = normalise01(
      Math.max(0, -r.coolingDeltaC),
      minCooling,
      maxCooling,
    );
    const stormwaterNorm = normalise01(
      r.stormwaterLitersPerYear,
      minStormwater,
      maxStormwater,
    );
    const costNorm = normalise01(r.costPHP, minCost, maxCost); // 1 = most expensive
    const primaryIsFlooding =
      primary?.challenge === "severe-flooding" || primary?.challenge === "flooding";
    const outcomeImpact = primaryIsFlooding
      ? 0.45 * impactNorm + 0.3 * coolingNorm + 0.25 * stormwaterNorm
      : 0.6 * impactNorm + 0.35 * coolingNorm + 0.05 * stormwaterNorm;

    // Feasibility is close across strategies — within ±0.1 — so it doesn't
    // steamroll the site-fit signal the way 0.55 vs. 0.85 did.
    const baseFeasibility =
      r.strategy === "urban canopy"
        ? 0.8
        : r.strategy === "green corridor"
          ? 0.75
          : 0.7;
    const feasibility = Math.max(
      0.35,
      Math.min(
        0.95,
        baseFeasibility +
          (r.strategy === "urban canopy" && hazards.likelyTightGround ? -0.16 : 0) +
          (r.strategy === "urban canopy" && hazards.hasHighCanopy ? -0.08 : 0) +
          (r.strategy === "green corridor" && hazards.hasHighCanopy ? 0.06 : 0) +
          (r.strategy === "green corridor" && hazards.isLargeArea ? 0.05 : 0) +
          (r.strategy === "rain garden" && hazards.hasFloodPressure ? 0.06 : 0),
      ),
    );

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

    // Explicit "addresses the biggest issue on site" tie-breaker. This is
    // now a small bonus, not a dominant score, so worse GI/cooling outcomes
    // and higher costs can pull a strategy down.
    const challengeBonus = primary
      ? Math.max(0, (primaryAlleviation ?? 0) - 0.5) * primary.severity
      : 0;

    // Balanced composite — local fit still matters, but outcome impact
    // (GI + cooling, with stormwater added for flood contexts), cost, and
    // cost-effectiveness now carry enough weight to prevent a narrow hazard
    // match from winning when it performs worse and costs more.
    const composite =
      0.34 * fit +
      0.06 * challengeBonus +
      0.24 * outcomeImpact +
      0.16 * (1 - costNorm) + // cheaper = better
      0.09 * (efficiency / 100) +
      0.06 * feasibility +
      0.05 * equityAxis;
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
      stormwaterLitersPerYear: r.stormwaterLitersPerYear,
      pm25KgPerYear: r.pm25KgPerYear,
      overallRating,
      primaryChallenge: primary,
      primaryAlleviation,
      axes: {
        efficiency,
        equity: equityAxis,
        impact: outcomeImpact,
        cost: costNorm,
        relevancy: fit,
        feasibility,
      },
    };
  });

  return evaluations.sort((a, b) => b.overallRating - a.overallRating);
}
