"use client";

import { CloudSun } from "lucide-react";
import { CLIMATE_PRESETS } from "@/lib/simulation/presets";
import type { ClimateFuture, SimulationBaselineData, SimulationIntent } from "../simulation-types";

export function ClimateStep({
  intent,
  baseline,
  onIntentChange,
}: {
  intent: SimulationIntent;
  baseline: SimulationBaselineData;
  onIntentChange: (partial: Partial<SimulationIntent>) => void;
}) {
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
