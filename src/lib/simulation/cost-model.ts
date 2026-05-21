/**
 * Shared cost model for greening interventions.
 *
 * Single source of truth for "how much does this intervention cost" used by
 *   - `/api/cost-estimate` (cost card rendered on the map tab)
 *   - `InterventionAnalysisTable` (the dashboard ranking)
 *   - The simulation engine's CAPEX computation, via
 *     `interventionCostPerSqm()` in `presets.ts`.
 *
 * Pricing is lifecycle-based — capital + maintenance over a horizon, with an
 * optional location multiplier for known higher-/lower-cost LGUs. The base
 * prices come from the GreenPoint cost-estimation research brief
 * ("Research Brief: Cost and Carbon Stock Estimation for GreenPoint")
 * and are expressed in their natural unit (per tree, per m², per linear
 * metre, per hectare, per installation) rather than always per-m². This way
 * the cost card can report the brief's actual unit, and the engine can still
 * derive an effective per-m² rate via the planning density (`unitsPerSqm`).
 *
 * Base prices (mandaue-specific planning estimates, 2025):
 *   - Urban canopy enhancement   : 1,200 PHP / tree
 *   - Rain garden installation   : 3,500 PHP / installation (~25 m² cell)
 *   - Riparian buffer            : 2,000 PHP / linear m
 *   - Active Greenway / corridor : 12,000 PHP / linear m
 *   - Rooftop garden / green roof: 3,500 PHP / m²
 *   - Permeable pavement         : 2,800 PHP / m²
 *   - Green wall                 : 9,000 PHP / m²
 *   - Wetland restoration        : 75,000 PHP / hectare
 *   - Fallback project estimate  : 10,000 PHP / project
 *
 * Lifecycle formula:
 *   capitalCost          = basePrice × Q
 *   maintenanceSubtotal  = capitalCost × maintenanceRate × lifecycleYears
 *   totalEstimate        = round((capitalCost + maintenanceSubtotal) × locationMultiplier)
 *   materials            = round(capitalCost × materialsShare × locationMultiplier)
 *   labor                = round(capitalCost × laborShare × locationMultiplier)
 *   maintenance          = round(maintenanceSubtotal × locationMultiplier)
 *   contingency          = totalEstimate − (materials + labor + maintenance)
 *
 * Note: pricing values are still planning assumptions. Final figures need
 * local calibration with Mandaue / Cebu vendor and procurement data.
 */
import { COEFFICIENTS, type InterventionType } from "./coefficients";

export type CostUnit =
  | "tree"
  | "sqm"
  | "linear-m"
  | "hectare"
  | "installation";

export type CostEstimate = {
  interventionType: string;
  /** Canonical strategy key this intervention was normalised to. */
  strategyKey: InterventionType;
  /** Native pricing unit per the research brief. */
  unit: CostUnit;
  /** Base unit cost in `unit`s, in PHP, before location adjustments. */
  basePrice: number;
  /** Human-readable description of the unit basis (used by the cost card). */
  perUnit: string;
  currencyUnit: "PHP";
  /** Site area supplied for the estimate, in m² (null when not provided). */
  area: number | null;
  /** Quantity of `unit`s billed (e.g. 600 trees, 25 m², 1 ha). */
  quantity: number;
  /**
   * Effective per-m² rate (basePrice × unitsPerSqm) used by the simulation
   * engine for budget-binding math. Lets us keep the engine on a single
   * area-based axis even when the brief prices in trees / installations.
   */
  effectivePricePerSqm: number;
  locationMultiplier: number;
  /** Years of maintenance included in `breakdown.maintenance`. */
  lifecycleYears: number;
  /** CAPEX (capital cost) in PHP, after location adjustment, rounded. */
  capitalCost: number;
  /** Capital + lifecycle maintenance, after location adjustment. */
  totalEstimate: number;
  breakdown: {
    materials: number;
    labor: number;
    maintenance: number;
    contingency: number;
  };
};

export type EstimateOptions = {
  /** Override the strategy's default lifecycle horizon (years). */
  lifecycleYears?: number;
};

/**
 * Map any free-form intervention name (LLM output, table hardcoded,
 * user-supplied) onto one of the canonical strategy keys. The order of the
 * matchers matters — more specific patterns must run before broader ones so,
 * e.g. "permeable surface" resolves to its own cost line rather than being
 * pulled into the generic stormwater bucket.
 */
