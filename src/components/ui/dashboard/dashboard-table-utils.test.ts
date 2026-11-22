import { describe, expect, it } from "vitest";
import { canonicalLifecycleCost } from "@/lib/simulation/cost-model";
import type { InterventionType } from "@/lib/simulation/coefficients";
import {
  resolveRowDisplay,
  statusFromRating,
  withEngineMetrics,
} from "./dashboard-table-utils";
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

/** What the current engine says a rain garden does on this site. */
const rainGardenEngine: StrategyEvalLite = {
  costPHP: canonicalLifecycleCost("rain garden", AREA_HA),
  impactGI: 0.03,
  canopyDeltaPct: 0.8,
  coolingDeltaC: -0.45,
  pm25KgPerYear: 0.1,
  overallRating: 61,
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
    engineEvalByStrategy: new Map<InterventionType, StrategyEvalLite>([
      ["urban canopy", canopyEval],
      ["rain garden", rainGardenEngine],
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
    // Metrics come from the current engine, not the AI row's stored snapshot
    // (which still says canopy 15%, cooling −0.8°C, PM2.5 2.3 kg).
    expect(display.impactGI).toBe(0.03);
    expect(display.canopyDeltaPct).toBe(0.8);
    expect(display.coolingDeltaC).toBe(-0.45);
    expect(display.pm25).toBe(0.1);
    // PHP/ΔGI pairs the rain garden's cost with the rain garden's impact.
    expect(display.costPerImpact).toBeCloseTo(rainGardenCost / 0.03);
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

describe("withEngineMetrics", () => {
  it("keeps the stored rating but replaces every metric with the engine's", () => {
    const stored = { ...canopyEval, canopyDeltaPct: 15, overallRating: 88 };
    const engine = { ...canopyEval, canopyDeltaPct: 9, costPHP: 1, overallRating: 40 };
    expect(withEngineMetrics(stored, engine)).toEqual({ ...engine, overallRating: 88 });
  });

  it("falls back to whichever side exists", () => {
    expect(withEngineMetrics(undefined, canopyEval)).toBe(canopyEval);
    expect(withEngineMetrics(canopyEval, undefined)).toBe(canopyEval);
    expect(withEngineMetrics(undefined, undefined)).toBeUndefined();
  });
});
