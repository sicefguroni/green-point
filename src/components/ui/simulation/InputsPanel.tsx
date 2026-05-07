"use client";

import { useState, useMemo } from "react";
import {
  CloudSun,
  Trees,
  Droplets,
  Sparkles,
  Layers,
  Flower2,
  Home,
  Landmark,
  PanelTop,
  Waves,
  Wallet,
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
  Wand2,
} from "lucide-react";
import {
  AMBITION_PRESETS,
  BUDGET_PRESETS,
  CLIMATE_PRESETS,
  STRATEGY_IDS,
  STRATEGY_LABELS,
  resolveBudgetTier,
  strategyMismatchReason,
} from "@/lib/simulation/presets";
import { evaluateStrategies } from "@/lib/simulation/evaluate-strategies";
import { formatCompact, formatPHP } from "@/lib/format-number";
import type {
  AmbitionLevel,
  BudgetTier,
  ClimateFuture,
  SimulationBaselineData,
  SimulationInputsState,
  SimulationIntent,
  TimeHorizon,
} from "./simulation-types";
import type { InterventionType } from "@/lib/simulation/coefficients";
import { useBarangay } from "@/context/BarangayContext";
import { useGeoData } from "@/context/geoDataStore";
import type { Feature, Geometry, Position } from "geojson";

const STRATEGY_ICONS: Record<InterventionType, React.ReactNode> = {
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
};

const AMBITION_ORDER: AmbitionLevel[] = [
  "light",
  "moderate",
  "ambitious",
  "transformative",
];

export type SimulationStepId =
  | "climate"
  | "strategy"
  | "ambitionBudget"
  | "review";

export type SimulationInputsProps = {
  step: SimulationStepId;
  intent: SimulationIntent;
  inputs: SimulationInputsState;
  baseline: SimulationBaselineData;
  onIntentChange: (partial: Partial<SimulationIntent>) => void;
  onAdvancedChange: <K extends keyof SimulationInputsState>(
    key: K,
    value: SimulationInputsState[K],
  ) => void;
};

function HelpTip({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center align-middle ml-1 text-gray-400 dark:text-neutral-500"
      title={text}
      aria-label={text}
    >
      <Info className="w-3.5 h-3.5" />
    </span>
  );
}

