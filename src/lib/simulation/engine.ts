/**
 * Deterministic greening-simulation engine.
 *
 * Consumes raw `SimulationInputsState` + barangay baseline + `areaHectares` and
 * returns `SimulationEstimates`. All math is pure; no I/O, no OpenAI, no DB.
 * The API route layers RAG + LLM narrative on top of the values this function
 * produces. The client can also call this directly for the live-preview
 * footer in the stepper, and the dashboard runs it per strategy
 * (`evaluateStrategies`), so every surface shows the same numbers.
 *
 * Model in one paragraph: the greening target (`canopy_target_percent`, in
 * canopy-equivalent points) sets the treated footprint, clamped by the budget.
 * Cooling, NDVI and GI scale with the funded target via per-intervention
 * coefficients. Stormwater and air quality scale with the treated area. Tree
 * canopy comes from the trees actually planted on that area, and cost is the
 * shared lifecycle formula (`lifecycleTotals`) on the same footprint.
 *
 * Uncertainty propagation is done the cheap way: for each metric, compute
 * low/mid/high by evaluating the formula with the corresponding coefficient
 * tail. Good enough for UI confidence bands; not a Monte Carlo.
 */
import type {
  SimulationEstimates,
  SimulationInputsState,
  SimulationBaselineData,
  MetricEstimate,
  GIEvolutionPoint,
  AreaAggregate,
} from "@/components/ui/simulation/simulation-types";
import {
  COEFFICIENTS,
  DEFAULT_INTERVENTION,
  EVENTS_PER_YEAR,
  MATURE_CROWN_AREA_M2,
  REPRESENTATIVE_EVENT_MM,
  floodMultiplier,
  getCoefficients,
  type CoefficientSet,
  type InterventionType,
  type Range,
} from "./coefficients";
import { lifecycleTotals } from "./cost-model";

const SQM_PER_HECTARE = 10_000;
/** Environmental-quality penalty per °C of climate drift (GI sub-score). */
const ENV_QUALITY_PENALTY_PER_C = 0.04;
/** Default site area when the baseline has none (ha). */
const DEFAULT_AREA_HA = 30;

export type EngineInput = {
  inputs: SimulationInputsState;
  baseline: SimulationBaselineData;
};

type Tail = "low" | "mid" | "high";
type TailedEstimate = { low: number; mid: number; high: number };

function pick(range: Range, tail: Tail): number {
  return range[tail];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Canopy cover as percent in 0..100 (some sources give 0..1). */
function canopyPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value > 1 ? value : value * 100;
}

/** Logistic ramp: year t in [0, horizon] → fraction in [0, 1]. */
function logisticRamp(t: number, horizon: number): number {
  if (horizon <= 0) return 1;
  const midpoint = horizon * 0.55;
  const steepness = 4 / horizon;
  const raw = 1 / (1 + Math.exp(-steepness * (t - midpoint)));
  const floor = 1 / (1 + Math.exp(-steepness * (0 - midpoint)));
  const ceil = 1 / (1 + Math.exp(-steepness * (horizon - midpoint)));
  return (raw - floor) / Math.max(1e-6, ceil - floor);
}

function giLevel(score: number): string {
  if (score >= 0.75) return "Excellent";
  if (score >= 0.6) return "High";
  if (score >= 0.4) return "Medium";
  return "Low";
}

function siteAreaHectares(baseline: SimulationBaselineData): number {
  return Math.max(
    0.1,
    Number.isFinite(baseline.areaHectares ?? Number.NaN)
      ? (baseline.areaHectares as number)
      : DEFAULT_AREA_HA,
  );
}

/**
 * Tree canopy, in percentage points of the site, from planting
 * `treesPerHectare` on `treatedHa`. Crowns can't cover more than the treated
 * area itself.
 */
