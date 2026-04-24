"use client";

import { useEffect, useMemo, useState } from "react";
import { runSimulationEngine } from "@/lib/simulation/engine";
import type {
  SimulationBaselineData,
  SimulationEstimates,
  SimulationInputsState,
} from "./simulation-types";

/**
 * Runs the deterministic engine in the browser on every input/baseline change,
 * debounced. Powers the sticky preview footer in the stepper so users see
 * outcome estimates instantly without paying for an LLM round-trip.
 */
export function useLivePreview(
  inputs: SimulationInputsState,
  baseline: SimulationBaselineData,
  debounceMs = 150,
): SimulationEstimates {
  const initial = useMemo(
    () => runSimulationEngine({ inputs, baseline }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [estimates, setEstimates] = useState<SimulationEstimates>(initial);

  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        setEstimates(runSimulationEngine({ inputs, baseline }));
      } catch (err) {
        console.warn("Live preview engine failed:", err);
      }
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [inputs, baseline, debounceMs]);

  return estimates;
}