function ClimateStep({
  intent,
  baseline,
  onIntentChange,
}: SimulationInputsProps) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <CloudSun className="w-5 h-5" />
          <h3 className="text-lg font-semibold">What climate future are we planning for?</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-neutral-400">
          Pick a climate scenario. We&apos;ll set the temperature, rainfall, and
          flood-risk levers behind the scenes.
        </p>
        <p className="text-xs text-gray-500 dark:text-neutral-500">
          Your barangay&apos;s current flood exposure is{" "}
          <strong>{baseline.floodExposure}</strong>.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(CLIMATE_PRESETS) as ClimateFuture[]).map((id) => {
          const p = CLIMATE_PRESETS[id];
          const selected = intent.climateFuture === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => onIntentChange({ climateFuture: id })}
              className={`text-left rounded-xl border-2 p-4 transition-all ${
                selected
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-sm"
                  : "border-gray-200 dark:border-neutral-800 hover:border-emerald-300 bg-white dark:bg-neutral-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800 dark:text-neutral-100">
                  {p.label}
                </span>
                <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                  {p.floodingSeverity} flood
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mt-2">
                {p.description}
              </p>
              <div className="mt-3 flex gap-3 text-xs text-gray-500 dark:text-neutral-500">
                <span>+{p.temperatureIncreaseRate.toFixed(2)} °C/yr</span>
                <span>
                  {p.rainfallChangeRate >= 0 ? "+" : ""}
                  {p.rainfallChangeRate}% rain/yr
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StrategyStep({
  intent,
  baseline,
  onIntentChange,
}: SimulationInputsProps) {
  // Rank every strategy against this barangay's baseline using the same
  // engine the dashboard's "Recommended Intervention" column uses, so the
  // user always sees options sorted by actual on-site effectiveness.
  const rankedStrategies = useMemo(() => {
    const ranked = evaluateStrategies(baseline);
    const byStrategy = new Map(ranked.map((r) => [r.strategy, r]));
    return STRATEGY_IDS.map((id) => ({
      id,
      evaluation: byStrategy.get(id),
    }))
      .sort(
        (a, b) =>
          (b.evaluation?.overallRating ?? 0) -
          (a.evaluation?.overallRating ?? 0),
      );
  }, [baseline]);

  const topStrategy = rankedStrategies[0]?.id;
  const primaryChallenge =
    rankedStrategies[0]?.evaluation?.primaryChallenge?.label;

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <Trees className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Pick a greening strategy</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-neutral-400">
          All strategies are available — the list is sorted by best fit for{" "}
          <strong>{baseline.name ?? "this barangay"}</strong>. Cards greyed out
          aren&apos;t a strong fit for the baseline, but you can still pick
          them.
        </p>
        {primaryChallenge && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            Top picks lead with what alleviates the area&apos;s biggest issue:{" "}
            <strong>{primaryChallenge}</strong>.
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {rankedStrategies.map(({ id, evaluation }) => {
          const meta = STRATEGY_LABELS[id];
          const selected = intent.strategy === id;
          const mismatch = strategyMismatchReason(id, baseline);
          const isTopFit = id === topStrategy;
          const score = evaluation?.overallRating;
          const scoreColor =
            score == null
              ? "text-gray-500 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800"
              : score >= 75
                ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20"
                : score >= 55
                  ? "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20"
                  : "text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800";
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => onIntentChange({ strategy: id })}
              className={`text-left rounded-xl border-2 p-4 transition-all relative ${
                selected
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-sm"
                  : mismatch
                    ? "border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 opacity-70 hover:opacity-100"
                    : "border-gray-200 dark:border-neutral-800 hover:border-emerald-300 bg-white dark:bg-neutral-900"
              }`}
            >
              <span className="absolute top-2 right-2 flex items-center gap-1.5">
                {isTopFit && !selected && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded"
                    title="Highest-fit strategy for this barangay's baseline (matches the dashboard's Recommended Intervention)."
                  >
                    <Wand2 className="w-3 h-3" />
                    Top fit
                  </span>
                )}
                {score != null && (
                  <span
                    className={`text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded ${scoreColor}`}
                    title="Composite site-fit score (0–100) — same formula the map tab's recommendation cards use."
                  >
                    {score.toFixed(0)}
                  </span>
                )}
              </span>
              <div className="flex items-start gap-3">
                <span className="rounded-lg p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  {STRATEGY_ICONS[id]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 dark:text-neutral-100 pr-16">
                    {meta.label}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-neutral-400 mt-0.5">
                    {meta.tagline}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {meta.badges.map((b) => (
                      <span
                        key={b}
                        className="text-[11px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300"
                      >
                        best for {b}
                      </span>
                    ))}
                  </div>
                  {mismatch && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{mismatch}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AmbitionBudgetStep({
  intent,
  baseline,
  onIntentChange,
}: SimulationInputsProps) {
  const ambitionIdx = AMBITION_ORDER.indexOf(intent.ambition);
  const ambition = AMBITION_PRESETS[intent.ambition];
  const areaHa = baseline.areaHectares ?? 30;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <Sparkles className="w-5 h-5" />
          <h3 className="text-lg font-semibold">How ambitious, and how much can we spend?</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-neutral-400">
          Move the slider to set the target. Bigger ambition needs bigger
          budgets — we&apos;ll flag if your budget can&apos;t cover the target.
        </p>
      </header>

      <div className="space-y-3">
        <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-neutral-300">
          <span>
            Ambition
            <HelpTip text="How much greener you want this barangay to become. Translates into canopy and NDVI targets." />
          </span>
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
            {ambition.label}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={AMBITION_ORDER.length - 1}
          step={1}
          value={ambitionIdx}
          aria-valuetext={ambition.label}
          onChange={(e) =>
            onIntentChange({
              ambition: AMBITION_ORDER[parseInt(e.target.value, 10)],
            })
          }
          className="w-full"
          style={{ accentColor: "#0f9d58" }}
        />
        <div className="grid grid-cols-4 text-[11px] text-gray-500 dark:text-neutral-500 -mt-1">
          {AMBITION_ORDER.map((id) => (
            <span
              key={id}
              className={`text-center ${
                id === intent.ambition
                  ? "text-emerald-700 dark:text-emerald-300 font-semibold"
                  : ""
              }`}
            >
              {AMBITION_PRESETS[id].label}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-600 dark:text-neutral-400">
          {ambition.caption} Targets {ambition.canopyTargetPercent}% canopy gain,
          NDVI +{ambition.ndviTarget.toFixed(2)}. ≈{" "}
          {formatCompact(
            Math.round(ambition.canopyTargetPercent * 0.012 * areaHa * 100),
          )}{" "}
          trees on roughly{" "}
          {(ambition.canopyTargetPercent * 0.012 * areaHa).toFixed(2)} ha.
        </p>
      </div>

      <hr className="border-gray-200 dark:border-neutral-800" />

      <BudgetSlider intent={intent} onIntentChange={onIntentChange} />

      <hr className="border-gray-200 dark:border-neutral-800" />

      <TimeHorizonSlider intent={intent} onIntentChange={onIntentChange} />
    </section>
  );
}

/**
 * Piecewise stops let us spread the slider's named markers evenly across the
 * track even when the underlying axis is non-linear (log for budgets, sparse
 * preset years for time horizons). `pct` is the visual position of `value` on
 * the slider; values between two adjacent stops are interpolated using
 * `mode === "log"` for monetary axes and linear interpolation otherwise.
 */
type SliderStop = { pct: number; value: number };

function valueFromPct(
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

/**
 * Smoothly biases label anchoring near the track edges so the leftmost label
 * aligns to the start and the rightmost to the end (with everything in between
 * roughly centred). Avoids the visual cut-off that `-translate-x-1/2` causes
 * for markers placed at 0% or 100%.
 */
function anchorTranslateX(pct: number): string {
  const ratio = Math.max(0, Math.min(100, pct)) / 100;
  return `${(-ratio * 100).toFixed(2)}%`;
}

function pctFromValue(
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

const BUDGET_SLIDER_MIN = 100_000;
const BUDGET_SLIDER_MAX = 50_000_000;

/** Tier presets are anchored at the 25% / 50% / 75% slider stops. */
const BUDGET_SLIDER_STOPS: SliderStop[] = [
  { pct: 0, value: BUDGET_SLIDER_MIN },
  { pct: 25, value: BUDGET_PRESETS.small.budgetPHP },
  { pct: 50, value: BUDGET_PRESETS.medium.budgetPHP },
  { pct: 75, value: BUDGET_PRESETS.large.budgetPHP },
  { pct: 100, value: BUDGET_SLIDER_MAX },
];

const BUDGET_SLIDER_TIERS: {
  id: Exclude<BudgetTier, "custom">;
  budgetPHP: number;
  pct: number;
}[] = [
  { id: "small", budgetPHP: BUDGET_PRESETS.small.budgetPHP, pct: 25 },
  { id: "medium", budgetPHP: BUDGET_PRESETS.medium.budgetPHP, pct: 50 },
  { id: "large", budgetPHP: BUDGET_PRESETS.large.budgetPHP, pct: 75 },
];

const BUDGET_TIER_LABELS: Record<Exclude<BudgetTier, "custom">, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

function snapBudget(budgetPHP: number): number {
  return Math.round(budgetPHP / 10_000) * 10_000; // snap to ₱10k
}

function nearestTier(budgetPHP: number): Exclude<BudgetTier, "custom"> | null {
  for (const t of BUDGET_SLIDER_TIERS) {
    if (Math.abs(budgetPHP - t.budgetPHP) <= t.budgetPHP * 0.04) return t.id;
  }
  return null;
}

function BudgetSlider({
  intent,
  onIntentChange,
}: Pick<SimulationInputsProps, "intent" | "onIntentChange">) {
  const resolved = resolveBudgetTier(intent.budgetTier, intent.customBudgetPHP);
  const currentBudget = resolved.budgetPHP;
  const pct = pctFromValue(BUDGET_SLIDER_STOPS, currentBudget, "log");

  const setBudget = (newBudgetPHP: number) => {
    const clamped = Math.max(
      BUDGET_SLIDER_MIN,
      Math.min(BUDGET_SLIDER_MAX, newBudgetPHP),
    );
    const tier = nearestTier(clamped);
    if (tier) {
      onIntentChange({ budgetTier: tier, customBudgetPHP: undefined });
    } else {
      onIntentChange({ budgetTier: "custom", customBudgetPHP: clamped });
    }
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-neutral-300">
        <span>
          Budget
          <HelpTip text="Programme cost cap (PHP). Anything above the cap is reported as 'budget binding' — the engine clamps the realized canopy gain so the spend stays within the cap." />
        </span>
        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
          <Wallet className="w-3.5 h-3.5" />
          {formatPHP(currentBudget)}
        </span>
      </label>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        aria-valuetext={`${formatPHP(currentBudget)} cap`}
        onChange={(e) =>
          setBudget(
            snapBudget(
              valueFromPct(
                BUDGET_SLIDER_STOPS,
                parseInt(e.target.value, 10),
                "log",
              ),
            ),
          )
        }
        className="w-full"
        style={{ accentColor: "#0f9d58" }}
      />
      <div className="relative h-5 -mt-2 text-[10px] text-gray-500 dark:text-neutral-500">
        {BUDGET_SLIDER_TIERS.map((t) => {
          const isOn = intent.budgetTier === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-label={`Set budget to ${BUDGET_PRESETS[t.id].label}`}
              onClick={() =>
                onIntentChange({ budgetTier: t.id, customBudgetPHP: undefined })
              }
              className={`absolute top-0 whitespace-nowrap px-1.5 py-0.5 rounded transition-colors ${
                isOn
                  ? "text-emerald-700 dark:text-emerald-300 font-semibold"
                  : "hover:text-emerald-700 dark:hover:text-emerald-300"
              }`}
              style={{
                left: `${t.pct}%`,
                transform: `translateX(${anchorTranslateX(t.pct)})`,
              }}
            >
              {BUDGET_TIER_LABELS[t.id]} {formatPHP(t.budgetPHP)}
            </button>
          );
        })}
      </div>
      <CustomValueRow
        label="Custom amount"
        prefix="₱"
        min={BUDGET_SLIDER_MIN}
        max={BUDGET_SLIDER_MAX}
        step={100_000}
        value={currentBudget}
        inputWidthClass="w-44"
        onChange={(v) => setBudget(snapBudget(v))}
      />
      <p className="text-xs text-gray-500 dark:text-neutral-500">
        Maintenance assumption: {resolved.maintenanceRatePct}%/yr · unit cost
        comes from the chosen intervention.
      </p>
    </div>
  );
}

const TIME_HORIZON_MIN = 1;
const TIME_HORIZON_MAX = 25;
/** Year presets anchored to even visual stops (0/25/50/75/100%). */
const TIME_HORIZON_STOPS: SliderStop[] = [
  { pct: 0, value: TIME_HORIZON_MIN },
  { pct: 25, value: 3 },
  { pct: 50, value: 5 },
  { pct: 75, value: 10 },
  { pct: 100, value: TIME_HORIZON_MAX },
];

const TIME_HORIZON_TIERS: { value: TimeHorizon; pct: number }[] =
  TIME_HORIZON_STOPS.map((s) => ({ value: s.value as TimeHorizon, pct: s.pct }));

function TimeHorizonSlider({
  intent,
  onIntentChange,
}: Pick<SimulationInputsProps, "intent" | "onIntentChange">) {
  const horizon = Math.max(
    TIME_HORIZON_MIN,
    Math.min(TIME_HORIZON_MAX, Math.round(intent.timeHorizon)),
  );
  const pct = pctFromValue(TIME_HORIZON_STOPS, horizon, "linear");

  const setHorizon = (years: number) => {
    const v = Math.max(
      TIME_HORIZON_MIN,
      Math.min(TIME_HORIZON_MAX, Math.round(years)),
    );
    onIntentChange({ timeHorizon: v });
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-neutral-300">
        <span>
          Projection horizon
          <HelpTip text="Years over which the simulation projects benefits and lifecycle costs. Longer horizons reveal compounding co-benefits; shorter ones emphasise quick wins." />
        </span>
        <span className="text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
          {horizon} {horizon === 1 ? "year" : "years"}
        </span>
      </label>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        aria-valuetext={`${horizon} year horizon`}
        onChange={(e) =>
          setHorizon(
            valueFromPct(
              TIME_HORIZON_STOPS,
              parseInt(e.target.value, 10),
              "linear",
            ),
          )
        }
        className="w-full"
        style={{ accentColor: "#0f9d58" }}
      />
      <div className="relative h-5 -mt-2 text-[10px] text-gray-500 dark:text-neutral-500">
        {TIME_HORIZON_TIERS.map((tier) => {
          const selected = horizon === tier.value;
          return (
            <button
              key={tier.value}
              type="button"
              aria-label={`Set time horizon to ${tier.value} years`}
              onClick={() => setHorizon(tier.value)}
              className={`absolute top-0 whitespace-nowrap px-1.5 py-0.5 rounded transition-colors ${
                selected
                  ? "text-emerald-700 dark:text-emerald-300 font-semibold"
                  : "hover:text-emerald-700 dark:hover:text-emerald-300"
              }`}
              style={{
                left: `${tier.pct}%`,
                transform: `translateX(${anchorTranslateX(tier.pct)})`,
              }}
            >
              {tier.value} {tier.value === 1 ? "yr" : "yrs"}
            </button>
          );
        })}
      </div>
      <CustomValueRow
        label="Custom horizon"
        suffix="yrs"
        min={TIME_HORIZON_MIN}
        max={TIME_HORIZON_MAX}
        step={1}
        value={horizon}
        inputWidthClass="w-24"
        onChange={setHorizon}
      />
    </div>
  );
}

/**
 * Shared "Custom amount" row used by both the Budget and Projection-horizon
 * sliders so the two controls present identically: a label, a numeric input,
 * and the unit (₱ prefix or yrs suffix). The input is always visible — the
 * slider tracks any number the user types, no toggle required.
 */
function CustomValueRow({
  label,
  prefix,
  suffix,
  min,
  max,
  step,
  value,
  onChange,
  inputWidthClass = "w-32",
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (next: number) => void;
  inputWidthClass?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-neutral-300">
      <span className="font-medium uppercase tracking-wide text-[10px] text-gray-500 dark:text-neutral-500">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {prefix && (
          <span className="text-sm text-gray-500 dark:text-neutral-400">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          className={`${inputWidthClass} border border-gray-300 dark:border-neutral-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-neutral-950 text-gray-800 dark:text-neutral-100 tabular-nums`}
        />
        {suffix && (
          <span className="text-sm text-gray-500 dark:text-neutral-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ReviewStep({
  intent,
  baseline,
  inputs,
}: SimulationInputsProps) {
  const climate = CLIMATE_PRESETS[intent.climateFuture];
  const ambition = AMBITION_PRESETS[intent.ambition];
  const strategy = STRATEGY_LABELS[intent.strategy];
  const budget = resolveBudgetTier(intent.budgetTier, intent.customBudgetPHP);

  const summary = [
    { label: "Climate future", value: `${climate.label} (${climate.description})` },
    { label: "Strategy", value: `${strategy.label} — ${strategy.tagline}` },
    {
      label: "Ambition",
      value: `${ambition.label} · ${ambition.canopyTargetPercent}% canopy, NDVI +${ambition.ndviTarget.toFixed(2)}`,
    },
    {
      label: "Budget & horizon",
      value: `${budget.label} · ${intent.timeHorizon} year${intent.timeHorizon > 1 ? "s" : ""}`,
    },
  ];

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <Sparkles className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Review and run</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-neutral-400">
          Here&apos;s the scenario we&apos;ll model for{" "}
          <strong>{baseline.name ?? "this barangay"}</strong>. The Run button
          fetches the grounded narrative and citations from the study library.
        </p>
      </header>

      <ul className="rounded-xl border border-gray-200 dark:border-neutral-800 divide-y divide-gray-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
        {summary.map((row) => (
          <li
            key={row.label}
            className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 px-4 py-3"
          >
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500 md:w-40">
              {row.label}
            </div>
            <div className="text-sm text-gray-800 dark:text-neutral-100 flex-1">
              {row.value}
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5 px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold">
          Resolved engine inputs
        </div>
        <pre className="text-xs text-gray-700 dark:text-neutral-300 mt-2 whitespace-pre-wrap font-mono leading-5">
{`canopy_target_percent: ${inputs.canopy_target_percent}%
ndvi_target:           +${inputs.ndvi_target}
intervention_type:     ${inputs.intervention_type}
flood_severity:        ${inputs.flooding_severity}
temp_increase:         ${inputs.temperature_increase_rate} °C/yr
rainfall_change:       ${inputs.rainfall_change_rate}%/yr
budget_cap_PHP:        ${inputs.total_budget_cap.toLocaleString()}
cost_per_sqm:          ₱${inputs.cost_per_sqm}
maintenance_rate:      ${inputs.maintenance_cost_rate}%/yr
time_horizon:          ${inputs.time_horizon} years`}
        </pre>
      </div>
    </section>
  );
}

function AdvancedDrawer({
  inputs,
  onAdvancedChange,
}: Pick<SimulationInputsProps, "inputs" | "onAdvancedChange">) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-sm font-medium bg-gray-50 dark:bg-neutral-950 hover:bg-gray-100 dark:hover:bg-neutral-900"
      >
        <span className="flex items-center gap-2 text-gray-700 dark:text-neutral-300">
          <SlidersIcon /> Advanced parameters
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>
      {open && (
        <div className="p-4 space-y-3 text-sm bg-white dark:bg-neutral-900">
          <p className="text-xs text-gray-500 dark:text-neutral-500">
            Override any preset value. Changes here will mark the matching
            simple control as &quot;custom&quot; until you pick a preset again.
          </p>

          <NumericRow
            label="Temperature increase (°C/yr)"
            value={inputs.temperature_increase_rate}
            min={0}
            max={0.2}
            step={0.005}
            onChange={(v) => onAdvancedChange("temperature_increase_rate", v)}
          />
          <NumericRow
            label="Rainfall change (%/yr)"
            value={inputs.rainfall_change_rate}
            min={-30}
            max={50}
            step={1}
            onChange={(v) => onAdvancedChange("rainfall_change_rate", v)}
          />
          <SelectRow
            label="Flood severity"
            value={inputs.flooding_severity}
            options={["low", "medium", "high"]}
            onChange={(v) =>
              onAdvancedChange(
                "flooding_severity",
                v as SimulationInputsState["flooding_severity"],
              )
            }
          />
          <NumericRow
            label="Canopy target (%)"
            value={inputs.canopy_target_percent}
            min={0}
            max={70}
            step={1}
            onChange={(v) => onAdvancedChange("canopy_target_percent", v)}
          />
          <NumericRow
            label="NDVI target gain"
            value={inputs.ndvi_target}
            min={0}
            max={0.5}
            step={0.01}
            onChange={(v) => onAdvancedChange("ndvi_target", v)}
          />
          <NumericRow
            label="Cost per m² (PHP)"
            value={inputs.cost_per_sqm}
            min={50}
            max={5000}
            step={50}
            onChange={(v) => onAdvancedChange("cost_per_sqm", v)}
          />
          <NumericRow
            label="Maintenance rate (%/yr)"
            value={inputs.maintenance_cost_rate}
            min={0}
            max={25}
            step={1}
            onChange={(v) => onAdvancedChange("maintenance_cost_rate", v)}
          />
        </div>
      )}
    </div>
  );
}

function SlidersIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function NumericRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
      <label className="text-xs text-gray-600 dark:text-neutral-400">
        {label}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-32 text-right border border-gray-300 dark:border-neutral-700 rounded px-2 py-1 bg-white dark:bg-neutral-950 text-gray-800 dark:text-neutral-100"
      />
    </div>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
      <label className="text-xs text-gray-600 dark:text-neutral-400">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-32 border border-gray-300 dark:border-neutral-700 rounded px-2 py-1 bg-white dark:bg-neutral-950 text-gray-800 dark:text-neutral-100"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function readFeatureName(feature: Feature<Geometry | null>): string {
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

function geometryRings(geometry: Geometry | null | undefined): Position[][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

function featureBounds(rings: Position[][]) {
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

function ringPath(ring: Position[], bounds: NonNullable<ReturnType<typeof featureBounds>>) {
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

function BarangayDetailMap() {
  const { simulationBarangay } = useBarangay();
  const geoData = useGeoData((state) => state.geoData);

  if (!simulationBarangay || !geoData) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-xl border border-gray-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-500">
        Select a barangay first.
      </div>
    );
  }

  const targetName = simulationBarangay.name.toLowerCase();
  const feature = geoData.features.find(
    (f: Feature<Geometry | null>) => readFeatureName(f).toLowerCase() === targetName,
  ) as Feature<Geometry | null> | undefined;
  const rings = geometryRings(feature?.geometry);
  const bounds = featureBounds(rings);

  if (!feature || !bounds) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-xl border border-gray-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-4 text-center text-sm text-neutral-500">
        Selected barangay geometry not found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-neutral-900 shadow-sm">
      <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-500/20 px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-neutral-100">
            {simulationBarangay.name}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-neutral-400">
            Barangay boundary preview
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
          inline
        </span>
      </div>
      <svg
        viewBox="0 0 300 180"
        role="img"
        aria-label={`${simulationBarangay.name} boundary preview`}
        className="h-48 w-full bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/5"
      >
        <defs>
          <pattern id="simulation-map-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="rgba(16, 185, 129, 0.12)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="300" height="180" fill="url(#simulation-map-grid)" />
        {rings.map((ring, index) => (
          <path
            key={index}
            d={ringPath(ring, bounds)}
            fill="rgba(16, 185, 129, 0.45)"
            stroke="#047857"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

function BaselineCard({ baseline }: { baseline: SimulationBaselineData }) {
  return (
    <div className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4 bg-emerald-50/60 dark:bg-emerald-500/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-neutral-100">
          Current baseline
        </h3>
        <Info className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="NDVI" value={baseline.ndvi.toFixed(3)} />
        <Stat label="LST" value={`${baseline.lst.toFixed(1)}°C`} />
        <Stat label="Canopy" value={`${baseline.canopyCover}`} />
        <Stat
          label="Greenery Index"
          value={baseline.greeneryIndex.toFixed(3)}
        />
        <Stat label="Flood" value={baseline.floodExposure} />
        <Stat
          label="Area"
          value={`${(baseline.areaHectares ?? 0).toFixed(1)} ha`}
        />
      </div>
      <div className="mt-3 text-xs text-gray-600 dark:text-neutral-400 border-t border-emerald-200/60 dark:border-emerald-500/20 pt-2">
        Current strategy:{" "}
        <strong className="text-gray-800 dark:text-neutral-100">
          {baseline.currentIntervention}
        </strong>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-neutral-950 rounded-md p-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-neutral-500">
        {label}
      </div>
      <div className="text-sm font-semibold text-gray-800 dark:text-neutral-100">
        {value}
      </div>
    </div>
  );
}

const SimulationInputs = (props: SimulationInputsProps) => {
  const { step, baseline } = props;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {step === "climate" && <ClimateStep {...props} />}
        {step === "strategy" && <StrategyStep {...props} />}
        {step === "ambitionBudget" && <AmbitionBudgetStep {...props} />}
        {step === "review" && <ReviewStep {...props} />}

        <AdvancedDrawer {...props} />
      </div>

      <div className="lg:col-span-1 space-y-4">
        <BarangayDetailMap />
        <BaselineCard baseline={baseline} />
      </div>
    </div>
  );
};

export default SimulationInputs;
