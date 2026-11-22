import { describe, expect, it } from "vitest";
import { costEstimateInterventionType } from "./useSiteCostEstimate";

describe("costEstimateInterventionType", () => {
  it("does not repeat the type when it equals the title", () => {
    expect(
      costEstimateInterventionType({
        solutionTitle: "Targeted Infill",
        interventionType: "targeted infill",
      }),
    ).toBe("Targeted Infill");
  });

  it("joins a distinct title and type", () => {
    expect(
      costEstimateInterventionType({
        solutionTitle: "Shaded school walk",
        interventionType: "Urban Canopy",
      }),
    ).toBe("Shaded school walk Urban Canopy");
  });

  it("ignores blank parts", () => {
    expect(
      costEstimateInterventionType({ solutionTitle: "  ", interventionType: "Rain Garden" }),
    ).toBe("Rain Garden");
  });
});
