import type { LegendConfig } from "@/components/map/map_legend";
import type { VisionContext } from "@/lib/vision/context";

/** Stable semantic colors for schematic overlays and legend swatches. */
export const VISION_COLORS = {
  ground: "#22c55e",
  buildings: "#3b82f6",
  roof: "#f59e0b",
  vertical: "#a855f7",
  soil: "#92400e",
  permeability: "#06b6d4",
} as const;

type VisionLevel = "LOW" | "MEDIUM" | "HIGH";

export function levelToOpacity(level: VisionLevel): number {
  switch (level) {
    case "LOW":
      return 0.12;
    case "MEDIUM":
      return 0.22;
    case "HIGH":
      return 0.34;
    default:
      return 0.15;
  }
}

export function permeabilityOpacity(
  hint: VisionContext["permeabilityHint"],
): number {
  if (hint === "UNKNOWN") return 0.06;
  return levelToOpacity(hint as VisionLevel);
}

export function soilOverlayOpacity(
  visibility: VisionContext["soilVisibility"],
): number {
  switch (visibility) {
    case "NONE":
      return 0.04;
    case "LIMITED":
      return 0.1;
    case "CLEAR":
      return 0.18;
    default:
      return 0.08;
  }
}

const PHOTO_ANALYSIS_LEGEND_ID = "visionPhotoAnalysis";

export function buildVisionLegendConfig(
  vision: VisionContext,
): LegendConfig {
  const v = vision;
  return {
    id: PHOTO_ANALYSIS_LEGEND_ID,
    title: "Photo analysis",
    note: VISION_LEGEND_DISCLAIMER,
    type: "categorical",
    stops: [
      {
        color: VISION_COLORS.ground,
        label: `Ground open space · ${v.groundOpenSpaceLevel}`,
        value: v.groundOpenSpaceLevel,
      },
      {
        color: VISION_COLORS.buildings,
        label: `Building density · ${v.buildingDensityLevel}`,
        value: v.buildingDensityLevel,
      },
      {
        color: VISION_COLORS.roof,
        label: `Roof potential · ${v.roofGreeningPotential}`,
        value: v.roofGreeningPotential,
      },
      {
        color: VISION_COLORS.vertical,
        label: `Vertical potential · ${v.verticalGreeningPotential}`,
        value: v.verticalGreeningPotential,
      },
      {
        color: VISION_COLORS.soil,
        label: `Soil visibility · ${v.soilVisibility}`,
        value: v.soilVisibility,
      },
      {
        color: VISION_COLORS.permeability,
        label: `Permeability hint · ${v.permeabilityHint}`,
        value: v.permeabilityHint,
      },
    ],
  };
}

export const VISION_LEGEND_DISCLAIMER =
  "Illustrative zones summarize the model from your photo — not pixel masks on the map.";
