/**
 * Shared site-analysis helpers used by RAG, intervention-context-scoring,
 * and the simulation engine. Extracted to eliminate three copies of the
 * same numeric/parsing logic across the codebase.
 *
 * Every function here is **pure** — no I/O, no imports from project modules.
 */

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

/** Type guard: `value` is a finite number (not NaN, not Infinity). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Clamp to [0, 1]; returns 0 for non-finite input. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Clamp to [min, max]. */
export function clampDelta(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Returns the input value as 0–1 fraction. Handles values already in [0,1],
 * and values in percent 0–100 (divides by 100). Returns undefined for
 * null / undefined / non-finite.
 */
export function canopyFraction01(value: number | null | undefined): number | undefined {
  const raw = isFiniteNumber(value) ? value : undefined;
  if (raw === undefined) return undefined;
  return raw > 1 ? raw / 100 : raw;
}

/** Format a number to `digits` decimal places, or "N/A" if not finite. */
export function formatOptionalFixed(
  value: number | null | undefined,
  digits: number,
): string {
  if (!isFiniteNumber(value)) return "N/A";
  return value.toFixed(digits);
}

/** Format tree canopy as a percentage string, or "N/A". */
export function formatTreeCanopyForPrompt(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "N/A";
  const pct = value >= 0 && value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Site signal analysis
// ---------------------------------------------------------------------------

export type SiteSignals = {
  substantialExistingGreen: boolean;
  likelyDenseLimitedGround: boolean;
  /** True when ground-truth inventory confirms meaningful tree presence */
  highTaggedTreeDensity: boolean;
  taggedTreeCount: number;
};

export function analyzeSiteSignals(context: {
  treeCanopy?: number | null;
  greeneryIndex?: number | null;
  greeneryLevel?: string | null;
  ndvi?: number | null;
  lst?: number | null;
  taggedTreeCount?: number | null;
  inventoryCanopyFraction?: number | null;
}): SiteSignals {
  const canopyFrac = canopyFraction01(context.treeCanopy);
  const gi = isFiniteNumber(context.greeneryIndex)
    ? context.greeneryIndex
    : undefined;
  const ndvi = isFiniteNumber(context.ndvi) ? context.ndvi : undefined;
  const lst = isFiniteNumber(context.lst) ? context.lst : undefined;
  const level = (context.greeneryLevel ?? "").trim();
  const taggedTreeCount = isFiniteNumber(context.taggedTreeCount)
    ? (context.taggedTreeCount as number)
    : 0;
  const inventoryCanopy = canopyFraction01(context.inventoryCanopyFraction);

  const substantialExistingGreen =
    (canopyFrac !== undefined && canopyFrac >= 0.45) ||
    (gi !== undefined && gi >= 0.6) ||
    /^(High|Very High)$/i.test(level);

  /** Stricter than before: heat-island + low green signals together (avoid over-flagging). */
  const likelyDenseLimitedGround =
    !substantialExistingGreen &&
    lst !== undefined &&
    lst >= 33.5 &&
    ((canopyFrac !== undefined && canopyFrac < 0.22) ||
      (gi !== undefined && gi < 0.38) ||
      (ndvi !== undefined && ndvi < 0.22));

  const highTaggedTreeDensity =
    (inventoryCanopy !== undefined && inventoryCanopy >= 0.3) ||
    (taggedTreeCount >= 10 && canopyFrac !== undefined && canopyFrac >= 0.25);

  return {
    substantialExistingGreen,
    likelyDenseLimitedGround,
    highTaggedTreeDensity,
    taggedTreeCount,
  };
}
