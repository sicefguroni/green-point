/** Barangay polygon stroke / Mapbox `fill-outline-color` (soft edge, still visible on OSM). */
export const GREENERY_BARANGAY_OUTLINE_COLOR = "rgba(22, 52, 38, 0.48)";

/** Same ramp as explore Mapbox `greeneryIndexFillLayer` (linear on `greeneryIndex`). */
export const GREENERY_INDEX_FILL_STOPS: readonly {
  value: number;
  color: string;
}[] = [
  { value: 0.1, color: "#d73027" },
  { value: 0.25, color: "#fc8d59" },
  { value: 0.4, color: "#fee08b" },
  { value: 0.55, color: "#d9ef8b" },
  { value: 0.7, color: "#91cf60" },
  { value: 0.85, color: "#1a9850" },
];



/** Mapbox `fill-color` expression (same stops as Leaflet helper above). */
export function mapboxGreeneryIndexFillColorExpression(): unknown[] {
  const expr: unknown[] = ["interpolate", ["linear"], ["get", "greeneryIndex"]];
  for (const { value, color } of GREENERY_INDEX_FILL_STOPS) {
    expr.push(value, color);
  }
  return expr;
}

/** Choropleth / legend — alias for explore-aligned ramp. */
export function getGreeneryColor(value: number): string {
  // Continuous hue ramp (red -> green) for smoother, less categorical look.
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const hue = 10 + clamped * 120; // 10 = warm red/orange, 130 = green
  const saturation = 68; // stable chroma for readability
  const lightness = 50; // balanced against map tiles in both themes
  return `hsl(${hue.toFixed(1)} ${saturation}% ${lightness}%)`;
}

export function getGreeneryClassColor(value: number): string {
  return value >= 0.7
    ? "text-green-600 bg-green-100" // dark green - dense
    : value >= 0.5
      ? "text-lime-600 bg-lime-100" // medium green
      : value >= 0.3
        ? "text-yellow-600 bg-yellow-50" // pale yellow
        : value >= 0.01
          ? "text-red-600 bg-red-50" // reddish - barren
          : "text-gray-600 bg-gray-100"; // gray - empty
}

export function getGreeneryTextColor(value: number): string {
  return value >= 0.7
    ? "text-green-600" // dark green - dense
    : value >= 0.5
      ? "text-lime-600" // medium green
      : value >= 0.3
        ? "text-yellow-600" // pale yellow
        : value >= 0.01
          ? "text-red-600" // reddish - barren
          : "text-gray-600"; // gray - empty
}

export function getTemperatureColor(value: number): string {
  return value >= 35
    ? "text-red-500 bg-red-100" // Very hot - red
    : value >= 30
      ? "text-yellow-500 bg-yellow-100" // Hot - orange
      : value >= 25
        ? "text-amber-500 bg-amber-100" // Warm - amber
        : value >= 15
          ? "text-amber-600 bg-amber-50" // Cool - light amber
          : "text-neutral-500 bg-neutral-100"; // Cold - gray (instead of indigo/blue)
}
