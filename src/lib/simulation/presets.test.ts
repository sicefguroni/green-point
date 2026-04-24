import { describe, expect, it } from "vitest";
import {
  AMBITION_PRESETS,
  BUDGET_PRESETS,
  CLIMATE_PRESETS,
  defaultClimateFromBaseline,
  intentFromInputs,
  interventionCostPerSqm,
  resolveBudgetTier,
  resolveIntent,
  strategyMismatchReason,
  suggestStrategy,
} from "./presets";
import type { SimulationIntent } from "@/components/ui/simulation/simulation-types";

describe("presets.resolveIntent", () => {
  it("maps moderate ambition + medium budget + warming climate to expected raw inputs", () => {
    const intent: SimulationIntent = {
      climateFuture: "warming",
      strategy: "urban canopy",
      ambition: "moderate",
      budgetTier: "medium",
      timeHorizon: 5,
    };
    const r = resolveIntent(intent);
    expect(r.canopy_target_percent).toBe(
      AMBITION_PRESETS.moderate.canopyTargetPercent,
    );
    expect(r.ndvi_target).toBe(AMBITION_PRESETS.moderate.ndviTarget);
    expect(r.total_budget_cap).toBe(BUDGET_PRESETS.medium.budgetPHP);
    // Unit cost now comes from the intervention's coefficients, not the budget tier.
    expect(r.cost_per_sqm).toBe(interventionCostPerSqm("urban canopy"));
    expect(r.temperature_increase_rate).toBe(
      CLIMATE_PRESETS.warming.temperatureIncreaseRate,
    );
    expect(r.intervention_type).toBe("urban canopy");
    expect(r.time_horizon).toBe(5);
  });

  it("uses rain-garden unit cost for a rain-garden intent", () => {
    const r = resolveIntent({
      climateFuture: "severe",
      strategy: "rain garden",
      ambition: "moderate",
      budgetTier: "medium",
      timeHorizon: 5,
    });
    expect(r.cost_per_sqm).toBe(interventionCostPerSqm("rain garden"));
    expect(r.cost_per_sqm).toBeGreaterThan(interventionCostPerSqm("urban canopy"));
  });

  it("custom budget tier honours customBudgetPHP", () => {
    const r = resolveIntent({
      climateFuture: "stable",
      strategy: "urban canopy",
      ambition: "light",
      budgetTier: "custom",
      customBudgetPHP: 250_000,
      timeHorizon: 3,
    });
    expect(r.total_budget_cap).toBe(250_000);
  });

  it("forces high flood when baseline floodExposure is High and climate isn't severe", () => {
    const r = resolveIntent(
      {
        climateFuture: "stable",
        strategy: "rain garden",
        ambition: "moderate",
        budgetTier: "small",
        timeHorizon: 3,
      },
      { floodExposure: "High" },
    );
    expect(r.flooding_severity).toBe("high");
  });
});

describe("presets.intentFromInputs", () => {
  it("round-trips a known preset combo", () => {
    const intent: SimulationIntent = {
      climateFuture: "severe",
      strategy: "urban canopy",
      ambition: "ambitious",
      budgetTier: "large",
      timeHorizon: 10,
    };
    const raw = resolveIntent(intent);
    const back = intentFromInputs(raw);
    expect(back.climateFuture).toBe("severe");
    expect(back.strategy).toBe("urban canopy");
    expect(back.ambition).toBe("ambitious");
    expect(back.budgetTier).toBe("large");
    expect(back.timeHorizon).toBe(10);
  });
});

describe("presets.suggestStrategy", () => {
  it("suggests rain garden for high flood + cool baseline", () => {
    expect(
      suggestStrategy({
        lst: 30,
        floodExposure: "High",
        treeCanopy: 30,
      }),
    ).toBe("rain garden");
  });

  it("suggests urban canopy for hot + bare baseline", () => {
    expect(
      suggestStrategy({ lst: 35, floodExposure: "Low", treeCanopy: 10 }),
    ).toBe("urban canopy");
  });
});

describe("presets.strategyMismatchReason", () => {
  it("flags rain garden as mismatched in low-flood baselines", () => {
    expect(
      strategyMismatchReason("rain garden", {
        lst: 30,
        floodExposure: "Low",
        treeCanopy: 25,
      }),
    ).not.toBeNull();
  });
  it("does not flag urban canopy in low-canopy baseline", () => {
    expect(
      strategyMismatchReason("urban canopy", {
        lst: 34,
        floodExposure: "Low",
        treeCanopy: 12,
      }),
    ).toBeNull();
  });
});

describe("presets.resolveBudgetTier and defaultClimateFromBaseline", () => {
  it("resolveBudgetTier custom clamps to a sane minimum", () => {
    const b = resolveBudgetTier("custom", 1_000);
    expect(b.budgetPHP).toBeGreaterThanOrEqual(100_000);
  });
  it("defaultClimateFromBaseline returns severe for high flood", () => {
    expect(defaultClimateFromBaseline({ floodExposure: "Very High" })).toBe(
      "severe",
    );
  });
});
