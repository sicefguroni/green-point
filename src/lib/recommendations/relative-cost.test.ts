import { describe, expect, it } from "vitest";
import { relativeCostBand } from "./relative-cost";

describe("relativeCostBand", () => {
  it("reads the cheapest option as 'Lowest', not as a cost of zero", () => {
    // QA: a 0.001 score rendered as "Cost Index 0.00".
    expect(relativeCostBand(0.001)).toBe("Lowest");
    expect(relativeCostBand(0)).toBe("Lowest");
  });

  it("bands the rest of the range", () => {
    expect(relativeCostBand(0.2)).toBe("Low");
    expect(relativeCostBand(0.5)).toBe("Moderate");
    expect(relativeCostBand(0.8)).toBe("High");
    expect(relativeCostBand(1)).toBe("Highest");
  });

  it("clamps out-of-range values and rejects missing ones", () => {
    expect(relativeCostBand(-0.3)).toBe("Lowest");
    expect(relativeCostBand(4)).toBe("Highest");
    expect(relativeCostBand(Number.NaN)).toBeNull();
    expect(relativeCostBand(undefined)).toBeNull();
  });
});
