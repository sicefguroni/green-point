import { describe, expect, it } from "vitest";
import { runSimulationEngine } from "./engine";
import { MATURE_CROWN_AREA_M2 } from "./coefficients";
import { canonicalLifecycleCost } from "./cost-model";
import { buildCanonicalInputs, evaluateStrategies } from "./evaluate-strategies";
import { resolveIntent } from "./presets";
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
    expect(r.warnings.some((w) => /No greening target/.test(w))).toBe(true);
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
    expect(r.costProjection.realizedTargetPercent).toBeLessThan(50);
    expect(r.warnings.some((w) => /Budget funds about/.test(w))).toBe(true);
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

/** QA §3.5: Mantuyong, Rain Garden, moderate ambition — 13 ha, no canopy, 21 trees. */
const mantuyong = baseline({
  name: "Mantuyong",
  ndvi: 0.18,
  lst: 33.4,
  floodExposure: "High",
  greeneryIndex: 0.232,
  canopyCover: 0,
  areaHectares: 13,
});

function defaultRun(strategy: Parameters<typeof buildCanonicalInputs>[0], b = mantuyong) {
  const intent = {
    climateFuture: "warming" as const,
    strategy,
    ambition: "moderate" as const,
    budgetTier: "medium" as const,
    timeHorizon: 5,
  };
  return runSimulationEngine({ inputs: resolveIntent(intent, b), baseline: b });
}

describe("runSimulationEngine — consistency regressions", () => {
  it("derives tree canopy from the trees planted instead of echoing the target", () => {
    const r = defaultRun("rain garden");
    const canopy = r.metrics.find((m) => m.key === "canopy")!;
    const treated = r.barangayTotals.find((t) => t.key === "treatedArea")!.value;
    const trees = r.barangayTotals.find((t) => t.key === "trees")!.value;
    // 0.29 ha treated of 13 ha can't add 15 points of canopy (old engine did).
    expect(treated).toBeCloseTo(2925, -1);
    expect(trees).toBe(20);
    expect(canopy.delta).toBeLessThan(1);
    expect(canopy.delta).toBeCloseTo((trees * MATURE_CROWN_AREA_M2) / (13 * 10_000) * 100, 0);
    expect(r.costProjection.realizedCanopyPercent).toBe(canopy.delta);
    expect(r.costProjection.realizedTargetPercent).toBe(15);
  });

  it("adds no tree canopy for interventions that plant no trees", () => {
    for (const strategy of ["green roof", "vertical greening", "permeable surface"] as const) {
      const canopy = defaultRun(strategy).metrics.find((m) => m.key === "canopy")!;
      expect(canopy.delta).toBe(0);
      expect(canopy.note).toMatch(/no tree canopy/);
    }
  });

  it("never reports more canopy than the treated share of the site", () => {
    const r = runSimulationEngine({
      inputs: inputs({ canopy_target_percent: 40, total_budget_cap: 1e12 }),
      baseline: baseline({ canopyCover: 0 }),
    });
    const canopy = r.metrics.find((m) => m.key === "canopy")!;
    const treatedPct = (r.barangayTotals.find((t) => t.key === "treatedArea")!.value / (50 * 10_000)) * 100;
    expect(canopy.delta).toBeLessThanOrEqual(treatedPct + 1e-6);
  });

  it("ends the GI chart on the headline score and starts it on the measured GI", () => {
    for (const horizon of [1, 5, 12]) {
      const r = runSimulationEngine({
        inputs: inputs({ intervention_type: "rain garden", time_horizon: horizon }),
        baseline: mantuyong,
      });
      const last = r.giEvolution[r.giEvolution.length - 1];
      expect(last.year).toBe(horizon);
      expect(last.gi_score).toBe(r.finalGI.gi_score);
      expect(r.metrics.find((m) => m.key === "gi")!.projected).toBe(r.finalGI.gi_score);
      expect(r.giEvolution[0].gi_score).toBeCloseTo(mantuyong.greeneryIndex, 3);
    }
  });

  it("prices the same lifecycle total as the cost card and the dashboard", () => {
    // Within budget, the default simulation prices exactly what the card does.
    for (const strategy of ["rain garden", "urban canopy", "wetland restoration"] as const) {
      const r = defaultRun(strategy);
      expect(r.costProjection.budgetBinding).toBe(false);
      expect(r.costProjection.totalPHP).toBe(canonicalLifecycleCost(strategy, 13));
    }
    // Every strategy, uncapped (the dashboard's inputs), matches too.
    for (const ev of evaluateStrategies(mantuyong)) {
      expect(ev.costPHP).toBe(canonicalLifecycleCost(ev.strategy, 13));
    }
  });

  it("caps an over-budget plan and says so, rather than pricing past the cap", () => {
    // Pocket park on 13 ha needs ~₱15M at moderate ambition; the medium tier is ₱5M.
    const r = defaultRun("pocket park");
    expect(r.costProjection.budgetBinding).toBe(true);
    expect(r.costProjection.capex).toBeLessThanOrEqual(5_000_000);
    expect(r.costProjection.realizedTargetPercent).toBeLessThan(15);
    expect(r.warnings.some((w) => /Budget funds about/.test(w))).toBe(true);
  });

  it("gives the dashboard row and the Simulate modal the same numbers", () => {
    const ranked = evaluateStrategies(mantuyong);
    for (const ev of ranked) {
      const inputsForModal = { ...buildCanonicalInputs(ev.strategy, mantuyong) };
      const r = runSimulationEngine({ inputs: inputsForModal, baseline: mantuyong });
      expect(ev.costPHP).toBe(r.costProjection.totalPHP);
      expect(ev.canopyDeltaPct).toBe(r.metrics.find((m) => m.key === "canopy")!.delta);
      expect(ev.pm25KgPerYear).toBe(r.metrics.find((m) => m.key === "pm25")!.projected);
      expect(ev.coolingDeltaC).toBe(-r.effects.coolingC.mid);
    }
    // QA §3.6: "Canopy Δ" was 15.0 for every barangay and strategy.
    expect(new Set(ranked.map((e) => e.canopyDeltaPct)).size).toBeGreaterThan(3);
  });

  it("splits LST into the greening effect and climate drift", () => {
    const r = defaultRun("rain garden");
    const lst = r.metrics.find((m) => m.key === "lst")!;
    expect(lst.delta).toBeCloseTo(r.effects.climateDriftC - r.effects.coolingC.mid, 2);
    expect(lst.note).toMatch(/Greening −0\.\d+°C/);
    expect(lst.note).toMatch(/climate drift \+/);
  });
});
