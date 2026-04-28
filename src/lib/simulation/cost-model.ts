/**
 * Shared cost model for greening interventions.
 *
 * Single source of truth for "how much does this intervention cost" used by
 *   - `/api/cost-estimate` (cost card rendered on the map tab)
 *   - `InterventionAnalysisTable` (the dashboard ranking)
 *   - (soon) the simulation engine's CAPEX computation
 *
 * Pricing is evidence-based: same ranges backing the simulation coefficients
 * (`src/lib/simulation/coefficients.ts`), cross-checked against Philippine
 * DENR / DPWH / LGU unit-cost references. All base prices are in PHP per m²
 * of treated area. A barangay-level "location multiplier" lets us nudge for
 * known high-/low-cost-of-living areas without changing the base prices.
 */
import { COEFFICIENTS, type InterventionType } from "./coefficients";

export type CostEstimate = {
  interventionType: string;
  /** Canonical strategy key this intervention was normalised to. */
  strategyKey: InterventionType;
  /** Base unit cost (PHP per m²) before location adjustments. */
  basePrice: number;
  perUnit: string;
  currencyUnit: "PHP";
  /** Site area supplied for the estimate, in m² (null when not provided). */
  area: number | null;
  locationMultiplier: number;
  /** Final estimated cost in PHP, rounded. */
  totalEstimate: number;
  breakdown: {
    materials: number;
    labor: number;
    contingency: number;
  };
};

/**
 * Map any free-form intervention name (LLM output, table hardcoded,
 * user-supplied) onto one of the three canonical strategy keys. This lets us
 * keep a single, evidence-based cost table.
 */
export function resolveStrategyKey(
  interventionType: string | null | undefined,
): InterventionType {
  const s = (interventionType ?? "").toLowerCase();

  const matchers: Array<[InterventionType, RegExp]> = [
    [
      "rain garden",
      /(rain ?garden|bioswale|bioretention|permeable|stormwater|sponge|wetland|retention pond)/,
    ],
    [
      "green corridor",
      /(corridor|boulevard|linear green|greenway|blue-?green|waterway|riparian|verge|parkway|street[- ]scape)/,
    ],
    [
      "urban canopy",
      /(canopy|street ?tree|tree ?planting|pocket|park(?!way)|grove|shade|green wall|vertical|roof top|rooftop|garden|envelope|urban forest|reforest)/,
    ],
  ];

  for (const [key, rx] of matchers) {
    if (rx.test(s)) return key;
  }
  return "urban canopy"; // safe default
}

/** Describe each canonical strategy in a human-readable cost line. */
export const STRATEGY_UNIT_LABELS: Record<InterventionType, string> = {
  "urban canopy": "per m² of treated area (≈ street tree / infill planting)",
  "green corridor": "per m² of linear greening (tree + soil cells + irrigation)",
  "rain garden": "per m² of bioretention footprint (engineered cell)",
};

/** Per-m² price for a canonical strategy, in PHP. Pulls from coefficients. */
export function basePricePerSqm(key: InterventionType): number {
  return COEFFICIENTS[key].costPerSqm.mid;
}

/**
 * Compute a cost estimate. `areaSqm = null` falls back to a nominal
 * 1-hectare reference site so the card still shows usable numbers.
 */
export function estimateCost(
  interventionType: string,
  areaSqm: number | null,
  locationMultiplier = 1,
): CostEstimate {
  const strategyKey = resolveStrategyKey(interventionType);
  const basePrice = basePricePerSqm(strategyKey);

  const effectiveArea =
    areaSqm && Number.isFinite(areaSqm) && areaSqm > 0 ? areaSqm : null;
  const billableSqm = effectiveArea ?? 10_000;

  const rawTotal = basePrice * billableSqm * Math.max(0.5, locationMultiplier);
  const totalEstimate = Math.round(rawTotal);

  return {
    interventionType,
    strategyKey,
    basePrice,
    perUnit: STRATEGY_UNIT_LABELS[strategyKey],
    currencyUnit: "PHP",
    area: effectiveArea,
    locationMultiplier,
    totalEstimate,
    breakdown: {
      materials: Math.round(totalEstimate * 0.5),
      labor: Math.round(totalEstimate * 0.35),
      contingency: Math.round(totalEstimate * 0.15),
    },
  };
}
