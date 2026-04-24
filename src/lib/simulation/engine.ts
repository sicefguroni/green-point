/**
 * Deterministic greening-simulation engine.
 *
 * Consumes raw `SimulationInputsState` + barangay baseline + `areaHectares` and
 * returns `SimulationEstimates`. All math is pure; no I/O, no OpenAI, no DB.
 * The API route layers RAG + LLM narrative on top of the values this function
 * produces. The client can also call this directly for the live-preview
 * footer in the stepper.
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
  MetricKey,
  GIEvolutionPoint,
  AreaAggregate,
} from "@/components/ui/simulation/simulation-types";
import {
  COEFFICIENTS,
  DEFAULT_INTERVENTION,
  EVENTS_PER_YEAR,
  REPRESENTATIVE_EVENT_MM,
  floodMultiplier,
  getCoefficients,
  type CoefficientSet,
  type InterventionType,
  type Range,
} from "./coefficients";

const SQM_PER_HECTARE = 10_000;

export type EngineInput = {
  inputs: SimulationInputsState;
  baseline: SimulationBaselineData;
};

type Tail = "low" | "mid" | "high";

function pick(range: Range, tail: Tail): number {
  return range[tail];
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

/** Clamp canopy target to what the budget can physically treat, and return the realized percent. */
function resolveCanopyPercent(
  inputs: SimulationInputsState,
  coeffs: CoefficientSet,
  areaHectares: number,
): { realized: number; budgetBinding: boolean; maxTreatedM2: number } {
  const targetPct = Math.max(0, inputs.canopy_target_percent);
  const areaM2 = areaHectares * SQM_PER_HECTARE;
  const treatedFraction = coeffs.treatedFractionPerCanopyPoint.mid * targetPct;
  const wantTreatedM2 = treatedFraction * areaM2;
  const costPerSqm = Math.max(1, inputs.cost_per_sqm);
  const maxTreatedM2 = inputs.total_budget_cap / costPerSqm;

  if (wantTreatedM2 <= maxTreatedM2 || wantTreatedM2 === 0) {
    return { realized: targetPct, budgetBinding: false, maxTreatedM2: wantTreatedM2 };
  }
  const scale = maxTreatedM2 / wantTreatedM2;
  return {
    realized: targetPct * scale,
    budgetBinding: true,
    maxTreatedM2,
  };
}

type TailedEstimate = { low: number; mid: number; high: number };

function tailed(
  fn: (c: CoefficientSet, t: Tail) => number,
  coeffs: CoefficientSet,
): TailedEstimate {
  return {
    low: fn(coeffs, "low"),
    mid: fn(coeffs, "mid"),
    high: fn(coeffs, "high"),
  };
}

function coolingDelta(
  coeffs: CoefficientSet,
  canopyGainPct: number,
  tail: Tail,
): number {
  return (canopyGainPct / 10) * pick(coeffs.coolingPer10pctCanopy, tail);
}

function ndviUplift(
  coeffs: CoefficientSet,
  canopyGainPct: number,
  tail: Tail,
): number {
  return (canopyGainPct / 10) * pick(coeffs.ndviUpliftPer10pctCanopy, tail);
}

function stormwaterLitersPerYear(
  coeffs: CoefficientSet,
  treatedM2: number,
  floodMult: number,
  tail: Tail,
): number {
  const perM2PerEvent = pick(coeffs.stormwaterRetentionPerM2Per10mm, tail);
  return treatedM2 * perM2PerEvent * EVENTS_PER_YEAR * floodMult;
}

function annualPerHa(
  range: Range,
  treatedHa: number,
  tail: Tail,
): number {
  return pick(range, tail) * treatedHa;
}

/** Net Present Value of recurring annual maintenance as % of CAPEX. */
function maintenanceNPV(
  capex: number,
  annualRatePct: number,
  horizonYears: number,
  discount: number,
): number {
  const annual = (annualRatePct / 100) * capex;
  let npv = 0;
  for (let y = 1; y <= horizonYears; y++) {
    npv += annual / Math.pow(1 + discount, y);
  }
  return npv;
}