export function resolveStrategyKey(
  interventionType: string | null | undefined,
): InterventionType {
  const s = (interventionType ?? "").toLowerCase();

  const matchers: Array<[InterventionType, RegExp]> = [
    ["wetland restoration", /(wetland restoration|wetland|mangrove|swamp)/],
    ["riparian buffer", /(riparian|coastal buffer|surge buffer)/],
    ["permeable surface", /(permeable|porous pavement|depave|cool pavement)/],
    [
      "rain garden",
      /(rain ?garden|bioswale|bioretention|stormwater|sponge|retention pond)/,
    ],
    ["green roof", /(green ?roof|roof ?top garden|rooftop greening)/],
    ["vertical greening", /(vertical green|green wall|living wall|fa[cç]ade greening)/],
    ["pocket park", /(pocket park|parklet|community garden|plaza greening)/],
    ["understory shrubs", /(understory|shrub|hedge|ground ?cover|herbaceous)/],
    [
      "green corridor",
      /(corridor|boulevard|linear green|greenway|blue-?green|waterway|verge|parkway|street[- ]scape)/,
    ],
    [
      "targeted infill",
      /(infill|gap planting|targeted plant|spot planting|equity planting)/,
    ],
    [
      "urban canopy",
      /(canopy|street ?tree|tree ?planting|grove|shade|envelope|urban forest|reforest)/,
    ],
  ];

  for (const [key, rx] of matchers) {
    if (rx.test(s)) return key;
  }
  return "urban canopy"; // safe default
}

const SQM_PER_HECTARE = 10_000;
/** Default rain-garden cell footprint in m², used to convert area → installations. */
const RAIN_GARDEN_CELL_SQM = 25;
/** Default green-corridor average width in m, used to convert area → linear m. */
const GREEN_CORRIDOR_WIDTH_M = 10;
/** Default riparian buffer width in m, used to convert treated area → linear m. */
const RIPARIAN_BUFFER_WIDTH_M = 10;

/** Per-strategy lifecycle pricing spec, sourced from the research brief. */
type StrategyCostSpec = {
  unit: CostUnit;
  basePrice: number;
  perUnit: string;
  /**
   * Planning density: how many `unit`s would be installed per m² of treated
   * site area. Lets us convert from a treated footprint (which is what the
   * simulation engine and the dashboard care about) into the brief's native
   * billing unit. Effective per-m² rate = basePrice × unitsPerSqm.
   */
  unitsPerSqm: number;
  /** Annual maintenance as % of CAPEX. */
  maintenanceRatePct: number;
  /** Default lifecycle horizon (years) used by the cost card. */
  defaultLifecycleYears: number;
  rationale: string;
};

const DEFAULT_LIFECYCLE_YEARS = 5;

