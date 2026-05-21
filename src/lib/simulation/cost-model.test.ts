import { describe, expect, it } from "vitest";
import {
  STRATEGY_COST_SPECS,
  basePricePerSqm,
  estimateCost,
  resolveStrategyKey,
} from "./cost-model";

describe("cost-model: mandaue base prices", () => {
  it("matches the updated mandaue planning estimates for canonical strategies", () => {
    expect(STRATEGY_COST_SPECS["urban canopy"].basePrice).toBe(1_200);
    expect(STRATEGY_COST_SPECS["urban canopy"].unit).toBe("tree");

    expect(STRATEGY_COST_SPECS["targeted infill"].basePrice).toBe(1_200);
    expect(STRATEGY_COST_SPECS["targeted infill"].unit).toBe("tree");

    expect(STRATEGY_COST_SPECS["green roof"].basePrice).toBe(3_500);
    expect(STRATEGY_COST_SPECS["green roof"].unit).toBe("sqm");

    expect(STRATEGY_COST_SPECS["vertical greening"].basePrice).toBe(9_000);
    expect(STRATEGY_COST_SPECS["vertical greening"].unit).toBe("sqm");

    expect(STRATEGY_COST_SPECS["green corridor"].basePrice).toBe(12_000);
    expect(STRATEGY_COST_SPECS["green corridor"].unit).toBe("linear-m");

    expect(STRATEGY_COST_SPECS["rain garden"].basePrice).toBe(3_500);
    expect(STRATEGY_COST_SPECS["rain garden"].unit).toBe("installation");

    expect(STRATEGY_COST_SPECS["permeable surface"].basePrice).toBe(2_800);
    expect(STRATEGY_COST_SPECS["permeable surface"].unit).toBe("sqm");

    expect(STRATEGY_COST_SPECS["riparian buffer"].basePrice).toBe(2_000);
    expect(STRATEGY_COST_SPECS["riparian buffer"].unit).toBe("linear-m");

    expect(STRATEGY_COST_SPECS["wetland restoration"].basePrice).toBe(75_000);
    expect(STRATEGY_COST_SPECS["wetland restoration"].unit).toBe("hectare");
  });

  it("derives a sensible per-m² rate for each strategy", () => {
    // Effective per-m² rates = basePrice × unitsPerSqm.
    expect(basePricePerSqm("urban canopy")).toBeCloseTo(14.4, 1); // 1,200 × 0.012
    expect(basePricePerSqm("green roof")).toBe(3_500);
    expect(basePricePerSqm("permeable surface")).toBe(2_800);
    expect(basePricePerSqm("riparian buffer")).toBeCloseTo(200, 0); // 2,000 / 10m width = 200/m²
    expect(basePricePerSqm("rain garden")).toBeCloseTo(140, 0); // 3,500 / 25
    expect(basePricePerSqm("wetland restoration")).toBeCloseTo(7.5, 1); // 75k / 10k
  });
});

describe("cost-model: estimateCost", () => {
  it("matches the lifecycle formula for a 1-ha urban canopy site (5yr default)", () => {
    const e = estimateCost("urban canopy", 10_000, 1);
    expect(e.unit).toBe("tree");
    // 10,000 m² × 0.012 trees/m² = 120 trees
    expect(e.quantity).toBe(120);
    // CAPEX = 1,200 × 120 = 144,000 PHP
    expect(e.capitalCost).toBe(144_000);
    // Maintenance = 144,000 × 5% × 5 = 36,000 PHP
    expect(e.breakdown.maintenance).toBe(36_000);
    // Total = 144,000 + 36,000 = 180,000 PHP
    expect(e.totalEstimate).toBe(180_000);
    // Materials = 50% of capex, labor = 35% of capex
    expect(e.breakdown.materials).toBe(72_000);
    expect(e.breakdown.labor).toBeCloseTo(50_400, -1);
    // Contingency = total − (materials + labor + maintenance) ≈ 15% of capex
    expect(e.breakdown.contingency).toBeGreaterThan(15_000);
    expect(e.breakdown.contingency).toBeLessThan(30_000);
  });

  it("scales rain-garden estimates by the engineered cell footprint", () => {
    const e = estimateCost("rain garden", 250, 1);
    // 250 m² ÷ 25 m²/cell = 10 installations × 3,500 PHP = 35,000 capex
    expect(e.unit).toBe("installation");
    expect(e.quantity).toBe(10);
    expect(e.capitalCost).toBe(35_000);
  });

  it("applies the location multiplier to capital, maintenance, and total", () => {
    const a = estimateCost("permeable surface", 100, 1);
    const b = estimateCost("permeable surface", 100, 1.2);
    expect(b.capitalCost).toBeCloseTo(a.capitalCost * 1.2, 0);
    expect(b.totalEstimate).toBeCloseTo(a.totalEstimate * 1.2, 0);
  });

  it("treats null area as a 1-hectare reference site", () => {
    const e = estimateCost("urban canopy", null);
    expect(e.area).toBeNull();
    expect(e.quantity).toBe(120); // same as 10,000 m² site
  });
});

describe("cost-model: resolveStrategyKey", () => {
  it("normalises wetland / mangrove restoration to wetland restoration strategy", () => {
    expect(resolveStrategyKey("Wetland Restoration")).toBe("wetland restoration");
    expect(resolveStrategyKey("Mangrove planting")).toBe("wetland restoration");
    expect(resolveStrategyKey("Mangrove forest restoration")).toBe("wetland restoration");
  });

  it("normalises rooftop garden phrasings to green roof", () => {
    expect(resolveStrategyKey("Rooftop garden installation")).toBe("green roof");
    expect(resolveStrategyKey("Rooftop greening")).toBe("green roof");
  });

  it("normalises green wall phrasings to vertical greening", () => {
    expect(resolveStrategyKey("Green wall installation")).toBe(
      "vertical greening",
    );
    expect(resolveStrategyKey("Living wall")).toBe("vertical greening");
  });
});