export function runSimulationEngine({
  inputs,
  baseline,
}: EngineInput): SimulationEstimates {
  const coeffs = getCoefficients(inputs.intervention_type);
  const areaHa = Math.max(
    0.1,
    Number.isFinite(baseline.areaHectares ?? NaN)
      ? (baseline.areaHectares as number)
      : 30,
  );
  const horizon = Math.max(1, Math.round(inputs.time_horizon));

  const { realized: realizedCanopyPct, budgetBinding, maxTreatedM2 } =
    resolveCanopyPercent(inputs, coeffs, areaHa);

  const baselineCanopyPct = canopyPercent(baseline.canopyCover);
  const projectedCanopyPct = Math.min(95, baselineCanopyPct + realizedCanopyPct);

  const floodMult = floodMultiplier(
    inputs.flooding_severity,
    inputs.rainfall_change_rate,
  );
  const treatedM2 =
    coeffs.treatedFractionPerCanopyPoint.mid *
    realizedCanopyPct *
    areaHa *
    SQM_PER_HECTARE;
  const treatedHa = treatedM2 / SQM_PER_HECTARE;

  // Climate drift: net LST = baseline + years*drift - cooling
  const yearsForClimate = horizon;
  const climateDrift =
    yearsForClimate * Math.max(0, inputs.temperature_increase_rate);

  const cooling = tailed(
    (c, t) => coolingDelta(c, realizedCanopyPct, t),
    coeffs,
  );
  const ndvi = tailed(
    (c, t) => ndviUplift(c, realizedCanopyPct, t),
    coeffs,
  );
  const storm = tailed(
    (c, t) => stormwaterLitersPerYear(c, treatedM2, floodMult, t),
    coeffs,
  );
  const pm25 = tailed((c, t) => annualPerHa(c.pm25RemovalPerHaYear, treatedHa, t), coeffs);
  const no2 = tailed((c, t) => annualPerHa(c.no2RemovalPerHaYear, treatedHa, t), coeffs);
  const co2 = tailed((c, t) => annualPerHa(c.co2SequestrationPerHaYear, treatedHa, t), coeffs);

  const baselineLst = Number.isFinite(baseline.lst) ? baseline.lst : 32;
  const baselineNdvi = Number.isFinite(baseline.ndvi) ? baseline.ndvi : 0.3;
  const baselineGI = Number.isFinite(baseline.greeneryIndex)
    ? baseline.greeneryIndex
    : 0.45;

  const projectedLstMid = baselineLst + climateDrift - cooling.mid;
  const projectedLstLow = baselineLst + climateDrift - cooling.high; // best cooling → lowest LST
  const projectedLstHigh = baselineLst + climateDrift - cooling.low;

  const projectedNdviMid = baselineNdvi + ndvi.mid;

  // Aggregate final GI using a simple quantity + env-quality split.
  const finalQuantity = Math.min(1, baselineNdvi + ndvi.mid);
  const finalEnvQuality = Math.max(
    0,
    Math.min(
      1,
      0.55 +
        realizedCanopyPct * 0.008 -
        climateDrift * 0.04 +
        (inputs.flooding_severity === "high" ? -0.05 : 0) +
        (inputs.intervention_type === "rain garden" ? 0.05 : 0),
    ),
  );
  const finalGIScoreMid = finalQuantity * 0.6 + finalEnvQuality * 0.4;

  const giEvolution: GIEvolutionPoint[] = [];
  for (let y = 0; y <= horizon; y++) {
    const r = logisticRamp(y, horizon);
    const yNdvi = baselineNdvi + ndvi.mid * r;
    const envQuality = Math.max(
      0,
      Math.min(
        1,
        0.55 +
          realizedCanopyPct * 0.008 * r -
          Math.max(0, inputs.temperature_increase_rate) * y * 0.5 +
          (inputs.flooding_severity === "high" ? -0.05 : 0) +
          (inputs.intervention_type === "rain garden" ? 0.05 * r : 0),
      ),
    );
    const gi = yNdvi * 0.6 + envQuality * 0.4;
    giEvolution.push({
      year: y,
      gi_score: Number(gi.toFixed(3)),
      quantity_score: Number(yNdvi.toFixed(3)),
      environmental_quality_score: Number(envQuality.toFixed(3)),
    });
  }

  const giProjected = Number(finalGIScoreMid.toFixed(3));
  const giLow = Number(
    ((baselineNdvi + ndvi.low) * 0.6 + finalEnvQuality * 0.4).toFixed(3),
  );
  const giHigh = Number(
    ((baselineNdvi + ndvi.high) * 0.6 + finalEnvQuality * 0.4).toFixed(3),
  );

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
      note: climateDrift > 0 ? `Includes +${climateDrift.toFixed(2)}°C climate drift` : undefined,
    },
    {
      key: "ndvi",
      label: "NDVI",
      unit: "",
      baseline: Number(baselineNdvi.toFixed(3)),
      projected: Number(projectedNdviMid.toFixed(3)),
      delta: Number(ndvi.mid.toFixed(3)),
      low: Number((baselineNdvi + ndvi.low).toFixed(3)),
      high: Number((baselineNdvi + ndvi.high).toFixed(3)),
      direction: "up-good",
    },
    {
      key: "canopy",
      label: "Tree Canopy",
      unit: "%",
      baseline: Number(baselineCanopyPct.toFixed(1)),
      projected: Number(projectedCanopyPct.toFixed(1)),
      delta: Number(realizedCanopyPct.toFixed(1)),
      low: Number((baselineCanopyPct + realizedCanopyPct * 0.85).toFixed(1)),
      high: Number((baselineCanopyPct + realizedCanopyPct * 1.1).toFixed(1)),
      direction: "up-good",
      note: budgetBinding ? "Constrained by budget" : undefined,
    },
    {
      key: "gi",
      label: "Greenery Index",
      unit: "",
      baseline: Number(baselineGI.toFixed(3)),
      projected: giProjected,
      delta: Number((giProjected - baselineGI).toFixed(3)),
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

  const capex = Math.round(treatedM2 * Math.max(1, inputs.cost_per_sqm));
  const maintenance = Math.round(
    maintenanceNPV(
      capex,
      Math.max(0, inputs.maintenance_cost_rate),
      horizon,
      coeffs.maintenanceDiscountRate,
    ),
  );
  const totalPHP = capex + maintenance;

  const trees = Math.round(treatedHa * coeffs.treesPerHectare.mid);

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
      note: `CAPEX ₱${capex.toLocaleString()} + NPV maintenance ₱${maintenance.toLocaleString()}`,
    },
  ];

  const warnings: string[] = [];
  if (budgetBinding) {
    const pct = Math.round((maxTreatedM2 / Math.max(1, treatedM2 / (realizedCanopyPct / Math.max(1, inputs.canopy_target_percent))) ) * 100);
    warnings.push(
      `Budget caps the canopy gain at about ${realizedCanopyPct.toFixed(1)}% of the ${inputs.canopy_target_percent}% target (≈${pct}% realized).`,
    );
  }
  if (inputs.canopy_target_percent / horizon > 6) {
    warnings.push(
      `Targeted canopy expansion rate (${(inputs.canopy_target_percent / horizon).toFixed(1)}%/yr) is aggressive; typical sustained planting rates rarely exceed 5%/yr.`,
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
  if (realizedCanopyPct <= 0) {
    warnings.push("No canopy gain selected — results reflect climate drift only.");
  }

  const sensitivity = computeSensitivity({ inputs, baseline }, finalGIScoreMid);

  return {
    metrics,
    giEvolution,
    finalGI: {
      gi_score: Number(finalGIScoreMid.toFixed(3)),
      gi_level: giLevel(finalGIScoreMid),
    },
    barangayTotals,
    costProjection: {
      capex,
      maintenanceNPV: maintenance,
      totalPHP,
      budgetBinding,
      budgetCapPHP: inputs.total_budget_cap,
      realizedCanopyPercent: Number(realizedCanopyPct.toFixed(2)),
    },
    sensitivity,
    warnings,
  };
}

/** One-at-a-time perturbation: ±20% swing on each continuous input. */
function computeSensitivity(
  input: EngineInput,
  baselineFinalGI: number,
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
    const giPlus = runSimulationEngineFinalGIOnly({ inputs: plus, baseline: input.baseline });
    const giMinus = runSimulationEngineFinalGIOnly({ inputs: minus, baseline: input.baseline });
    const contribution = Math.abs(giPlus - giMinus) / 2;
    out.push({ input: key, contribution: Number(contribution.toFixed(4)) });
  }
  return out
    .sort((a, b) => b.contribution - a.contribution)
    .filter((r) => r.contribution > 0)
    .slice(0, 5);
}