function treeCanopyGainPct(
  treatedHa: number,
  treesPerHectare: number,
  areaHa: number,
): number {
  if (areaHa <= 0 || treatedHa <= 0) return 0;
  const crownHa = Math.min(
    treatedHa,
    (treatedHa * Math.max(0, treesPerHectare) * MATURE_CROWN_AREA_M2) /
      SQM_PER_HECTARE,
  );
  return (crownHa / areaHa) * 100;
}

/**
 * Everything both the full run and the sensitivity probe need: the funded
 * target, footprint and GI drivers. One place, so the sensitivity analysis can
 * never drift from the headline numbers.
 */
type Scenario = {
  coeffs: CoefficientSet;
  areaHa: number;
  horizon: number;
  targetPct: number;
  realizedTargetPct: number;
  budgetBinding: boolean;
  treatedM2: number;
  treatedHa: number;
  climateDriftC: number;
  baselineNdvi: number;
  baselineGI: number;
};

/** Lifecycle cost of one treated m²: capital plus `horizon` years of maintenance. */
function lifecycleCostPerSqm(inputs: SimulationInputsState, horizon: number): number {
  const capitalPerSqm = Math.max(1, inputs.cost_per_sqm);
  return (
    capitalPerSqm *
    (1 + (Math.max(0, inputs.maintenance_cost_rate) / 100) * horizon)
  );
}

function scenarioCost(s: Scenario, inputs: SimulationInputsState) {
  return lifecycleTotals(
    s.treatedM2 * Math.max(1, inputs.cost_per_sqm),
    inputs.maintenance_cost_rate,
    s.horizon,
  );
}

/** Budget amounts are entered and snapped in ₱10k steps. */
const BUDGET_STEP_PHP = 10_000;

/**
 * What the plan costs over its horizon when nothing limits it: the budget
 * that fully funds `inputs` (rounded up to the next ₱10k). The dashboard
 * prices every strategy this way, so the Simulate modal starts here too.
 */
export function fullPlanBudgetPHP(
  inputs: SimulationInputsState,
  baseline: SimulationBaselineData,
): number {
  const unlimited = { ...inputs, total_budget_cap: Number.MAX_SAFE_INTEGER };
  const s = resolveScenario({ inputs: unlimited, baseline });
  // Round up from the unrounded cost so the budget can never fall a fraction
  // of a peso short and mark a fully funded plan as budget-bound.
  const total = s.treatedM2 * lifecycleCostPerSqm(unlimited, s.horizon);
  return Math.ceil(total / BUDGET_STEP_PHP) * BUDGET_STEP_PHP;
}

/**
 * Footprint the engine will fund for these inputs: treated area, trees and the
 * tree canopy they add, after the budget limit. The stepper's ambition caption
 * reads this so it quotes the same numbers the run will.
 */
export function estimateFootprint(input: EngineInput): {
  treatedHa: number;
  trees: number;
  canopyGainPct: number;
  budgetBinding: boolean;
  fundedSharePct: number;
} {
  const s = resolveScenario(input);
  return {
    treatedHa: s.treatedHa,
    trees: Math.round(s.treatedHa * s.coeffs.treesPerHectare.mid),
    canopyGainPct: treeCanopyGainPct(
      s.treatedHa,
      s.coeffs.treesPerHectare.mid,
      s.areaHa,
    ),
    budgetBinding: s.budgetBinding,
    fundedSharePct:
      s.targetPct > 0 ? Math.round((s.realizedTargetPct / s.targetPct) * 100) : 100,
  };
}

