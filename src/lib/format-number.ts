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
