/** Barangay polygon stroke / Mapbox `fill-outline-color` (soft edge, still visible on OSM). */
export const GREENERY_BARANGAY_OUTLINE_COLOR = "rgba(22, 52, 38, 0.48)";

/** Same ramp as explore Mapbox `greeneryIndexFillLayer` (linear on `greeneryIndex`). */
export const GREENERY_INDEX_FILL_STOPS: readonly { value: number; color: string }[] =
  [
    { value: 0.1, color: "#d73027" },
    { value: 0.25, color: "#fc8d59" },
    { value: 0.4, color: "#fee08b" },
    { value: 0.55, color: "#d9ef8b" },
    { value: 0.7, color: "#91cf60" },
    { value: 0.85, color: "#1a9850" },
  ];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) =>
      Math.round(Math.min(255, Math.max(0, x)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const [r0, g0, b0] = hexToRgb(a);
  const [r1, g1, b1] = hexToRgb(b);
  return rgbToHex(
    r0 + (r1 - r0) * t,
    g0 + (g1 - g0) * t,
    b0 + (b1 - b0) * t,
  );
}

/** Fill color for barangay polygons — matches explore greenery index layer. */
export function interpolateGreeneryIndexFillColor(value: number): string {
  const stops = GREENERY_INDEX_FILL_STOPS;
  const x = Number.isFinite(value) ? value : 0;
  if (x <= stops[0].value) return stops[0].color;
  const last = stops[stops.length - 1];
  if (x >= last.value) return last.color;
  for (let i = 0; i < stops.length - 1; i++) {
    const { value: x0, color: c0 } = stops[i];
    const { value: x1, color: c1 } = stops[i + 1];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return lerpHex(c0, c1, t);
    }
  }
  return last.color;
}

/** Mapbox `fill-color` expression (same stops as Leaflet helper above). */
export function mapboxGreeneryIndexFillColorExpression(): unknown[] {
  const expr: unknown[] = [
    "interpolate",
    ["linear"],
    ["get", "greeneryIndex"],
  ];
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
        ? "text-amber-500 bg-amber-100" // Warm - amber (instead of blue)
        : value >= 15
          ? "text-amber-600 bg-amber-50" // Cool - light amber (instead of blue)
          : "text-neutral-500 bg-neutral-100"; // Cold - gray (instead of indigo/blue)
}
