"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SimulationInputsState } from "../simulation-types";
import { SlidersIcon, NumericRow, SelectRow } from "./SimulationSharedComponents";

export function AdvancedDrawer({
  inputs,
  onAdvancedChange,
}: {
  inputs: SimulationInputsState;
  onAdvancedChange: <K extends keyof SimulationInputsState>(
    key: K,
    value: SimulationInputsState[K],
  ) => void;
}) {
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
