"use client";

import { Info, Wallet } from "lucide-react";
import { formatPHP } from "@/lib/format-number";
import { BUDGET_PRESETS, resolveBudgetTier } from "@/lib/simulation/presets";
import type { SimulationIntent } from "../simulation-types";
import {
  BUDGET_SLIDER_MIN,
  BUDGET_SLIDER_MAX,
  BUDGET_SLIDER_STOPS,
  BUDGET_SLIDER_TIERS,
  BUDGET_TIER_LABELS,
  TIME_HORIZON_MIN,
  TIME_HORIZON_MAX,
  TIME_HORIZON_STOPS,
  TIME_HORIZON_TIERS,
  pctFromValue,
  valueFromPct,
  snapBudget,
  nearestTier,
  anchorTranslateX,
} from "../lib/simulation-input-utils";

// ── HelpTip ───────────────────────────────────────────────────────────────

export function HelpTip({ text }: { text: string }) {
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

// ── Icon for the sliders header ───────────────────────────────────────────

export function SlidersIcon() {
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

// ── CustomValueRow: shared numeric input row ──────────────────────────────

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

// ── NumericRow / SelectRow (Advanced drawer inputs) ───────────────────────

export function NumericRow({
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

export function SelectRow({
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

// ── Stat (label/value pair for BaselineCard) ──────────────────────────────

export function Stat({ label, value }: { label: string; value: string }) {
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

// ── BudgetSlider ──────────────────────────────────────────────────────────

export function BudgetSlider({
  intent,
  onIntentChange,
}: {
  intent: SimulationIntent;
  onIntentChange: (partial: Partial<SimulationIntent>) => void;
}) {
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

// ── TimeHorizonSlider ─────────────────────────────────────────────────────

export function TimeHorizonSlider({
  intent,
  onIntentChange,
}: {
  intent: SimulationIntent;
  onIntentChange: (partial: Partial<SimulationIntent>) => void;
}) {
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
