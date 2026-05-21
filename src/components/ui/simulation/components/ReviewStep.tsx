"use client";

import { Sparkles } from "lucide-react";
import { CLIMATE_PRESETS, AMBITION_PRESETS, STRATEGY_LABELS, resolveBudgetTier } from "@/lib/simulation/presets";
import type { SimulationBaselineData, SimulationInputsState, SimulationIntent } from "../simulation-types";

export function ReviewStep({
  intent,
  baseline,
  inputs,
}: {
  intent: SimulationIntent;
  baseline: SimulationBaselineData;
  inputs: SimulationInputsState;
}) {
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
