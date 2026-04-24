import { describe, expect, it } from "vitest";
import { runSimulationEngine } from "./engine";
import type {
  SimulationBaselineData,
  SimulationInputsState,
} from "@/components/ui/simulation/simulation-types";

function baseline(
  overrides: Partial<SimulationBaselineData> = {},
): SimulationBaselineData {
  return {
    name: "Test Barangay",
    ndvi: 0.4,
    lst: 33,
    floodExposure: "Medium",
    greeneryIndex: 0.55,
    canopyCover: 25,
    currentIntervention: "Urban Canopy",
    areaHectares: 50,
    ...overrides,
  };
}

function inputs(
  overrides: Partial<SimulationInputsState> = {},
): SimulationInputsState {
  return {
    temperature_increase_rate: 0.03,
    flooding_severity: "medium",
    rainfall_change_rate: 5,
    canopy_target_percent: 15,
    ndvi_target: 0.1,
    intervention_type: "urban canopy",
    total_budget_cap: 50_000_000,
    cost_per_sqm: 35,
    maintenance_cost_rate: 8,
    time_horizon: 5,
    ...overrides,
  };
}

describe("runSimulationEngine", () => {
  it("zero-canopy target produces only climate drift on LST and no greening gain", () => {
    const r = runSimulationEngine({
      inputs: inputs({ canopy_target_percent: 0, ndvi_target: 0 }),
      baseline: baseline(),
    });
    const lst = r.metrics.find((m) => m.key === "lst")!;
    expect(lst.delta).toBeCloseTo(0.03 * 5, 5); // +climate drift
    const canopy = r.metrics.find((m) => m.key === "canopy")!;
    expect(canopy.delta).toBe(0);
    expect(r.warnings.some((w) => /No canopy gain/.test(w))).toBe(true);
  });

  it("flagged budgetBinding when budget cannot cover treated area", () => {
    const r = runSimulationEngine({
      inputs: inputs({
        canopy_target_percent: 50,
        total_budget_cap: 100_000,
        cost_per_sqm: 1000,
      }),
      baseline: baseline({ areaHectares: 100 }),
    });
    expect(r.costProjection.budgetBinding).toBe(true);
    expect(r.costProjection.realizedCanopyPercent).toBeLessThan(50);
    expect(r.warnings.some((w) => /Budget caps/.test(w))).toBe(true);
  });

  it("rain garden outperforms urban canopy on stormwater under high flooding at an equal m² treated", () => {
    // Tight budget forces both interventions to the same treated area, so the
    // comparison isolates per-m² retention coefficient (rain garden ≫ canopy).
    const baseInputs = inputs({
      flooding_severity: "high",
      rainfall_change_rate: 20,
      canopy_target_percent: 20,
      total_budget_cap: 200_000,
      cost_per_sqm: 35,
    });
    const canopyRun = runSimulationEngine({
      inputs: { ...baseInputs, intervention_type: "urban canopy" },
      baseline: baseline(),
    });
    const rainRun = runSimulationEngine({
      inputs: { ...baseInputs, intervention_type: "rain garden" },
      baseline: baseline(),
    });
    const cStorm = canopyRun.metrics.find((m) => m.key === "stormwater")!;
    const rStorm = rainRun.metrics.find((m) => m.key === "stormwater")!;
    expect(rStorm.projected).toBeGreaterThan(cStorm.projected);
  });

  it("GI evolution is monotonic non-decreasing when no climate drift", () => {
    const r = runSimulationEngine({
      inputs: inputs({
        temperature_increase_rate: 0,
        canopy_target_percent: 25,
        time_horizon: 10,
      }),
      baseline: baseline(),
    });
    for (let i = 1; i < r.giEvolution.length; i++) {
      expect(r.giEvolution[i].gi_score).toBeGreaterThanOrEqual(
        r.giEvolution[i - 1].gi_score - 1e-6,
      );
    }
  });

  it("returns structured low/high bands for every metric", () => {
    const r = runSimulationEngine({ inputs: inputs(), baseline: baseline() });
    for (const m of r.metrics) {
      expect(m.low).toBeLessThanOrEqual(m.high);
    }
  });

  it("sensitivity ranks canopy_target_percent at the top for greening-heavy scenario", () => {
    const r = runSimulationEngine({
      inputs: inputs({
        canopy_target_percent: 30,
        // Large budget so canopy isn't budget-bound and is the dominant lever.
        total_budget_cap: 200_000_000,
      }),
      baseline: baseline(),
    });
    expect(r.sensitivity[0].input).toBe("canopy_target_percent");
  });

  it("aggregates barangay totals scale with areaHectares (when budget allows)", () => {
    const ample = inputs({ total_budget_cap: 500_000_000 });
    const small = runSimulationEngine({
      inputs: ample,
      baseline: baseline({ areaHectares: 10 }),
    });
    const big = runSimulationEngine({
      inputs: ample,
      baseline: baseline({ areaHectares: 200 }),
    });
    const smallTrees = small.barangayTotals.find((t) => t.key === "trees")!;
    const bigTrees = big.barangayTotals.find((t) => t.key === "trees")!;
    expect(bigTrees.value).toBeGreaterThan(smallTrees.value * 5);
  });
});
