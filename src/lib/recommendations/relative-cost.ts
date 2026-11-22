/**
 * `recommendation.cost` is not a price: it is where this option's lifecycle
 * cost sits among the strategies evaluated for the same site (0 = cheapest,
 * 1 = most expensive). Shown raw it read as "Cost Index 0.00", which looks like
 * "free". These bands turn it into words a planner can read.
 */
export type RelativeCostBand = "Lowest" | "Low" | "Moderate" | "High" | "Highest";

export function relativeCostBand(value: number | null | undefined): RelativeCostBand | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const v = Math.max(0, Math.min(1, value));
  if (v <= 0.05) return "Lowest";
  if (v < 0.35) return "Low";
  if (v < 0.65) return "Moderate";
  if (v < 0.95) return "High";
  return "Highest";
}

/** Caption under the band, so the scale is explicit. */
export const RELATIVE_COST_CAPTION = "vs. other options for this site";