/** Cheaper variant used inside sensitivity; same math, returns only the final GI scalar. */
function runSimulationEngineFinalGIOnly(input: EngineInput): number {
  const coeffs = getCoefficients(input.inputs.intervention_type);
  const areaHa = Math.max(
    0.1,
    Number.isFinite(input.baseline.areaHectares ?? NaN)
      ? (input.baseline.areaHectares as number)
      : 30,
  );
  const { realized } = resolveCanopyPercent(input.inputs, coeffs, areaHa);
  const baselineNdvi = Number.isFinite(input.baseline.ndvi) ? input.baseline.ndvi : 0.3;
  const ndviGain = (realized / 10) * coeffs.ndviUpliftPer10pctCanopy.mid;
  const climateDrift =
    input.inputs.time_horizon * Math.max(0, input.inputs.temperature_increase_rate);
  const envQuality = Math.max(
    0,
    Math.min(
      1,
      0.55 +
        realized * 0.008 -
        climateDrift * 0.04 +
        (input.inputs.flooding_severity === "high" ? -0.05 : 0) +
        (input.inputs.intervention_type === "rain garden" ? 0.05 : 0),
    ),
  );
  return (baselineNdvi + ndviGain) * 0.6 + envQuality * 0.4;
}

/** Safe default intervention key for narrative layer / tests. */
export { DEFAULT_INTERVENTION, COEFFICIENTS, REPRESENTATIVE_EVENT_MM };
export type { CoefficientSet, InterventionType };