/* * Base prices keyed by canonical strategy. See file header. */
export const STRATEGY_COST_SPECS: Record<InterventionType, StrategyCostSpec> = {
  "urban canopy": {
    unit: "tree",
    basePrice: 1_200,
    perUnit: "₱1,200 per tree (nursery stock + planting + first-year care)",
    unitsPerSqm: COEFFICIENTS["urban canopy"].treesPerHectare.mid / SQM_PER_HECTARE,
    maintenanceRatePct: COEFFICIENTS["urban canopy"].maintenanceCostRatePct.mid,
    defaultLifecycleYears: DEFAULT_LIFECYCLE_YEARS,
    rationale:
      "Mandaue planning estimate: urban canopy enhancement at ₱1,200/tree, planted at canopy coefficient density (~120 trees/ha).",
  },
  "targeted infill": {
    unit: "tree",
    basePrice: 1_200,
    perUnit: "₱1,200 per tree (gap-filling planting)",
    unitsPerSqm:
      COEFFICIENTS["targeted infill"].treesPerHectare.mid / SQM_PER_HECTARE,
    maintenanceRatePct: COEFFICIENTS["targeted infill"].maintenanceCostRatePct.mid,
    defaultLifecycleYears: DEFAULT_LIFECYCLE_YEARS,
    rationale:
      "Mandaue planning estimate: same per-tree price as urban canopy; lower planting density reflects gap-filling siting.",
  },
  "understory shrubs": {
    unit: "sqm",
    basePrice: COEFFICIENTS["understory shrubs"].costPerSqm.mid,
    perUnit: `≈ ₱${COEFFICIENTS["understory shrubs"].costPerSqm.mid.toLocaleString()} per m² of shrub / groundcover planting`,
    unitsPerSqm: 1,
    maintenanceRatePct:
      COEFFICIENTS["understory shrubs"].maintenanceCostRatePct.mid,
    defaultLifecycleYears: DEFAULT_LIFECYCLE_YEARS,
    rationale:
      "Brief lacks a shrub line item; using literature per-m² coefficient as fallback.",
  },
  "green roof": {
    unit: "sqm",
    basePrice: 3_500,
    perUnit: "₱3,500 per m² of green roof (substrate + plants + waterproofing)",
    unitsPerSqm: 1,
    maintenanceRatePct: COEFFICIENTS["green roof"].maintenanceCostRatePct.mid,
    defaultLifecycleYears: DEFAULT_LIFECYCLE_YEARS,
    rationale:
      "Mandaue planning estimate: rooftop garden / green roof installation at ₱3,500/m² of roof area.",
  },
  "vertical greening": {
    unit: "sqm",
    basePrice: 9_000,
    perUnit: "₱9,000 per m² of green wall (modules + irrigation)",
    unitsPerSqm: 1,
    maintenanceRatePct:
      COEFFICIENTS["vertical greening"].maintenanceCostRatePct.mid,
    defaultLifecycleYears: DEFAULT_LIFECYCLE_YEARS,
    rationale:
      "Mandaue planning estimate: green wall installation at ₱9,000/m² of facade area.",
  },
  "green corridor": {
    unit: "linear-m",
    basePrice: 12_000,
    perUnit:
      "₱12,000 per linear metre of active greenway / green corridor (₱1.2M per 100 m segment; ~10 m planted width)",
    unitsPerSqm: 1 / GREEN_CORRIDOR_WIDTH_M,
    maintenanceRatePct: COEFFICIENTS["green corridor"].maintenanceCostRatePct.mid,
    defaultLifecycleYears: DEFAULT_LIFECYCLE_YEARS,
    rationale:
      "Mandaue planning estimate: active greenway at ₱12,000/linear m, inclusive of hardscape, planting, and drainage.",
  },
  "pocket park": {
    unit: "sqm",
    basePrice: COEFFICIENTS["pocket park"].costPerSqm.mid,
    perUnit: `≈ ₱${COEFFICIENTS["pocket park"].costPerSqm.mid.toLocaleString()} per m² of pocket park (paths, trees, furniture)`,
    unitsPerSqm: 1,
    maintenanceRatePct: COEFFICIENTS["pocket park"].maintenanceCostRatePct.mid,
    defaultLifecycleYears: DEFAULT_LIFECYCLE_YEARS,
    rationale:
      "Brief lacks a pocket park line item; using literature per-m² coefficient as fallback.",
  },
  "rain garden": {
    unit: "installation",
    basePrice: 3_500,
    perUnit: `₱3,500 per rain-garden cell (≈ ${RAIN_GARDEN_CELL_SQM} m² each)`,
    unitsPerSqm: 1 / RAIN_GARDEN_CELL_SQM,
    maintenanceRatePct: COEFFICIENTS["rain garden"].maintenanceCostRatePct.mid,
    defaultLifecycleYears: DEFAULT_LIFECYCLE_YEARS,
    rationale: `Mandaue planning estimate: ₱3,500 per rain-garden installation, billed per ${RAIN_GARDEN_CELL_SQM} m² engineered cell.`,
  },
  "permeable surface": {
    unit: "sqm",
    basePrice: 2_800,
    perUnit: "₱2,800 per m² of permeable / cool surface retrofit",
    unitsPerSqm: 1,
    maintenanceRatePct:
      COEFFICIENTS["permeable surface"].maintenanceCostRatePct.mid,
    defaultLifecycleYears: DEFAULT_LIFECYCLE_YEARS,
    rationale:
      "Mandaue planning estimate: permeable pavement at ₱2,800/m² of paved area.",
  },
  "riparian buffer": {
    unit: "linear-m",
    basePrice: 2_000,
    perUnit:
      "₱2,000 per linear metre of riparian buffer vegetation (native trees + shrubs)",
    unitsPerSqm: 1 / RIPARIAN_BUFFER_WIDTH_M,
    maintenanceRatePct: COEFFICIENTS["riparian buffer"].maintenanceCostRatePct.mid,
    defaultLifecycleYears: DEFAULT_LIFECYCLE_YEARS,
    rationale:
      "Mandaue planning estimate: riparian buffer at ₱2,000/linear m, native vegetation along waterways.",
  },
  "wetland restoration": {
    unit: "hectare",
    basePrice: 75_000,
    perUnit:
      "₱75,000 per hectare of wetland / mangrove restoration (seedlings + planting + first-year care)",
    unitsPerSqm: 1 / SQM_PER_HECTARE,
    maintenanceRatePct:
      COEFFICIENTS["wetland restoration"].maintenanceCostRatePct.mid,
    defaultLifecycleYears: DEFAULT_LIFECYCLE_YEARS,
    rationale:
      "Mandaue planning estimate: wetland / mangrove restoration at ₱75,000/hectare.",
  },
};

