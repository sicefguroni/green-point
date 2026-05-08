import { describe, expect, it } from "vitest";
import { evaluateStrategies } from "./evaluate-strategies";
import { STRATEGY_IDS } from "./presets";
import type { SimulationBaselineData } from "@/components/ui/simulation/simulation-types";

function baseline(
  overrides: Partial<SimulationBaselineData> = {},
): SimulationBaselineData {
  return {
    name: "Test Barangay",
    ndvi: 0.35,
    lst: 32,
    floodExposure: "Low",
    greeneryIndex: 0.5,
    canopyCover: 25,
    currentIntervention: "None",
    areaHectares: 30,
    ...overrides,
  };
}

describe("evaluateStrategies planning fit", () => {
  it("does not default to urban canopy where existing canopy is already high", () => {
    const [best] = evaluateStrategies(
      baseline({
        ndvi: 0.62,
        lst: 34,
        greeneryIndex: 0.72,
        canopyCover: 58,
        floodExposure: "Low",
      }),
    );

    expect(best.strategy).toBe("green corridor");
  });

  it("keeps urban canopy preferred for hot bare low-canopy areas", () => {
    const [best] = evaluateStrategies(
      baseline({
        ndvi: 0.2,
        lst: 36.5,
        greeneryIndex: 0.28,
        canopyCover: 9,
        floodExposure: "Low",
        areaHectares: 40,
      }),
    );

    expect(best.strategy).toBe("urban canopy");
  });

  it("prioritizes a stormwater-oriented strategy for high-flood areas with adequate canopy", () => {
    // Very-high flood + adequate canopy means more trees won't move the
    // needle on the dominant challenge — the recommendation should be a
    // stormwater-class intervention (rain garden, permeable surface, or
    // riparian/wetland restoration). Per the cost-estimation research
    // brief, wetland restoration prices per hectare and can be cheaper at
    // scale than rain gardens, so either is a planning-defensible answer.
    const stormwaterStrategies = new Set([
      "rain garden",
      "permeable surface",
      "riparian buffer",
    ]);
    const [best] = evaluateStrategies(
      baseline({
        ndvi: 0.48,
        lst: 31,
        greeneryIndex: 0.58,
        canopyCover: 42,
        floodExposure: "Very High",
      }),
    );

    expect(stormwaterStrategies.has(best.strategy)).toBe(true);
    expect(best.primaryChallenge?.challenge).toBe("severe-flooding");
  });

  it("only recommends creation strategies in the dashboard table — never stewardship", () => {
    // The dashboard's `InterventionAnalysisTable` derives its "Recommended
    // Intervention" column from `evaluateStrategies(...).[0].strategy`. The
    // canonical strategy set is restricted to *creation* interventions
    // (urban canopy, green corridor, rain garden). This test asserts that
    // contract holds across a range of contexts, including ones where a
    // naïve scorer might gravitate toward stewardship/maintenance (e.g.
    // already-greened, low-hazard sites).
    const creationStrategies = new Set(STRATEGY_IDS);

    const cases: SimulationBaselineData[] = [
      baseline({
        ndvi: 0.7,
        lst: 30,
        greeneryIndex: 0.78,
        canopyCover: 62,
        floodExposure: "Low",
      }), // already-greened, no real hazard
      baseline({
        ndvi: 0.18,
        lst: 36,
        greeneryIndex: 0.28,
        canopyCover: 9,
        floodExposure: "Medium",
        areaHectares: 4,
      }), // tight hot bare
      baseline({
        ndvi: 0.55,
        lst: 34,
        greeneryIndex: 0.6,
        canopyCover: 45,
        floodExposure: "High",
      }), // hot + flooding + greenish
    ];

    for (const c of cases) {
      const [best] = evaluateStrategies(c);
      expect(creationStrategies.has(best.strategy)).toBe(true);
    }
  });

  it("surfaces the primary site challenge on each evaluation", () => {
    const ranked = evaluateStrategies(
      baseline({
        ndvi: 0.2,
        lst: 36.5,
        greeneryIndex: 0.28,
        canopyCover: 9,
        floodExposure: "Low",
        areaHectares: 40,
      }),
    );

    // Severe heat is the dominant issue here — every evaluation should
    // be tagged with that primary challenge, and the chosen recommendation
    // should be one whose mechanism actually alleviates heat stress (i.e.
    // it has a high `primaryAlleviation` score).
    expect(ranked[0].primaryChallenge?.challenge).toBe("severe-heat");
    expect(ranked[0].primaryAlleviation).toBeGreaterThanOrEqual(0.85);
    for (const r of ranked) {
      expect(r.primaryChallenge?.challenge).toBe("severe-heat");
    }
  });

  it("recommends a stormwater-oriented strategy when the biggest challenge is severe flooding", () => {
    // Very-high flood + tight ground should pull the recommendation
    // toward the strategy that most directly alleviates the dominant
    // challenge. Any of rain garden, permeable surface, or riparian
    // buffer is a planning-defensible answer.
    const stormwaterStrategies = new Set([
      "rain garden",
      "permeable surface",
      "riparian buffer",
    ]);
    const [best] = evaluateStrategies(
      baseline({
        ndvi: 0.32,
        lst: 32,
        greeneryIndex: 0.45,
        canopyCover: 28,
        floodExposure: "Very High",
        areaHectares: 18,
      }),
    );
    expect(stormwaterStrategies.has(best.strategy)).toBe(true);
    expect(best.primaryChallenge?.challenge).toBe("severe-flooding");
  });

  it("does not let flood fit alone outrank better cooling, GI, and value", () => {
    const ranked = evaluateStrategies(
      baseline({
        name: "Mantuyong-like",
        ndvi: 0.164,
        lst: 33.4,
        greeneryIndex: 0.223,
        canopyCover: 0,
        floodExposure: "High",
        areaHectares: 13,
      }),
    );

    const rainGarden = ranked.find((r) => r.strategy === "rain garden")!;
    const greenCorridor = ranked.find((r) => r.strategy === "green corridor")!;

    expect(greenCorridor.impactGI).toBeGreaterThanOrEqual(
      rainGarden.impactGI - 0.01,
    );
    expect(greenCorridor.coolingDeltaC).toBeLessThan(rainGarden.coolingDeltaC);
    expect(greenCorridor.costPHP).toBeLessThan(rainGarden.costPHP);
    expect(greenCorridor.overallRating).toBeGreaterThan(
      rainGarden.overallRating,
    );
  });
});
