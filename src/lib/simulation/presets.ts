/**
 * Presets that translate the simple, human-friendly stepper inputs
 * (`SimulationIntent`) into the full raw `SimulationInputsState` the engine
 * expects. The Advanced drawer bypasses this and edits the raw state
 * directly; selecting any raw field turns the matching simple control into
 * "Custom" in the UI.
 *
 * Cost per m² is looked up from the chosen intervention's literature-derived
 * coefficients (see `coefficients.ts`). Budget tiers only set the *budget
 * ceiling*; maintenance comes from the intervention too. They no longer prescribe a blended
 * PHP/m² that would distort small vs. expensive interventions.
 */
import type {
  AmbitionLevel,
  BudgetTier,
  ClimateFuture,
  SimulationBaselineData,
  SimulationInputsState,
  SimulationIntent,
  TimeHorizon,
} from "@/components/ui/simulation/simulation-types";
import { type InterventionType } from "./coefficients";
import { STRATEGY_COST_SPECS, basePricePerSqm } from "./cost-model";
import { fullPlanBudgetPHP } from "./engine";

/**
 * Largest budget the stepper accepts (PHP). A moderate plan on Mandaue's
 * biggest barangay tops out around ₱2.3B (vertical greening on Tipolo), so the
 * fully funded default always fits.
 */
export const MAX_BUDGET_PHP = 5_000_000_000;

export type ClimatePreset = {
  id: ClimateFuture;
  label: string;
  description: string;
  temperatureIncreaseRate: number;
  rainfallChangeRate: number;
  floodingSeverity: SimulationInputsState["flooding_severity"];
};

export const CLIMATE_PRESETS: Record<ClimateFuture, ClimatePreset> = {
  stable: {
    id: "stable",
    label: "Stable",
    description:
      "Gentle warming, little change in rainfall. A best-case 'if we act now' trajectory.",
    temperatureIncreaseRate: 0.02,
    rainfallChangeRate: 0,
    floodingSeverity: "low",
  },
  warming: {
    id: "warming",
    label: "Warming",
    description:
      "Middle-of-the-road scenario: temperatures and rainfall both climb steadily.",
    temperatureIncreaseRate: 0.04,
    rainfallChangeRate: 10,
    floodingSeverity: "medium",
  },
  severe: {
    id: "severe",
    label: "Severe",
    description:
      "Worst-case climate forcing with heavy rainfall and higher flood risk.",
    temperatureIncreaseRate: 0.08,
    rainfallChangeRate: 20,
    floodingSeverity: "high",
  },
};

export type AmbitionPreset = {
  id: AmbitionLevel;
  label: string;
  caption: string;
  canopyTargetPercent: number;
  ndviTarget: number;
};

export const AMBITION_PRESETS: Record<AmbitionLevel, AmbitionPreset> = {
  light: {
    id: "light",
    label: "Light touch",
    caption: "Stewardship plus a few new plantings.",
    canopyTargetPercent: 5,
    ndviTarget: 0.05,
  },
  moderate: {
    id: "moderate",
    label: "Moderate",
    caption: "Noticeable greening without reshaping the neighbourhood.",
    canopyTargetPercent: 15,
    ndviTarget: 0.1,
  },
  ambitious: {
    id: "ambitious",
    label: "Ambitious",
    caption: "Street-wide canopy and multi-parcel interventions.",
    canopyTargetPercent: 25,
    ndviTarget: 0.18,
  },
  transformative: {
    id: "transformative",
    label: "Transformative",
    caption: "Neighbourhood-scale redesign; the upper limit of what's feasible.",
    canopyTargetPercent: 40,
    ndviTarget: 0.3,
  },
};

export type BudgetPreset = {
  id: BudgetTier;
  label: string;
  budgetPHP: number;
  /**
   * @deprecated kept for backward-compatible display only; the engine now
   * reads cost_per_sqm from the intervention's coefficients. Use
   * `resolveBudgetTier(...).costPerSqm` only for UI chrome.
   */
  costPerSqm: number;
};