function resolveScenario({ inputs, baseline }: EngineInput): Scenario {
  const coeffs = getCoefficients(inputs.intervention_type);
  const areaHa = siteAreaHectares(baseline);
  const horizon = Math.max(1, Math.round(inputs.time_horizon));
  const targetPct = Math.max(0, inputs.canopy_target_percent);

  const areaM2 = areaHa * SQM_PER_HECTARE;
  const wantTreatedM2 =
    coeffs.treatedFractionPerCanopyPoint.mid * targetPct * areaM2;
  // The budget caps the whole programme (capital + maintenance over the
  // horizon), the same total the results show, not just the capital cost.
  const maxTreatedM2 =
    Math.max(0, inputs.total_budget_cap) / lifecycleCostPerSqm(inputs, horizon);
  const budgetBinding = wantTreatedM2 > maxTreatedM2 && wantTreatedM2 > 0;
  const scale = budgetBinding ? maxTreatedM2 / wantTreatedM2 : 1;

  const treatedM2 = wantTreatedM2 * scale;
  return {
    coeffs,
    areaHa,
    horizon,
    targetPct,
    realizedTargetPct: targetPct * scale,
    budgetBinding,
    treatedM2,
    treatedHa: treatedM2 / SQM_PER_HECTARE,
    climateDriftC: horizon * Math.max(0, inputs.temperature_increase_rate),
    baselineNdvi: Number.isFinite(baseline.ndvi) ? baseline.ndvi : 0.3,
    baselineGI: Number.isFinite(baseline.greeneryIndex)
      ? baseline.greeneryIndex
      : 0.45,
  };
}

function ndviGain(s: Scenario, tail: Tail): number {
  return (s.realizedTargetPct / 10) * pick(s.coeffs.ndviUpliftPer10pctCanopy, tail);
}

/**
 * GI sub-model at greening progress `ramp` (0..1) after `years` of climate
 * drift: 60% vegetation quantity (NDVI) + 40% environmental quality.
 */
function modelGI(
  s: Scenario,
  inputs: SimulationInputsState,
  ndviUplift: number,
  ramp: number,
  years: number,
): { gi: number; quantity: number; env: number } {
  const quantity = clamp01(s.baselineNdvi + ndviUplift * ramp);
  const env = clamp01(
    0.55 +
      s.realizedTargetPct * 0.008 * ramp -
      Math.max(0, inputs.temperature_increase_rate) * years * ENV_QUALITY_PENALTY_PER_C +
      (inputs.flooding_severity === "high" ? -0.05 : 0) +
      (inputs.intervention_type === "rain garden" ? 0.05 * ramp : 0),
  );
  return { gi: quantity * 0.6 + env * 0.4, quantity, env };
}

/**
 * Projected GI anchored to the barangay's measured GI: the model supplies the
 * *change* since year 0, so year 0 of the chart equals the baseline and the
 * final year equals the headline score.
 */
function anchoredGI(
  s: Scenario,
  inputs: SimulationInputsState,
  ndviUplift: number,
  ramp: number,
  years: number,
): number {
  const start = modelGI(s, inputs, ndviUplift, 0, 0).gi;
  const now = modelGI(s, inputs, ndviUplift, ramp, years).gi;
  return clamp01(s.baselineGI + (now - start));
}

function coolingDelta(s: Scenario, tail: Tail): number {
  return (s.realizedTargetPct / 10) * pick(s.coeffs.coolingPer10pctCanopy, tail);
}

function stormwaterLitersPerYear(
  s: Scenario,
  floodMult: number,
  tail: Tail,
): number {
  const perM2PerEvent = pick(s.coeffs.stormwaterRetentionPerM2Per10mm, tail);
  return s.treatedM2 * perM2PerEvent * EVENTS_PER_YEAR * floodMult;
}

function tailed(fn: (t: Tail) => number): TailedEstimate {
  return { low: fn("low"), mid: fn("mid"), high: fn("high") };
}

function signed(value: number, digits: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
}

