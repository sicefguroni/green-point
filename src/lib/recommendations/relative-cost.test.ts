import { describe, expect, it } from "vitest";
import { RELATIVE_COST_THRESHOLDS, relativeCostBand } from "./relative-cost";

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

  it("breaks at the same points the spec card colours at", () => {
    // Review: 0.62 read "Moderate" but rendered red (colours used 0.3 / 0.6).
    const [green, amber] = RELATIVE_COST_THRESHOLDS;
    for (let i = 0; i <= 100; i++) {
      const v = i / 100;
      const band = relativeCostBand(v);
      const tone = v <= green ? "green" : v <= amber ? "amber" : "red";
      const expected =
        band === "Lowest" || band === "Low"
          ? "green"
          : band === "Moderate"
            ? "amber"
            : "red";
      expect(tone, `value ${v.toFixed(2)} → ${band}`).toBe(expected);
    }
  });

  it("clamps out-of-range values and rejects missing ones", () => {
    expect(relativeCostBand(-0.3)).toBe("Lowest");
    expect(relativeCostBand(4)).toBe("Highest");
    expect(relativeCostBand(Number.NaN)).toBeNull();
    expect(relativeCostBand(undefined)).toBeNull();
  });
});
