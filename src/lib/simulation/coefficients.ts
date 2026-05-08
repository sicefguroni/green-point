/**
 * Literature-derived coefficient tables for the greening simulation engine.
 *
 * Every coefficient is expressed as `{ low, mid, high }` so uncertainty flows
 * into the UI confidence bands. Numbers below are *midrange priors* drawn from
 * peer-reviewed urban greening meta-analyses (global + tropical / SE-Asian
 * subsets) and from published Philippine DENR / LGU unit-cost references.
 * They are intentionally conservative; the RAG + LLM narrative layer is what
 * surfaces the authoritative citation alongside the retrieved excerpt.
 *
 * Key sources (short tags match the `sources` field and RAG study titles):
 *   - Bowler et al. (2010)                    — cooling from urban vegetation
 *   - Ziter et al. (2019)                     — canopy cover vs. LST
 *   - Nowak et al. (2006, 2014)               — air pollution removal (i-Tree)
 *   - McPherson et al. (2014)                 — urban forest C sequestration
 *   - US EPA Stormwater Calculator (v1.2+)    — canopy / bioretention retention
 *   - DENR / DPWH / Philippine Green Building — unit costs (2019–2023)
 *   - McDonald et al. (2019) "Planting Healthy Air"
 *
 * Mixed-strategy was removed: it blurred the evidence base and produced
 * unbounded cost estimates. Users pick one concrete intervention at a time.
 */
export type InterventionType =
  | "urban canopy"
  | "targeted infill"
  | "understory shrubs"
  | "green roof"
  | "vertical greening"
  | "green corridor"
  | "pocket park"
  | "rain garden"
  | "permeable surface"
  | "riparian buffer";

export type Range = {
  low: number;
  mid: number;
  high: number;
};

export type CoefficientSet = {
  /** °C cooling per 10 percentage-point gain in tree canopy cover. */
  coolingPer10pctCanopy: Range;
  /** NDVI uplift per 10 percentage-point gain in tree canopy cover. */
  ndviUpliftPer10pctCanopy: Range;
  /** Litres of stormwater retained per m2 of treated area, per 10mm event. */
  stormwaterRetentionPerM2Per10mm: Range;
  /** kg PM2.5 removed per hectare of effective canopy per year. */
  pm25RemovalPerHaYear: Range;
  /** kg NO2 removed per hectare of effective canopy per year. */
  no2RemovalPerHaYear: Range;
  /** kg CO2 sequestered per hectare of effective canopy per year. */
  co2SequestrationPerHaYear: Range;
  /** Estimated trees required per hectare of treated canopy (planting density). */
  treesPerHectare: Range;
  /** Fraction of baseline m2 that gets "treated" per percentage-point canopy gain. */
  treatedFractionPerCanopyPoint: Range;
  /**
   * All-in unit cost of the intervention per m² of *treated* area, PHP.
   * Covers site prep, plants, labour and first-year care for canopy/corridor
   * interventions; for rain gardens this covers excavation, engineered media,
   * underdrain and plantings. Ranges cross-checked against:
   *   - DENR Greening Programme per-seedling cost × planting density
   *   - QC & Makati LGU roadside greening bid averages (2020–2023)
   *   - DPWH Drainage / bioretention schedule of rates (2022)
   */
  costPerSqm: Range;
  /** Annual maintenance cost as % of CAPEX (ranges per intervention type). */
  maintenanceCostRatePct: Range;
  /** Discount rate applied when computing NPV of maintenance costs. */
  maintenanceDiscountRate: number;
  /** Short tags the narrative layer uses to match RAG-retrieved study titles. */
  sources: string[];
};

/**
 * Urban canopy = infill street-tree and parcel-tree planting.
 * Cost driven by seedlings (₱150–400/tree), labour, basin prep and first-year
 * watering; at ~100–150 trees/ha this lands at ~₱15–60 per m² of treated
 * ground, far lower than engineered infrastructure. Cooling values from
 * Ziter (2019): ~1.4°C per 10% canopy; tempered for tropical conditions
 * (Bowler 2010 tropical subset ≈ 0.6–1.0°C). PM2.5 and NO2 from i-Tree Eco
 * (Nowak et al.). Carbon sequestration from McPherson (young-to-mature urban
 * trees average 0.5–2 tC/ha/yr ≈ 1.8–7 tCO2/ha/yr).
 */
