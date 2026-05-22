"use client";

import { Sparkles } from "lucide-react";
import { AMBITION_PRESETS } from "@/lib/simulation/presets";
import { formatCompact } from "@/lib/format-number";
import type { SimulationBaselineData, SimulationIntent } from "../simulation-types";
import { HelpTip, BudgetSlider, TimeHorizonSlider } from "./SimulationSharedComponents";
import { AMBITION_ORDER } from "../lib/simulation-input-utils";

export function AmbitionBudgetStep({
  intent,
  baseline,
  onIntentChange,
}: {
  intent: SimulationIntent;
  baseline: SimulationBaselineData;
  onIntentChange: (partial: Partial<SimulationIntent>) => void;
}) {
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
