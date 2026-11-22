import { describe, expect, it } from "vitest";
import {
  applyStudyCitations,
  groundCachedRecommendations,
  groundGeneratedRecommendation,
  isValidRecommendationBatch,
  passesRecommendationQualityGate,
  resolveSourcePlaceholders,
  sanitizeGeneratedRecommendations,
  type GeneratedRecommendationLike,
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

describe("citation grounding", () => {
  it("never attributes a study the model did not cite (QA: one study cited 127 times)", () => {
    const rec = { ...goodRec, rationale: "Buffers slow runoff and shade the bank.", sourceStudy: null };
    const cited = applyStudyCitations(rec, studyChunks);
    expect(cited.sourceStudy).toBeNull();
    expect(cited.rationale).toBe("Buffers slow runoff and shade the bank.");

    const grounded = groundGeneratedRecommendation(rec, { chunks: studyChunks });
    expect(grounded.sourceStudy).toBeNull();
    expect(grounded.rationale).not.toMatch(/per "/);
  });

  it("still maps SOURCE n to the study the prompt numbered n", () => {
    const grounded = groundGeneratedRecommendation(
      { ...goodRec, rationale: "Bioswales slow runoff (SOURCE 2)." },
      { chunks: studyChunks },
    );
    expect(grounded.rationale).toContain("Urban Stormwater Management in Tropical Cities");
  });

  it("drops a sourceStudy that is not a corpus study and reports it", () => {
    const report: string[] = [];
    const grounded = groundGeneratedRecommendation(
      {
        ...goodRec,
        sourceStudy: "Urban Forestry and Urban Greening Strategies Study",
        rationale: "Filling canopy gaps adds shade (Davis et al., 2014).",
      },
      { chunks: studyChunks, report },
    );
    expect(grounded.sourceStudy).toBeNull();
    expect(grounded.rationale).toBe("Filling canopy gaps adds shade.");
    expect(report.join(" | ")).toMatch(/removed source "Urban Forestry/);
    expect(report.join(" | ")).toMatch(/removed citation Davis et al., 2014/);
  });

  it("adopts a corpus title the model quoted in its rationale", () => {
    const grounded = groundGeneratedRecommendation(
      {
        ...goodRec,
        sourceStudy: null,
        rationale: 'Per "Urban Stormwater Management in Tropical Cities", buffers cut peak flows.',
      },
      { chunks: studyChunks },
    );
    expect(grounded.sourceStudy).toBe("Urban Stormwater Management in Tropical Cities");
  });

  it("validates against the full corpus on the cache path (no chunks)", () => {
    const grounded = groundGeneratedRecommendation(
      { ...goodRec, sourceStudy: "urban stormwater management in tropical cities" },
      { studyTitles: studyChunks.map((c) => c.studyTitle) },
    );
    expect(grounded.sourceStudy).toBe("Urban Stormwater Management in Tropical Cities");
  });

  it("clears a stored source the text never cites (old fallback attribution)", () => {
    const stored = {
      ...goodRec,
      sourceStudy: "Urban Stormwater Management in Tropical Cities",
      rationale: "Buffers slow runoff and shade the bank.",
    };
    const titles = studyChunks.map((c) => c.studyTitle);
    expect(
      groundGeneratedRecommendation(stored, { studyTitles: titles, requireSourceInText: true })
        .sourceStudy,
    ).toBeNull();
    expect(
      groundGeneratedRecommendation(
        { ...stored, rationale: 'Per "Urban Stormwater Management in Tropical Cities", buffers slow runoff.' },
        { studyTitles: titles, requireSourceInText: true },
      ).sourceStudy,
    ).toBe("Urban Stormwater Management in Tropical Cities");
  });

  it("grounds species to the intervention", () => {
    const grounded = groundGeneratedRecommendation(
      { ...goodRec, recommendedSpecies: "Mahogany, Talisay, Ipil-ipil" },
      { chunks: studyChunks },
    );
    expect(grounded.recommendedSpecies).toBe("Talisay, Bani");
  });
});

describe("groundCachedRecommendations", () => {
  const tabok = { ndvi: 0.044, treeCanopy: 0.019, greeneryIndex: 0.2 };
  const titles = studyChunks.map((c) => c.studyTitle);
  const contradicting =
    "The site already has abundant greenery with a high canopy. Flood risk needs runoff control.";
  const batch: GeneratedRecommendationLike[] = [
    goodRec,
    {
      ...goodRec,
      name: "Rain Garden",
      interventionType: "Rain Garden",
      summary: "Planted depressions that capture and filter street runoff.",
      justification: contradicting,
      recommendedSpecies: "Lagundi, Takip-kohol",
      rationale: "Rain gardens slow runoff (Davis et al., 2014).",
    },
    {
      ...goodRec,
      name: "Pocket Park",
      interventionType: "Pocket Park",
      summary: "Small public green spaces on vacant or underused lots.",
      justification: contradicting,
      recommendedSpecies: "Banaba, Kamuning",
    },
  ];

  it("never turns a valid cached batch into a cache miss (QA: Tabok was regenerated)", () => {
    expect(isValidRecommendationBatch(sanitizeGeneratedRecommendations(batch, []))).toBe(true);
    const grounded = groundCachedRecommendations(batch, { studyTitles: titles, metrics: tabok });
    expect(isValidRecommendationBatch(sanitizeGeneratedRecommendations(grounded, []))).toBe(true);
    // Citations are still grounded even when the contradiction step is skipped.
    expect(grounded[1].rationale).toBe("Rain gardens slow runoff.");
  });

  it("removes contradictions when the batch stays valid", () => {
    const roomy = batch.map((r) => ({
      ...r,
      justification:
        "The site already has abundant greenery with a high canopy. NDVI of 0.04 and canopy of 1.9% show sparse vegetation, so planting adds shade that lowers LST.",
    }));
    const grounded = groundCachedRecommendations(roomy, { studyTitles: titles, metrics: tabok });
    expect(grounded.every((r) => !/abundant greenery/.test(r.justification))).toBe(true);
    expect(isValidRecommendationBatch(sanitizeGeneratedRecommendations(grounded, []))).toBe(true);
  });
});