export const BUDGET_PRESETS: Record<Exclude<BudgetTier, "custom">, BudgetPreset> = {
  small: {
    id: "small",
    label: "Small (₱1M)",
    budgetPHP: 1_000_000,
    costPerSqm: 35,
  },
  medium: {
    id: "medium",
    label: "Medium (₱5M)",
    budgetPHP: 5_000_000,
    costPerSqm: 90,
  },
  large: {
    id: "large",
    label: "Large (₱10M)",
    budgetPHP: 10_000_000,
    costPerSqm: 180,
  },
};

export const STRATEGY_LABELS: Record<
  InterventionType,
  { label: string; tagline: string; badges: string[] }
> = {
  "urban canopy": {
    label: "Urban Canopy",
    tagline: "Street trees and infill planting for shade and air quality.",
    badges: ["heat", "air"],
  },
  "targeted infill": {
    label: "Targeted Infill",
    tagline: "Gap-focused trees where shade, access, or corridor continuity is missing.",
    badges: ["shade gaps", "equity"],
  },
  "understory shrubs": {
    label: "Understory & Shrubs",
    tagline: "Lower-layer planting that adds biodiversity under existing canopy.",
    badges: ["biodiversity", "high canopy"],
  },
  "green roof": {
    label: "Green Roof",
    tagline: "Rooftop vegetation for dense sites with limited ground space.",
    badges: ["tight ground", "stormwater"],
  },
  "vertical greening": {
    label: "Vertical Greening",
    tagline: "Green walls, facades, and balcony planting for built-up areas.",
    badges: ["tight ground", "heat"],
  },
  "green corridor": {
    label: "Green Corridor",
    tagline: "Continuous linear greening along waterways and roads.",
    badges: ["heat", "flooding", "connectivity"],
  },
  "pocket park": {
    label: "Pocket Park",
    tagline: "Small parks, parklets, courtyards, and community gardens.",
    badges: ["local access", "green deficit"],
  },
  "rain garden": {
    label: "Rain Garden",
    tagline: "Bioswales and permeable plots to absorb stormwater at source.",
    badges: ["flooding"],
  },
  "permeable surface": {
    label: "Permeable Surface",
    tagline: "Depaving, porous pavement, and cool surfaces for runoff control.",
    badges: ["flooding", "built-up"],
  },
  "riparian buffer": {
    label: "Riparian Buffer",
    tagline: "Vegetated buffers for waterways, drainage edges, and coastal exposure.",
    badges: ["flooding", "storm"],
  },
  "wetland restoration": {
    label: "Wetland Restoration",
    tagline: "Mangrove and freshwater wetland restoration for coastal defence and biodiversity.",
    badges: ["flooding", "storm", "biodiversity"],
  },
};

export const STRATEGY_IDS: InterventionType[] = [
  "urban canopy",
  "targeted infill",
  "understory shrubs",
  "green roof",
  "vertical greening",
  "green corridor",
  "pocket park",
  "rain garden",
  "permeable surface",
  "riparian buffer",
  "wetland restoration",
];

/** Pick the climate preset that best matches the barangay's baseline flood signal. */
export function defaultClimateFromBaseline(
  baseline: Pick<SimulationBaselineData, "floodExposure">,
): ClimateFuture {
  const level = (baseline.floodExposure ?? "").toLowerCase();
  if (level.includes("high") || level.includes("very")) return "severe";
  if (level.includes("medium") || level.includes("mod")) return "warming";
  return "warming"; // reasonable default; user can drop to 'stable'
}

type StrategyBaseline = {
  lst?: number;
  floodExposure?: string;
  /** Either percent (0–100) or fraction (0–1); `treeCanopy` aliased for callers using BarangayData. */
  canopyCover?: number;
  treeCanopy?: number;
};

function resolveCanopy(b: StrategyBaseline): number {
  const raw = b.canopyCover ?? b.treeCanopy ?? 0;
  return raw > 1 ? raw : raw * 100;
}

/**
 * Pick the strategy with the best fit given baseline signals.
 *
 * With mixed-strategy removed, the tiebreak for "hot AND floody" is
 * green corridor — it delivers shade, stormwater and connectivity at once,
 * which is the closest single-option analogue to a blended programme.
 */
