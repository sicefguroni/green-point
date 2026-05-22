import { Trees, Sparkles, Flower2, Home, PanelTop, Layers, Landmark, Droplets, Waves } from "lucide-react";
import type { ReactNode } from "react";
import type { InterventionType } from "@/lib/simulation/coefficients";
import type { AmbitionLevel, BudgetTier, TimeHorizon } from "../simulation-types";
import { BUDGET_PRESETS } from "@/lib/simulation/presets";
import type { Feature, Geometry, Position } from "geojson";

// ── Strategy icons ────────────────────────────────────────────────────────

export const STRATEGY_ICONS: Record<InterventionType, ReactNode> = {
  "urban canopy": <Trees className="w-6 h-6" />,
  "targeted infill": <Sparkles className="w-6 h-6" />,
  "understory shrubs": <Flower2 className="w-6 h-6" />,
  "green roof": <Home className="w-6 h-6" />,
  "vertical greening": <PanelTop className="w-6 h-6" />,
  "green corridor": <Layers className="w-6 h-6" />,
  "pocket park": <Landmark className="w-6 h-6" />,
  "rain garden": <Droplets className="w-6 h-6" />,
  "permeable surface": <Droplets className="w-6 h-6" />,
  "riparian buffer": <Waves className="w-6 h-6" />,
  "wetland restoration": <Droplets className="w-6 h-6" />,
};

// ── Ambition order ────────────────────────────────────────────────────────

export const AMBITION_ORDER: AmbitionLevel[] = [
  "light",
  "moderate",
  "ambitious",
  "transformative",
];

// ── Slider interpolation helpers ───────────────────────────────────────────

/**
 * Piecewise stops let us spread the slider's named markers evenly across the
 * track even when the underlying axis is non-linear (log for budgets, sparse
 * preset years for time horizons). `pct` is the visual position of `value` on
 * the slider; values between two adjacent stops are interpolated using
 * `mode === "log"` for monetary axes and linear interpolation otherwise.
 */
export type SliderStop = { pct: number; value: number };

export function valueFromPct(
  stops: SliderStop[],
  pct: number,
  mode: "linear" | "log",
): number {
  const clamped = Math.max(0, Math.min(100, pct));
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (clamped <= b.pct) {
      const t = (clamped - a.pct) / (b.pct - a.pct);
      if (mode === "log") {
        const logV = Math.log10(a.value) + t * (Math.log10(b.value) - Math.log10(a.value));
        return Math.pow(10, logV);
      }
      return a.value + t * (b.value - a.value);
    }
  }
  return stops[stops.length - 1].value;
}

export function pctFromValue(
  stops: SliderStop[],
  value: number,
  mode: "linear" | "log",
): number {
  const min = stops[0].value;
  const max = stops[stops.length - 1].value;
  const clamped = Math.max(min, Math.min(max, value));
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (clamped <= b.value) {
      if (mode === "log") {
        const t =
          (Math.log10(clamped) - Math.log10(a.value)) /
          (Math.log10(b.value) - Math.log10(a.value));
        return a.pct + t * (b.pct - a.pct);
      }
      const t = (clamped - a.value) / (b.value - a.value);
      return a.pct + t * (b.pct - a.pct);
    }
  }
  return stops[stops.length - 1].pct;
}

/**
 * Smoothly biases label anchoring near the track edges so the leftmost label
 * aligns to the start and the rightmost to the end (with everything in between
 * roughly centred). Avoids the visual cut-off that `-translate-x-1/2` causes
 * for markers placed at 0% or 100%.
 */
export function anchorTranslateX(pct: number): string {
  const ratio = Math.max(0, Math.min(100, pct)) / 100;
  return `${(-ratio * 100).toFixed(2)}%`;
}

// ── Budget constants ──────────────────────────────────────────────────────

export const BUDGET_SLIDER_MIN = 100_000;
export const BUDGET_SLIDER_MAX = 50_000_000;

/** Tier presets are anchored at the 25% / 50% / 75% slider stops. */
export const BUDGET_SLIDER_STOPS: SliderStop[] = [
  { pct: 0, value: BUDGET_SLIDER_MIN },
  { pct: 25, value: BUDGET_PRESETS.small.budgetPHP },
  { pct: 50, value: BUDGET_PRESETS.medium.budgetPHP },
  { pct: 75, value: BUDGET_PRESETS.large.budgetPHP },
  { pct: 100, value: BUDGET_SLIDER_MAX },
];

export const BUDGET_SLIDER_TIERS: {
  id: Exclude<BudgetTier, "custom">;
  budgetPHP: number;
  pct: number;
}[] = [
  { id: "small", budgetPHP: BUDGET_PRESETS.small.budgetPHP, pct: 25 },
  { id: "medium", budgetPHP: BUDGET_PRESETS.medium.budgetPHP, pct: 50 },
  { id: "large", budgetPHP: BUDGET_PRESETS.large.budgetPHP, pct: 75 },
];

export const BUDGET_TIER_LABELS: Record<Exclude<BudgetTier, "custom">, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export function snapBudget(budgetPHP: number): number {
  return Math.round(budgetPHP / 10_000) * 10_000; // snap to ₱10k
}

export function nearestTier(budgetPHP: number): Exclude<BudgetTier, "custom"> | null {
  for (const t of BUDGET_SLIDER_TIERS) {
    if (Math.abs(budgetPHP - t.budgetPHP) <= t.budgetPHP * 0.04) return t.id;
  }
  return null;
}

// ── Time horizon constants ────────────────────────────────────────────────

export const TIME_HORIZON_MIN = 1;
export const TIME_HORIZON_MAX = 25;
/** Year presets anchored to even visual stops (0/25/50/75/100%). */
export const TIME_HORIZON_STOPS: SliderStop[] = [
  { pct: 0, value: TIME_HORIZON_MIN },
  { pct: 25, value: 3 },
  { pct: 50, value: 5 },
  { pct: 75, value: 10 },
  { pct: 100, value: TIME_HORIZON_MAX },
];

export const TIME_HORIZON_TIERS: { value: TimeHorizon; pct: number }[] =
  TIME_HORIZON_STOPS.map((s) => ({ value: s.value as TimeHorizon, pct: s.pct }));

// ── Geo helpers ───────────────────────────────────────────────────────────

export function readFeatureName(feature: Feature<Geometry | null>): string {
  const props = feature.properties ?? {};
  const raw =
    props.name ??
    props.NAME ??
    props.Name ??
    props.barangay ??
    props.BARANGAY ??
    "";
  return typeof raw === "string" ? raw : String(raw ?? "");
}

export function geometryRings(geometry: Geometry | null | undefined): Position[][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

export function featureBounds(rings: Position[][]) {
  const points = rings.flat().filter((p) => p.length >= 2);
  if (points.length === 0) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function ringPath(ring: Position[], bounds: NonNullable<ReturnType<typeof featureBounds>>) {
  const width = 300;
  const height = 180;
  const pad = 18;
  const spanX = Math.max(1e-8, bounds.maxX - bounds.minX);
  const spanY = Math.max(1e-8, bounds.maxY - bounds.minY);

  return ring
    .map((p, index) => {
      const x = pad + ((p[0] - bounds.minX) / spanX) * (width - pad * 2);
      const y = pad + (1 - (p[1] - bounds.minY) / spanY) * (height - pad * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ")
    .concat(" Z");
}
