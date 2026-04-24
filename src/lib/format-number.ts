/** UI display: at most two decimal places; drops trailing zeros (e.g. 0.68, 32, 31.5). */
export function formatUpTo2Decimals(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Number(n.toFixed(2)).toString();
}

/** Numeric value rounded to 2 decimal places (for props / charts). */
export function roundTo2Decimals(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
}

/**
 * Compact number display: 1,234 → 1.23K, 1,234,567 → 1.23M, 1.2e9 → 1.2B,
 * 1.2e12 → 1.2T. Small numbers (<1000) render with up to 2 decimals, no commas.
 * Negative values are preserved.
 */
export function formatCompact(n: number, fractionDigits = 1): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs < 1) return `${sign}${Number(abs.toFixed(2))}`;
  if (abs < 1_000) return `${sign}${Number(abs.toFixed(fractionDigits))}`;
  const units: [number, string][] = [
    [1_000_000_000_000, "T"],
    [1_000_000_000, "B"],
    [1_000_000, "M"],
    [1_000, "K"],
  ];
  for (const [scale, suffix] of units) {
    if (abs >= scale) {
      const v = abs / scale;
      const precision = v >= 100 ? 0 : v >= 10 ? 1 : fractionDigits;
      return `${sign}${v.toFixed(precision)}${suffix}`;
    }
  }
  return `${sign}${abs}`;
}

/** Format a Peso amount; compact notation for anything at/above ₱10K. */
export function formatPHP(n: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(n)) return "—";
  const { compact = Math.abs(n) >= 10_000 } = opts;
  if (compact) return `₱${formatCompact(n)}`;
  return `₱${Math.round(n).toLocaleString()}`;
}

/**
 * Format a quantity with its unit, choosing compact notation for large values.
 * Examples: formatQuantity(1_500_000, "L/yr") → "1.5M L/yr",
 *           formatQuantity(42.7, "kg/yr")    → "42.7 kg/yr".
 */
export function formatQuantity(n: number, unit: string): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000) return `${formatCompact(n)}${unit ? " " + unit : ""}`;
  return `${Number(n.toFixed(2))}${unit ? " " + unit : ""}`;
}

/** Signed delta display — always carries + or − sign. */
export function formatSignedQuantity(n: number, unit: string): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return `${sign}${formatQuantity(n, unit)}`;
}