export function runSimulationEngine(input: EngineInput): SimulationEstimates {
  const { inputs, baseline } = input;
  const s = resolveScenario(input);
  const { coeffs, horizon, treatedHa, treatedM2 } = s;

  const floodMult = floodMultiplier(
    inputs.flooding_severity,
    inputs.rainfall_change_rate,
  );

  const cooling = tailed((t) => coolingDelta(s, t));
  const ndvi = tailed((t) => ndviGain(s, t));
  const storm = tailed((t) => stormwaterLitersPerYear(s, floodMult, t));
  const pm25 = tailed((t) => pick(coeffs.pm25RemovalPerHaYear, t) * treatedHa);
  const no2 = tailed((t) => pick(coeffs.no2RemovalPerHaYear, t) * treatedHa);
  const co2 = tailed((t) => pick(coeffs.co2SequestrationPerHaYear, t) * treatedHa);
  const canopyGain = tailed((t) =>
    treeCanopyGainPct(treatedHa, pick(coeffs.treesPerHectare, t), s.areaHa),
  );

  const baselineLst = Number.isFinite(baseline.lst) ? baseline.lst : 32;
  const projectedLstMid = baselineLst + s.climateDriftC - cooling.mid;
  const projectedLstLow = baselineLst + s.climateDriftC - cooling.high; // best cooling → lowest LST
  const projectedLstHigh = baselineLst + s.climateDriftC - cooling.low;

  const baselineCanopyPct = canopyPercent(baseline.canopyCover);
  const canopyAt = (gain: number) => Math.min(95, baselineCanopyPct + gain);
  const projectedCanopyPct = canopyAt(canopyGain.mid);

  const giEvolution: GIEvolutionPoint[] = [];
  for (let y = 0; y <= horizon; y++) {
    const r = logisticRamp(y, horizon);
    const parts = modelGI(s, inputs, ndvi.mid, r, y);
    giEvolution.push({
      year: y,
      gi_score: Number(anchoredGI(s, inputs, ndvi.mid, r, y).toFixed(3)),
      quantity_score: Number(parts.quantity.toFixed(3)),
      environmental_quality_score: Number(parts.env.toFixed(3)),
    });
  }

  const finalGIScoreMid = anchoredGI(s, inputs, ndvi.mid, 1, horizon);
  const giProjected = Number(finalGIScoreMid.toFixed(3));
  const giLow = Number(anchoredGI(s, inputs, ndvi.low, 1, horizon).toFixed(3));
  const giHigh = Number(anchoredGI(s, inputs, ndvi.high, 1, horizon).toFixed(3));

  const trees = Math.round(treatedHa * coeffs.treesPerHectare.mid);
  const canopyNotes: string[] = [];
  canopyNotes.push(
    trees > 0
      ? `${trees.toLocaleString()} trees × ~${MATURE_CROWN_AREA_M2} m² crown on ${treatedHa.toFixed(2)} ha`
      : "This intervention plants no trees, so it adds no tree canopy",
  );
  if (s.budgetBinding) canopyNotes.push("constrained by budget");

  const lstNotes = [`Greening ${signed(-cooling.mid, 2)}°C`];
  if (s.climateDriftC > 0) lstNotes.push(`climate drift +${s.climateDriftC.toFixed(2)}°C`);

  const canopyDelta = Number((projectedCanopyPct - baselineCanopyPct).toFixed(1));

  const metrics: MetricEstimate[] = [
    {
      key: "lst",
      label: "Land Surface Temp",
      unit: "°C",
      baseline: Number(baselineLst.toFixed(2)),
      projected: Number(projectedLstMid.toFixed(2)),
      delta: Number((projectedLstMid - baselineLst).toFixed(2)),
      low: Number(projectedLstLow.toFixed(2)),
      high: Number(projectedLstHigh.toFixed(2)),
      direction: "down-good",
      note: lstNotes.join(" · "),
      noteTone: "info",
    },
    {
      key: "ndvi",
      label: "NDVI",
      unit: "",
      baseline: Number(s.baselineNdvi.toFixed(3)),
      projected: Number((s.baselineNdvi + ndvi.mid).toFixed(3)),
      delta: Number(ndvi.mid.toFixed(3)),
      low: Number((s.baselineNdvi + ndvi.low).toFixed(3)),
      high: Number((s.baselineNdvi + ndvi.high).toFixed(3)),
      direction: "up-good",
    },
    {
      key: "canopy",
      label: "Tree Canopy",
      unit: "%",
      baseline: Number(baselineCanopyPct.toFixed(1)),
      projected: Number(projectedCanopyPct.toFixed(1)),
      delta: canopyDelta,
      low: Number(canopyAt(canopyGain.low).toFixed(1)),
      high: Number(canopyAt(canopyGain.high).toFixed(1)),
      direction: "up-good",
      note: canopyNotes.join(" · "),
      noteTone: s.budgetBinding ? "warning" : "info",
    },
    {
      key: "gi",
      label: "Greenery Index",
      unit: "",
      baseline: Number(s.baselineGI.toFixed(3)),
      projected: giProjected,
      delta: Number((giProjected - s.baselineGI).toFixed(3)),
      low: giLow,
      high: giHigh,
      direction: "up-good",
    },
    {
      key: "stormwater",
      label: "Stormwater Retained",
      unit: "L/yr",
      baseline: 0,
      projected: Math.round(storm.mid),
      delta: Math.round(storm.mid),
      low: Math.round(storm.low),
      high: Math.round(storm.high),
      direction: "up-good",
    },
    {
      key: "pm25",
      label: "PM2.5 Removed",
      unit: "kg/yr",
      baseline: 0,
      projected: Number(pm25.mid.toFixed(1)),
      delta: Number(pm25.mid.toFixed(1)),
      low: Number(pm25.low.toFixed(1)),
      high: Number(pm25.high.toFixed(1)),
      direction: "up-good",
    },
    {
      key: "no2",
      label: "NO₂ Removed",
      unit: "kg/yr",
      baseline: 0,
      projected: Number(no2.mid.toFixed(1)),
      delta: Number(no2.mid.toFixed(1)),
      low: Number(no2.low.toFixed(1)),
      high: Number(no2.high.toFixed(1)),
      direction: "up-good",
    },
    {
      key: "co2",
      label: "CO₂ Sequestered",
      unit: "kg/yr",
      baseline: 0,
      projected: Math.round(co2.mid),
      delta: Math.round(co2.mid),
      low: Math.round(co2.low),
      high: Math.round(co2.high),
      direction: "up-good",
    },
  ];

  const { capitalCost: capex, maintenance, totalEstimate: totalPHP } =
    scenarioCost(s, inputs);

  const barangayTotals: AreaAggregate[] = [
    {
      key: "treatedArea",
      label: "Treated Area",
      value: Math.round(treatedM2),
      unit: "m²",
    },
    {
      key: "trees",
      label: "Estimated Trees Planted",
      value: trees,
      unit: "trees",
      note: `≈ ${coeffs.treesPerHectare.mid} trees/ha on ${treatedHa.toFixed(2)} ha`,
    },
    {
      key: "stormwaterTotal",
      label: "Stormwater Retained",
      value: Math.round(storm.mid),
      unit: "L/yr",
    },
    {
      key: "pm25Total",
      label: "PM2.5 Removed",
      value: Number(pm25.mid.toFixed(1)),
      unit: "kg/yr",
    },
    {
      key: "no2Total",
      label: "NO₂ Removed",
      value: Number(no2.mid.toFixed(1)),
      unit: "kg/yr",
    },
    {
      key: "co2Total",
      label: "CO₂ Sequestered",
      value: Math.round(co2.mid),
      unit: "kg/yr",
    },
    {
      key: "totalCost",
      label: "Total Programme Cost",
      value: totalPHP,
      unit: "PHP",
      note: `CAPEX ₱${capex.toLocaleString()} + ${horizon}-yr maintenance ₱${maintenance.toLocaleString()} (cost-estimate brief)`,
    },
  ];

  const warnings: string[] = [];
  if (s.budgetBinding) {
    const funded = Math.round((s.realizedTargetPct / Math.max(1e-6, s.targetPct)) * 100);
    warnings.push(
      `Budget funds about ${funded}% of the plan: a ${s.realizedTargetPct.toFixed(1)}% greening level instead of the ${s.targetPct}% target.`,
    );
  }
  const canopyPerYear = canopyGain.mid / horizon;
  if (canopyPerYear > 6) {
    warnings.push(
      `Tree canopy would grow ${canopyPerYear.toFixed(1)} points a year, which is aggressive; sustained urban planting rarely exceeds 5 points a year.`,
    );
  }
  if (
    inputs.intervention_type === "rain garden" &&
    inputs.flooding_severity === "low" &&
    inputs.rainfall_change_rate < 5
  ) {
    warnings.push(
      "Rain garden selected, but flood hazard is low — consider urban canopy or green corridor for stronger cooling co-benefits.",
    );
  }
  if (s.targetPct <= 0) {
    warnings.push("No greening target selected — results reflect climate drift only.");
  } else if (s.realizedTargetPct <= 0) {
    warnings.push("The budget is ₱0, so nothing is planted — results reflect climate drift only.");
  }

  return {
    metrics,
    giEvolution,
    finalGI: {
      gi_score: giProjected,
      gi_level: giLevel(finalGIScoreMid),
    },
    barangayTotals,
    costProjection: {
      capex,
      maintenance,
      totalPHP,
      budgetBinding: s.budgetBinding,
      budgetCapPHP: inputs.total_budget_cap,
      realizedTargetPercent: Number(s.realizedTargetPct.toFixed(2)),
      realizedCanopyPercent: canopyDelta,
    },
    effects: {
      coolingC: {
        low: Number(cooling.low.toFixed(2)),
        mid: Number(cooling.mid.toFixed(2)),
        high: Number(cooling.high.toFixed(2)),
      },
      climateDriftC: Number(s.climateDriftC.toFixed(2)),
    },
    sensitivity: computeSensitivity(input),
    warnings,
  };
}