const URBAN_CANOPY: CoefficientSet = {
  coolingPer10pctCanopy: { low: 0.4, mid: 0.8, high: 1.3 },
  ndviUpliftPer10pctCanopy: { low: 0.04, mid: 0.07, high: 0.1 },
  stormwaterRetentionPerM2Per10mm: { low: 1.5, mid: 3.0, high: 5.5 },
  pm25RemovalPerHaYear: { low: 0.6, mid: 1.2, high: 2.0 },
  no2RemovalPerHaYear: { low: 0.3, mid: 0.7, high: 1.2 },
  co2SequestrationPerHaYear: { low: 1800, mid: 4000, high: 7000 },
  treesPerHectare: { low: 80, mid: 120, high: 180 },
  treatedFractionPerCanopyPoint: { low: 0.008, mid: 0.01, high: 0.012 },
  costPerSqm: { low: 15, mid: 35, high: 70 },
  maintenanceCostRatePct: { low: 3, mid: 5, high: 8 },
  maintenanceDiscountRate: 0.06,
  sources: ["canopy", "shade", "evapotranspiration", "street trees", "i-tree"],
};

const TARGETED_INFILL: CoefficientSet = {
  coolingPer10pctCanopy: { low: 0.35, mid: 0.7, high: 1.1 },
  ndviUpliftPer10pctCanopy: { low: 0.035, mid: 0.065, high: 0.095 },
  stormwaterRetentionPerM2Per10mm: { low: 1.4, mid: 2.8, high: 5.0 },
  pm25RemovalPerHaYear: { low: 0.55, mid: 1.1, high: 1.9 },
  no2RemovalPerHaYear: { low: 0.25, mid: 0.6, high: 1.1 },
  co2SequestrationPerHaYear: { low: 1600, mid: 3600, high: 6400 },
  treesPerHectare: { low: 50, mid: 85, high: 130 },
  treatedFractionPerCanopyPoint: { low: 0.005, mid: 0.007, high: 0.009 },
  costPerSqm: { low: 25, mid: 55, high: 110 },
  maintenanceCostRatePct: { low: 3, mid: 5, high: 8 },
  maintenanceDiscountRate: 0.06,
  sources: ["targeted", "infill", "shade gaps", "street trees", "equity"],
};

const UNDERSTORY_SHRUBS: CoefficientSet = {
  coolingPer10pctCanopy: { low: 0.15, mid: 0.35, high: 0.6 },
  ndviUpliftPer10pctCanopy: { low: 0.035, mid: 0.06, high: 0.085 },
  stormwaterRetentionPerM2Per10mm: { low: 2.0, mid: 4.0, high: 7.0 },
  pm25RemovalPerHaYear: { low: 0.25, mid: 0.6, high: 1.1 },
  no2RemovalPerHaYear: { low: 0.12, mid: 0.3, high: 0.7 },
  co2SequestrationPerHaYear: { low: 700, mid: 1600, high: 3200 },
  treesPerHectare: { low: 0, mid: 10, high: 25 },
  treatedFractionPerCanopyPoint: { low: 0.01, mid: 0.014, high: 0.018 },
  costPerSqm: { low: 40, mid: 85, high: 160 },
  maintenanceCostRatePct: { low: 4, mid: 7, high: 12 },
  maintenanceDiscountRate: 0.06,
  sources: ["understory", "shrubs", "ground cover", "biodiversity"],
};

const GREEN_ROOF: CoefficientSet = {
  coolingPer10pctCanopy: { low: 0.2, mid: 0.45, high: 0.8 },
  ndviUpliftPer10pctCanopy: { low: 0.03, mid: 0.055, high: 0.08 },
  stormwaterRetentionPerM2Per10mm: { low: 3.0, mid: 7.5, high: 14.0 },
  pm25RemovalPerHaYear: { low: 0.15, mid: 0.4, high: 0.8 },
  no2RemovalPerHaYear: { low: 0.08, mid: 0.22, high: 0.5 },
  co2SequestrationPerHaYear: { low: 500, mid: 1200, high: 2600 },
  treesPerHectare: { low: 0, mid: 0, high: 10 },
  treatedFractionPerCanopyPoint: { low: 0.003, mid: 0.006, high: 0.01 },
  costPerSqm: { low: 1200, mid: 2400, high: 4200 },
  maintenanceCostRatePct: { low: 5, mid: 8, high: 12 },
  maintenanceDiscountRate: 0.06,
  sources: ["green roof", "roof garden", "building envelope", "stormwater"],
};

