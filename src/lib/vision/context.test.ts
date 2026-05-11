import { describe, expect, it } from "vitest";
import {
  normalizeVisionAnalysis,
  shouldUseVisionContext,
} from "@/lib/vision/context";

describe("vision context schema", () => {
  it("normalizes valid analysis payload", () => {
    const normalized = normalizeVisionAnalysis({
      visionContext: {
        groundOpenSpaceLevel: "LOW",
        buildingDensityLevel: "HIGH",
        roofGreeningPotential: "HIGH",
        verticalGreeningPotential: "HIGH",
        soilVisibility: "LIMITED",
        permeabilityHint: "UNKNOWN",
        confidence: 0.84,
        rationale: "Dense street canyon with very limited visible planting beds.",
      },
      quickTags: ["dense-urban", "roof-opportunity"],
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.visionContext.buildingDensityLevel).toBe("HIGH");
  });

  it("rejects invalid analysis payload", () => {
    const normalized = normalizeVisionAnalysis({
      visionContext: {
        groundOpenSpaceLevel: "TINY",
      },
    });
    expect(normalized).toBeNull();
  });

  it("uses context only above confidence threshold", () => {
    const lowConfidence = {
      groundOpenSpaceLevel: "HIGH" as const,
      buildingDensityLevel: "LOW" as const,
      roofGreeningPotential: "LOW" as const,
      verticalGreeningPotential: "LOW" as const,
      soilVisibility: "CLEAR" as const,
      permeabilityHint: "HIGH" as const,
      confidence: 0.2,
      rationale: "clear",
    };
    const highConfidence = { ...lowConfidence, confidence: 0.8 };
    expect(shouldUseVisionContext(lowConfidence)).toBe(false);
    expect(shouldUseVisionContext(highConfidence)).toBe(true);
  });
});