export function suggestStrategy(b: StrategyBaseline): InterventionType {
  const flood = (b.floodExposure ?? "").toLowerCase();
  const isFloody = flood.includes("high") || flood.includes("very");
  const isHot = (b.lst ?? 0) >= 33;
  const canopyPct = resolveCanopy(b);
  const isBare = canopyPct < 18;

  if (isFloody && isHot) return "green corridor";
  if (isFloody) return "rain garden";
  if (isHot && isBare) return "urban canopy";
  if (isHot && canopyPct >= 45) return "vertical greening";
  if (isHot) return "green corridor";
  if (canopyPct >= 45) return "understory shrubs";
  if (isBare) return "urban canopy";
  return "green corridor";
}

/** Reasons the given strategy card should be greyed out for this baseline. */
export function strategyMismatchReason(
  strategy: InterventionType,
  b: StrategyBaseline,
): string | null {
  const flood = (b.floodExposure ?? "").toLowerCase();
  const isFloody = flood.includes("high") || flood.includes("very");
  const isHot = (b.lst ?? 0) >= 33;
  const canopyPct = resolveCanopy(b);

  if (strategy === "rain garden" && !isFloody) {
    return "Flood hazard is low here — rain gardens underperform their potential.";
  }
  if (strategy === "urban canopy" && canopyPct >= 45) {
    return "Canopy is already high; broad new plantings add less marginal value.";
  }
  if (
    (strategy === "green roof" || strategy === "vertical greening") &&
    !isHot &&
    canopyPct < 35
  ) {
    return "Ground greening may be more direct here unless space is constrained.";
  }
  if (strategy === "understory shrubs" && canopyPct < 35) {
    return "Existing canopy is limited; canopy-building options may matter more first.";
  }
  if (strategy === "permeable surface" && !isFloody && !isHot) {
    return "Runoff and heat signals are low; vegetated strategies may add more greenery.";
  }
  if (strategy === "riparian buffer" && !isFloody) {
    return "Most useful near waterways, drainage corridors, or high flood exposure.";
  }
  if (strategy === "green corridor" && !isHot && !isFloody) {
    return "Heat and flood signals are low; a lighter-touch strategy may fit better.";
  }
  return null;
}

export function resolveBudgetTier(
  tier: BudgetTier,
  custom?: number,
): BudgetPreset {
  if (tier === "custom") {
    const value = Math.max(100_000, custom ?? 5_000_000);
    return {
      id: "custom",
      label: `Custom (₱${value.toLocaleString()})`,
      budgetPHP: value,
      costPerSqm: 90,
    };
  }
  return BUDGET_PRESETS[tier];
}

/**
 * Look up the evidence-based per-m² cost for an intervention, derived from
 * the cost-estimation research brief (`cost-model.ts` is the source of
 * truth). This is the number the engine should use for CAPEX; budget tiers
 * only cap total spend.
 */
export function interventionCostPerSqm(strategy: InterventionType): number {
  return basePricePerSqm(strategy);
}

/**
 * Annual maintenance (% of CAPEX) for an intervention, from the cost model. The
 * cost card and dashboard use the same rate, so a default simulation prices the
 * same lifecycle total they show.
 */
export function interventionMaintenanceRatePct(strategy: InterventionType): number {
  return STRATEGY_COST_SPECS[strategy]?.maintenanceRatePct ?? 5;
}

/** Map the simple intent onto the full raw engine inputs. */
export function resolveIntent(
  intent: SimulationIntent,
  baseline?: Pick<SimulationBaselineData, "floodExposure">,
): SimulationInputsState {
  const climate = CLIMATE_PRESETS[intent.climateFuture];
  const ambition = AMBITION_PRESETS[intent.ambition];
  const budget = resolveBudgetTier(intent.budgetTier, intent.customBudgetPHP);
  const costPerSqm = interventionCostPerSqm(intent.strategy);

  let flood = climate.floodingSeverity;
  if (baseline && intent.climateFuture !== "severe") {
    const base = (baseline.floodExposure ?? "").toLowerCase();
    if (base.includes("high")) flood = "high";
  }

  return {
    temperature_increase_rate: climate.temperatureIncreaseRate,
    rainfall_change_rate: climate.rainfallChangeRate,
    flooding_severity: flood,
    canopy_target_percent: ambition.canopyTargetPercent,
    ndvi_target: ambition.ndviTarget,
    intervention_type: intent.strategy,
    total_budget_cap: budget.budgetPHP,
    cost_per_sqm: costPerSqm,
    maintenance_cost_rate: interventionMaintenanceRatePct(intent.strategy),
    time_horizon: intent.timeHorizon,
  };
}