/** Describe each canonical strategy in a human-readable cost line. */
export const STRATEGY_UNIT_LABELS: Record<InterventionType, string> =
  Object.fromEntries(
    (Object.keys(STRATEGY_COST_SPECS) as InterventionType[]).map((k) => [
      k,
      STRATEGY_COST_SPECS[k].perUnit,
    ]),
  ) as Record<InterventionType, string>;

/**
 * Effective per-m² rate the simulation engine uses (basePrice × unitsPerSqm).
 * Falls back to the literature coefficient when the spec isn't available.
 */
export function basePricePerSqm(key: InterventionType): number {
  const spec = STRATEGY_COST_SPECS[key];
  if (!spec) return COEFFICIENTS[key].costPerSqm.mid;
  return spec.basePrice * spec.unitsPerSqm;
}

const MATERIALS_SHARE = 0.5;
const LABOR_SHARE = 0.35;

/**
 * Compute a cost estimate. `areaSqm = null` falls back to a nominal
 * 1-hectare reference site so the card still shows usable numbers. The
 * estimate is lifecycle-based: capital + N years of maintenance, with the
 * brief's materials / labor / maintenance / contingency breakdown.
 */
export function estimateCost(
  interventionType: string,
  areaSqm: number | null,
  locationMultiplier = 1,
  options: EstimateOptions = {},
): CostEstimate {
  const strategyKey = resolveStrategyKey(interventionType);
  const spec = STRATEGY_COST_SPECS[strategyKey];
  const lm = Math.max(0.5, locationMultiplier);
  const lifecycleYears = Math.max(
    1,
    Math.round(options.lifecycleYears ?? spec.defaultLifecycleYears),
  );

  const effectiveArea =
    areaSqm && Number.isFinite(areaSqm) && areaSqm > 0 ? areaSqm : null;
  const billableSqm = effectiveArea ?? SQM_PER_HECTARE; // 1 ha reference site

  const quantity = billableSqm * spec.unitsPerSqm;
  const capitalCostRaw = spec.basePrice * quantity;
  const maintenanceRate = Math.max(0, spec.maintenanceRatePct) / 100;
  const maintenanceSubtotal = capitalCostRaw * maintenanceRate * lifecycleYears;

  const totalEstimate = Math.round((capitalCostRaw + maintenanceSubtotal) * lm);
  const materials = Math.round(capitalCostRaw * MATERIALS_SHARE * lm);
  const labor = Math.round(capitalCostRaw * LABOR_SHARE * lm);
  const maintenance = Math.round(maintenanceSubtotal * lm);
  const contingency = Math.max(
    0,
    totalEstimate - (materials + labor + maintenance),
  );

  const effectivePricePerSqm = spec.basePrice * spec.unitsPerSqm;

  return {
    interventionType,
    strategyKey,
    unit: spec.unit,
    basePrice: spec.basePrice,
    perUnit: spec.perUnit,
    currencyUnit: "PHP",
    area: effectiveArea,
    quantity: Number(quantity.toFixed(quantity >= 100 ? 0 : 2)),
    effectivePricePerSqm: Number(effectivePricePerSqm.toFixed(2)),
    locationMultiplier,
    lifecycleYears,
    capitalCost: Math.round(capitalCostRaw * lm),
    totalEstimate,
    breakdown: {
      materials,
      labor,
      maintenance,
      contingency,
    },
  };
}
