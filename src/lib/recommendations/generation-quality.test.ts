import { describe, expect, it } from "vitest";
import {
  passesRecommendationQualityGate,
  resolveSourcePlaceholders,
  sanitizeGeneratedRecommendations,
} from "./generation-quality";

const goodRec = {
  name: "Riparian Buffer",
  interventionType: "Riparian Buffer",
  summary:
    "Vegetated buffers for waterways, drainage edges, and coastal exposure.",
  description:
    "Riparian buffers install native shrubs and trees along drainage channels and creek edges. Crews plant salt-tolerant species in graded zones, stabilizing banks while slowing runoff. The treatment increases canopy shade and GI along flood-prone corridors.",
  justification:
    "Flood hazard is elevated and NDVI of 0.21 shows sparse vegetation along the water edge. Riparian planting slows peak flows and adds shade that reduces LST on adjacent pavements.",
  recommendedSpecies: "Talisay, Bitaog, Banaba",
  efficiency: 74,
};

const studyChunks = [
  {
    studyTitle:
      "The Sustainability of Native Trees in the Greening Initiatives of the Philippines",
  },
  { studyTitle: "Urban Stormwater Management in Tropical Cities" },
];

describe("generation-quality", () => {
  it("replaces SOURCE placeholders with study titles", () => {
    const fixed = resolveSourcePlaceholders(
      "Bioswales improve runoff control (SOURCE 1).",
      studyChunks,
    );
    expect(fixed).toContain("Sustainability of Native Trees");
    expect(fixed).not.toMatch(/SOURCE\s*1/i);
  });
  it("accepts a well-formed catalog recommendation", () => {
    expect(passesRecommendationQualityGate(goodRec)).toBe(true);
  });

  it("rejects vague generic copy", () => {
    expect(
      passesRecommendationQualityGate({
        ...goodRec,
        name: "Mystery Green Thing",
        interventionType: "Random Idea",
        description: "This will help greening the area with various benefits.",
        justification: "The site needs more green.",
      }),
    ).toBe(false);
  });

  it("dedupes duplicate strategies", () => {
    const corridor = {
      ...goodRec,
      name: "Green Corridor",
      interventionType: "Green Corridor",
      summary: "Continuous linear greening along waterways and roads.",
      description:
        "Green corridors connect parks and creeks with continuous tree and shrub planting along roads and easements. Teams install native street trees in medians and verges to link shade islands. The corridor raises canopy cover and improves walkable shade.",
      justification:
        "Heat stress is high with LST above local norms and canopy cover is only 18%. A corridor adds connected shade that lowers pedestrian exposure along the main route.",
    };
    const batch = sanitizeGeneratedRecommendations([goodRec, corridor, corridor]);
    expect(batch.length).toBe(2);
  });
});
