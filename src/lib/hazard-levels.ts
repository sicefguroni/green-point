/**
 * Flood hazard level (1–3) from a barangay's `flood_exposure` label in
 * `public/geo/mandaue_barangays_gi.geojson`. The dashboard and recommendation
 * generation both read it, so a barangay gets the same level everywhere.
 */
export function floodLabelToHazard(label: string): number | null {
  const s = label.toLowerCase();
  if (s.includes("very") || s.includes("severe")) return 3;
  if (s.includes("high")) return 3;
  if (s.includes("medium") || s.includes("mod")) return 2;
  if (s.includes("low") || s === "" || s === "none") return 1;
  return null;
}
