import { describe, expect, it } from "vitest";
import type { VisionContext } from "@/lib/vision/context";
import {
  buildVisionLegendConfig,
  levelToOpacity,
  VISION_COLORS,
} from "@/lib/vision/visualization";

const sampleVision: VisionContext = {
  groundOpenSpaceLevel: "LOW",
  buildingDensityLevel: "HIGH",
  roofGreeningPotential: "MEDIUM",
  verticalGreeningPotential: "LOW",
  soilVisibility: "LIMITED",
  permeabilityHint: "LOW",
  confidence: 0.72,
  rationale: "Nighttime urban canyon with limited ground planting visible.",
};

describe("vision visualization", () => {
  it("maps levels to increasing opacity", () => {
    expect(levelToOpacity("LOW")).toBeLessThan(levelToOpacity("MEDIUM"));
    expect(levelToOpacity("MEDIUM")).toBeLessThan(levelToOpacity("HIGH"));
  });

  it("builds categorical legend with soil and disclaimer", () => {
    const leg = buildVisionLegendConfig(sampleVision);
    expect(leg.id).toBe("visionPhotoAnalysis");
    expect(leg.type).toBe("categorical");
    expect(leg.stops).toHaveLength(6);
    expect(leg.stops.some((s) => String(s.label).includes("Soil"))).toBe(true);
    expect(leg.note?.length).toBeGreaterThan(10);
    expect(leg.stops[0]?.color).toBe(VISION_COLORS.ground);
  });
});