/**
 * Set the budget to the full cost of the plan `intent` describes (with any
 * Advanced-drawer overrides applied), so nothing is scaled back. Marks the
 * budget as following the plan until the user picks one.
 */
export function withFullFunding(
  intent: SimulationIntent,
  baseline: SimulationBaselineData,
  overrides: Partial<SimulationInputsState> = {},
): SimulationIntent {
  const inputs = { ...resolveIntent(intent, baseline), ...overrides };
  const budget = Math.min(MAX_BUDGET_PHP, fullPlanBudgetPHP(inputs, baseline));
  return {
    ...intent,
    budgetTier: "custom",
    customBudgetPHP: budget,
    budgetFollowsPlan: true,
  };
}

/**
 * The plan the Simulate modal opens with for `strategy`, and the one the
 * dashboard prices for every row: moderate ambition over 5 years, climate from
 * the baseline, fully funded. One function, so the row and the modal it opens
 * can't drift apart.
 */
export function defaultSimulationIntent(
  baseline: SimulationBaselineData,
  strategy: InterventionType,
): SimulationIntent {
  return withFullFunding(
    {
      climateFuture: defaultClimateFromBaseline(baseline),
      strategy,
      ambition: "moderate",
      budgetTier: "medium",
      timeHorizon: 5,
    },
    baseline,
  );
}

/**
 * Apply a stepper change. Until the user sets a budget, the budget follows the
 * full cost of the plan; once they set one (tier button, slider or amount), it
 * stays where they put it.
 */
export function applyIntentChange(
  prev: SimulationIntent,
  partial: Partial<SimulationIntent>,
  baseline: SimulationBaselineData,
  overrides: Partial<SimulationInputsState> = {},
): SimulationIntent {
  const setsBudget = "budgetTier" in partial || "customBudgetPHP" in partial;
  const next = { ...prev, ...partial };
  if (setsBudget) return { ...next, budgetFollowsPlan: false };
  return next.budgetFollowsPlan ? withFullFunding(next, baseline, overrides) : next;
}

/** Best-effort inverse: infer the closest simple intent from raw inputs. Used when the Advanced drawer edits a field. */
export function intentFromInputs(
  inputs: SimulationInputsState,
): SimulationIntent {
  const climateFuture: ClimateFuture =
    inputs.temperature_increase_rate >= 0.07 ||
    inputs.flooding_severity === "high"
      ? "severe"
      : inputs.temperature_increase_rate >= 0.03 || inputs.rainfall_change_rate >= 8
        ? "warming"
        : "stable";

  const ambition: AmbitionLevel =
    inputs.canopy_target_percent >= 35
      ? "transformative"
      : inputs.canopy_target_percent >= 20
        ? "ambitious"
        : inputs.canopy_target_percent >= 10
          ? "moderate"
          : "light";

  let budgetTier: BudgetTier = "custom";
  let customBudgetPHP: number | undefined = inputs.total_budget_cap;
  if (inputs.total_budget_cap === BUDGET_PRESETS.small.budgetPHP) {
    budgetTier = "small";
    customBudgetPHP = undefined;
  } else if (inputs.total_budget_cap === BUDGET_PRESETS.medium.budgetPHP) {
    budgetTier = "medium";
    customBudgetPHP = undefined;
  } else if (inputs.total_budget_cap === BUDGET_PRESETS.large.budgetPHP) {
    budgetTier = "large";
    customBudgetPHP = undefined;
  }

  const timeHorizon: TimeHorizon = Math.max(
    1,
    Math.min(25, Math.round(Number(inputs.time_horizon) || 5)),
  );

  const strategyKey = inputs.intervention_type as InterventionType;
  const strategy: InterventionType = STRATEGY_IDS.includes(strategyKey)
    ? strategyKey
    : "urban canopy";

  return {
    climateFuture,
    strategy,
    ambition,
    budgetTier,
    customBudgetPHP,
    timeHorizon,
  };
}
