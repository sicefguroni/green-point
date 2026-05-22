/**
 * Maximum hazard level across an array of hazard entries.
 *
 * Filters out null/undefined levels and returns the maximum numeric
 * value, or `undefined` if no valid levels exist.
 */
export function maxHazardLevel(
  hazards: { id: string; level: number | null }[] | undefined,
): number | undefined {
  const levels = (hazards ?? [])
    .map((h) => h.level)
    .filter((l): l is number => typeof l === "number");
  return levels.length ? Math.max(...levels) : undefined;
}