/** Final GI only — what the sensitivity probe perturbs. Same math as the full run. */
function finalGIScore(input: EngineInput): number {
  const s = resolveScenario(input);
  return anchoredGI(s, input.inputs, ndviGain(s, "mid"), 1, s.horizon);
}

/** One-at-a-time perturbation: ±20% swing on each continuous input. */
function computeSensitivity(
  input: EngineInput,
): { input: keyof SimulationInputsState; contribution: number }[] {
  const KEYS: (keyof SimulationInputsState)[] = [
    "canopy_target_percent",
    "ndvi_target",
    "temperature_increase_rate",
    "rainfall_change_rate",
    "total_budget_cap",
    "cost_per_sqm",
    "time_horizon",
  ];
  const out: { input: keyof SimulationInputsState; contribution: number }[] = [];
  for (const key of KEYS) {
    const orig = input.inputs[key] as number;
    if (typeof orig !== "number" || !Number.isFinite(orig)) continue;
    const delta = orig === 0 ? 0.01 : orig * 0.2;
    const plus = { ...input.inputs, [key]: orig + delta } as SimulationInputsState;
    const minus = { ...input.inputs, [key]: Math.max(0, orig - delta) } as SimulationInputsState;
    const giPlus = finalGIScore({ inputs: plus, baseline: input.baseline });
    const giMinus = finalGIScore({ inputs: minus, baseline: input.baseline });
    const contribution = Math.abs(giPlus - giMinus) / 2;
    out.push({ input: key, contribution: Number(contribution.toFixed(4)) });
  }
  return out
    .sort((a, b) => b.contribution - a.contribution)
    .filter((r) => r.contribution > 0)
    .slice(0, 5);
}

/** Safe default intervention key for narrative layer / tests. */
export { DEFAULT_INTERVENTION, COEFFICIENTS, REPRESENTATIVE_EVENT_MM };
export type { CoefficientSet, InterventionType };
