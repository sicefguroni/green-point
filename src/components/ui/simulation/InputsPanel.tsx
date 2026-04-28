"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  CloudSun,
  Trees,
  Droplets,
  Sparkles,
  Layers,
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
  suggestStrategy,
} from "@/lib/simulation/presets";
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

const BarangayDetailMap = dynamic(() => import("./BarangayDetailsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-48 w-full items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-500">
      Loading map…
    </div>
  ),
});

const STRATEGY_ICONS: Record<InterventionType, React.ReactNode> = {
  "urban canopy": <Trees className="w-6 h-6" />,
  "green corridor": <Layers className="w-6 h-6" />,
  "rain garden": <Droplets className="w-6 h-6" />,
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
  const suggestion = useMemo(() => suggestStrategy(baseline), [baseline]);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <Trees className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Pick a greening strategy</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-neutral-400">
          Choose the kind of intervention you want to model. Cards greyed out
          aren&apos;t a strong fit for this barangay&apos;s baseline — but you
          can still pick them.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {STRATEGY_IDS.map((id) => {
          const meta = STRATEGY_LABELS[id];
          const selected = intent.strategy === id;
          const mismatch = strategyMismatchReason(id, baseline);
          const isSuggested = suggestion === id;
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
              {isSuggested && !selected && (
                <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded">
                  <Wand2 className="w-3 h-3" />
                  Suggested
                </span>
              )}
              <div className="flex items-start gap-3">
                <span className="rounded-lg p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  {STRATEGY_ICONS[id]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 dark:text-neutral-100">
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

      <div className="space-y-3">
        <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-neutral-300">
          <span>
            Budget tier
            <HelpTip text="Programme cost cap. Includes planting + first-year setup; maintenance is added on top." />
          </span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(["small", "medium", "large", "custom"] as BudgetTier[]).map((id) => {
            const selected = intent.budgetTier === id;
            const label =
              id === "custom"
                ? "Custom"
                : BUDGET_PRESETS[id].label;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => onIntentChange({ budgetTier: id })}
                className={`rounded-lg border-2 px-3 py-2 text-sm transition-all flex items-center justify-center gap-1.5 ${
                  selected
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:border-emerald-300"
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
        {intent.budgetTier === "custom" && (
          <div className="space-y-1">
            <label className="text-xs text-gray-600 dark:text-neutral-400">
              Custom budget (PHP)
            </label>
            <input
              type="number"
              min={100_000}
              step={100_000}
              value={intent.customBudgetPHP ?? 5_000_000}
              onChange={(e) =>
                onIntentChange({
                  customBudgetPHP: Math.max(100_000, parseInt(e.target.value, 10) || 0),
                })
              }
              className="w-full border border-gray-300 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-950 text-gray-800 dark:text-neutral-100"
            />
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-neutral-500">
          Selected:{" "}
          {formatPHP(
            resolveBudgetTier(intent.budgetTier, intent.customBudgetPHP)
              .budgetPHP,
          )}{" "}
          cap ·{" "}
          {resolveBudgetTier(intent.budgetTier, intent.customBudgetPHP)
            .maintenanceRatePct}
          % maintenance/yr · unit cost set by chosen intervention
        </p>
      </div>

      <hr className="border-gray-200 dark:border-neutral-800" />

      <div className="space-y-3">
        <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-neutral-300">
          <span>
            Time horizon
            <HelpTip text="Longer horizons reveal whether benefits compound. Shorter horizons emphasise quick wins." />
          </span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {([1, 3, 5, 10] as TimeHorizon[]).map((y) => {
            const selected = intent.timeHorizon === y;
            return (
              <button
                key={y}
                type="button"
                aria-pressed={selected}
                onClick={() => onIntentChange({ timeHorizon: y })}
                className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                  selected
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:border-emerald-300"
                }`}
              >
                {y} {y === 1 ? "year" : "years"}
              </button>
            );
          })}
        </div>
      </div>
    </section>
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