const VERTICAL_GREENING: CoefficientSet = {
  coolingPer10pctCanopy: { low: 0.15, mid: 0.35, high: 0.65 },
  ndviUpliftPer10pctCanopy: { low: 0.02, mid: 0.045, high: 0.07 },
  stormwaterRetentionPerM2Per10mm: { low: 0.4, mid: 1.0, high: 2.0 },
  pm25RemovalPerHaYear: { low: 0.2, mid: 0.55, high: 1.0 },
  no2RemovalPerHaYear: { low: 0.1, mid: 0.3, high: 0.65 },
  co2SequestrationPerHaYear: { low: 450, mid: 1100, high: 2300 },
  treesPerHectare: { low: 0, mid: 0, high: 5 },
  treatedFractionPerCanopyPoint: { low: 0.003, mid: 0.005, high: 0.008 },
  costPerSqm: { low: 900, mid: 1800, high: 3500 },
  maintenanceCostRatePct: { low: 6, mid: 10, high: 16 },
  maintenanceDiscountRate: 0.06,
  sources: ["vertical greening", "green wall", "facade", "building envelope"],
};

/**
 * Green corridor = continuous linear planting strip (waterway edge, boulevard
 * median, road-verge green spine). Adds hardscape (curbing, soil cells,
 * drip irrigation) on top of canopy planting, so unit cost is ~2–3× canopy
 * but stormwater performance per m² is ~2× because of deeper root profile
 * and planned infiltration verge.
 */
const GREEN_CORRIDOR: CoefficientSet = {
  coolingPer10pctCanopy: { low: 0.3, mid: 0.6, high: 1.0 },
  ndviUpliftPer10pctCanopy: { low: 0.03, mid: 0.06, high: 0.09 },
  stormwaterRetentionPerM2Per10mm: { low: 3.0, mid: 6.0, high: 10.0 },
  pm25RemovalPerHaYear: { low: 0.5, mid: 1.0, high: 1.8 },
  no2RemovalPerHaYear: { low: 0.25, mid: 0.6, high: 1.1 },
  co2SequestrationPerHaYear: { low: 1500, mid: 3500, high: 6500 },
  treesPerHectare: { low: 60, mid: 100, high: 160 },
  treatedFractionPerCanopyPoint: { low: 0.009, mid: 0.011, high: 0.014 },
  costPerSqm: { low: 45, mid: 90, high: 180 },
  maintenanceCostRatePct: { low: 4, mid: 6, high: 10 },
  maintenanceDiscountRate: 0.06,
  sources: ["corridor", "connectivity", "blue-green", "biofiltration"],
};

const POCKET_PARK: CoefficientSet = {
  coolingPer10pctCanopy: { low: 0.25, mid: 0.6, high: 1.0 },
  ndviUpliftPer10pctCanopy: { low: 0.04, mid: 0.075, high: 0.11 },
  stormwaterRetentionPerM2Per10mm: { low: 2.5, mid: 5.5, high: 10.0 },
  pm25RemovalPerHaYear: { low: 0.35, mid: 0.85, high: 1.5 },
  no2RemovalPerHaYear: { low: 0.18, mid: 0.45, high: 0.9 },
  co2SequestrationPerHaYear: { low: 1000, mid: 2600, high: 5200 },
  treesPerHectare: { low: 35, mid: 65, high: 110 },
  treatedFractionPerCanopyPoint: { low: 0.008, mid: 0.012, high: 0.018 },
  costPerSqm: { low: 250, mid: 650, high: 1400 },
  maintenanceCostRatePct: { low: 5, mid: 8, high: 12 },
  maintenanceDiscountRate: 0.06,
  sources: ["pocket park", "community garden", "courtyard", "vacant lot"],
};

/**
 * Rain garden / bioretention cell. Small footprint (≈1% of catchment served)
 * but each m² is an engineered system: excavation to 0.8–1.2m, filter media,
 * underdrain, overflow and plantings. Philippine DPWH bioretention schedule
 * rates typically come out at ₱1,500–₱3,500 per m² of cell footprint.
 * Cooling benefit is muted (shrub/grass dominant), but stormwater retention
 * per m² is 3–4× a canopy parcel and air quality benefit is small.
 */
const RAIN_GARDEN: CoefficientSet = {
  coolingPer10pctCanopy: { low: 0.1, mid: 0.3, high: 0.6 },
  ndviUpliftPer10pctCanopy: { low: 0.02, mid: 0.04, high: 0.07 },
  stormwaterRetentionPerM2Per10mm: { low: 6.0, mid: 12.0, high: 22.0 },
  pm25RemovalPerHaYear: { low: 0.2, mid: 0.5, high: 1.0 },
  no2RemovalPerHaYear: { low: 0.1, mid: 0.3, high: 0.7 },
  co2SequestrationPerHaYear: { low: 900, mid: 2200, high: 4500 },
  treesPerHectare: { low: 40, mid: 70, high: 110 },
  // Small footprint: ~0.1% of area per canopy-equivalent percentage point.
  treatedFractionPerCanopyPoint: { low: 0.0008, mid: 0.0015, high: 0.0025 },
  costPerSqm: { low: 900, mid: 1800, high: 3200 },
  maintenanceCostRatePct: { low: 5, mid: 8, high: 12 },
  maintenanceDiscountRate: 0.06,
  sources: ["rain garden", "bioswale", "stormwater", "permeable", "bioretention"],
};

