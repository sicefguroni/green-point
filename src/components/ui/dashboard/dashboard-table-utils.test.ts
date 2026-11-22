import { describe, expect, it } from "vitest";
import { canonicalLifecycleCost } from "@/lib/simulation/cost-model";
import type { InterventionType } from "@/lib/simulation/coefficients";
import { resolveRowDisplay, statusFromRating } from "./dashboard-table-utils";
import type { StrategyEvalLite, TableRow } from "./dashboard-table-types";
import type { AIRecommendation } from "./use-ai-recommendations";

const AREA_HA = 13;

const canopyEval: StrategyEvalLite = {
  costPHP: 900_000,
  impactGI: 0.05,
  canopyDeltaPct: 15,
  coolingDeltaC: -0.4,
  pm25KgPerYear: 1.2,
  overallRating: 70,
};

function makeRow(): TableRow {
  return {
    id: 1,
    barangay: "Mantuyong",
    equity: 0.3,
    costPHP: canopyEval.costPHP,
    costNormalized: 0,
    impactGI: canopyEval.impactGI,
    canopyDelta: canopyEval.canopyDeltaPct,
    coolingDeltaC: canopyEval.coolingDeltaC,
    pm25KgPerYear: canopyEval.pm25KgPerYear,
    costPerImpact: canopyEval.costPHP / canopyEval.impactGI,
    status: "Good",
    recommendedIntervention: "Urban Canopy",
    recommendationKey: "urban canopy",
    recommendationTagline: "",
    overallRating: canopyEval.overallRating,
    areaHectares: AREA_HA,
    lifecycleCost: canonicalLifecycleCost("urban canopy", AREA_HA),
    source: "test",
    snapshot: { name: "Mantuyong" } as TableRow["snapshot"],
    evalByStrategy: new Map<InterventionType, StrategyEvalLite>([
      ["urban canopy", canopyEval],
    ]),
  };
}

const rainGardenRec: AIRecommendation = {
  name: "Neighbourhood rain gardens",
  interventionType: "Rain Garden",
  summary: "",
  justification: "",
  priority: "high",
  overallRating: 84,
  costPHP: 350_000,
  impactGI: 0.02,
  canopyDeltaPct: 15,
  coolingDeltaC: -0.8,
  pm25KgPerYear: 2.3,
};

describe("resolveRowDisplay", () => {
  it("uses the engine's strategy when there is no AI recommendation", () => {
    const row = makeRow();
    const display = resolveRowDisplay(row, null);
    expect(display.strategy).toBe("urban canopy");
    expect(display.cost).toBe(row.lifecycleCost);
    expect(display.costPerImpact).toBeCloseTo(row.lifecycleCost / canopyEval.impactGI);
    expect(display.status).toBe("Good");
  });

  it("prices the AI's strategy, not the engine's, when the AI picks another one", () => {
    const row = makeRow();
    const display = resolveRowDisplay(row, [rainGardenRec]);
    const rainGardenCost = canonicalLifecycleCost("rain garden", AREA_HA);

    expect(display.strategy).toBe("rain garden");
    expect(display.strategyLabel).toBe("Rain Garden");
    expect(display.cost).toBe(rainGardenCost);
    expect(display.cost).not.toBe(row.lifecycleCost);
    expect(display.impactGI).toBe(0.02);
    // PHP/ΔGI pairs the rain garden's cost with the rain garden's impact.
    expect(display.costPerImpact).toBeCloseTo(rainGardenCost / 0.02);
    // Status follows the displayed (AI) rating, which is what the CSV now exports too.
    expect(display.overallRating).toBe(84);
    expect(display.status).toBe("Excellent");
  });

  it("maps ratings to the same status bands everywhere", () => {
    expect(statusFromRating(80)).toBe("Excellent");
    expect(statusFromRating(65)).toBe("Good");
    expect(statusFromRating(50)).toBe("Fair");
    expect(statusFromRating(49.9)).toBe("Poor");
  });
});