const PERMEABLE_SURFACE: CoefficientSet = {
  coolingPer10pctCanopy: { low: 0.05, mid: 0.18, high: 0.35 },
  ndviUpliftPer10pctCanopy: { low: 0.005, mid: 0.015, high: 0.03 },
  stormwaterRetentionPerM2Per10mm: { low: 4.0, mid: 9.0, high: 16.0 },
  pm25RemovalPerHaYear: { low: 0.05, mid: 0.12, high: 0.25 },
  no2RemovalPerHaYear: { low: 0.03, mid: 0.08, high: 0.18 },
  co2SequestrationPerHaYear: { low: 100, mid: 300, high: 700 },
  treesPerHectare: { low: 0, mid: 0, high: 5 },
  treatedFractionPerCanopyPoint: { low: 0.001, mid: 0.002, high: 0.004 },
  costPerSqm: { low: 650, mid: 1200, high: 2200 },
  maintenanceCostRatePct: { low: 3, mid: 5, high: 8 },
  maintenanceDiscountRate: 0.06,
  sources: ["permeable", "porous pavement", "depaving", "cool surface"],
};

const RIPARIAN_BUFFER: CoefficientSet = {
  coolingPer10pctCanopy: { low: 0.25, mid: 0.55, high: 0.95 },
  ndviUpliftPer10pctCanopy: { low: 0.035, mid: 0.07, high: 0.1 },
  stormwaterRetentionPerM2Per10mm: { low: 4.5, mid: 9.5, high: 17.0 },
  pm25RemovalPerHaYear: { low: 0.35, mid: 0.8, high: 1.5 },
  no2RemovalPerHaYear: { low: 0.18, mid: 0.45, high: 0.9 },
  co2SequestrationPerHaYear: { low: 1200, mid: 3200, high: 6200 },
  treesPerHectare: { low: 45, mid: 80, high: 130 },
  treatedFractionPerCanopyPoint: { low: 0.008, mid: 0.012, high: 0.016 },
  costPerSqm: { low: 120, mid: 280, high: 650 },
  maintenanceCostRatePct: { low: 4, mid: 7, high: 12 },
  maintenanceDiscountRate: 0.06,
  sources: ["riparian", "buffer", "river", "coastal", "mangrove"],
};

export const COEFFICIENTS: Record<InterventionType, CoefficientSet> = {
  "urban canopy": URBAN_CANOPY,
  "targeted infill": TARGETED_INFILL,
  "understory shrubs": UNDERSTORY_SHRUBS,
  "green roof": GREEN_ROOF,
  "vertical greening": VERTICAL_GREENING,
  "green corridor": GREEN_CORRIDOR,
  "pocket park": POCKET_PARK,
  "rain garden": RAIN_GARDEN,
  "permeable surface": PERMEABLE_SURFACE,
  "riparian buffer": RIPARIAN_BUFFER,
};

/** Canonical default fallback when an unknown intervention string arrives. */
export const DEFAULT_INTERVENTION: InterventionType = "urban canopy";

export function getCoefficients(
  intervention: string | null | undefined,
): CoefficientSet {
  if (!intervention) return COEFFICIENTS[DEFAULT_INTERVENTION];
  const key = intervention.toLowerCase().trim() as InterventionType;
  return COEFFICIENTS[key] ?? COEFFICIENTS[DEFAULT_INTERVENTION];
}

/** Multiplier that boosts stormwater retention under higher flood stress. */
export function floodMultiplier(
  floodingSeverity: "low" | "medium" | "high" | string,
  rainfallChangeRate: number,
): number {
  const base =
    floodingSeverity === "high" ? 1.35 : floodingSeverity === "medium" ? 1.1 : 0.9;
  const rainBoost = Math.max(-0.2, Math.min(0.4, rainfallChangeRate / 100));
  return base * (1 + rainBoost);
}

/** Effective representative rainfall event (mm) used when converting per-event to annual. */
export const REPRESENTATIVE_EVENT_MM = 10;

/** Representative number of retention events per year for tropical PH setting. */
export const EVENTS_PER_YEAR = 120;
