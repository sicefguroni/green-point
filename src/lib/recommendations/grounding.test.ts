import { describe, expect, it } from "vitest";
import {
  matchStudyTitle,
  removeGreeneryContradictions,
  removeUngroundedCitations,
  trimToCompleteSentence,
} from "./grounding";

// A slice of the real ResearchStudy titles.
const STUDIES = [
  "National Greening Program in the Philippines   Lozano et al 2025",
  "Restoration of Urban Green Environments Based on Vegetation Ecology   Miyawaki 1998",
  "Living Walls Effect on Cooling Energy Consumption in Urban Microclimates   Sustainability 2024",
  "The Sustainability of Native Trees in the Greening Initiatives of the Philippines",
];

describe("matchStudyTitle", () => {
  it("matches exact titles regardless of case and quotes", () => {
    expect(
      matchStudyTitle(
        "the sustainability of native trees in the greening initiatives of the philippines",
        STUDIES,
      ),
    ).toBe(STUDIES[3]);
  });

  it("matches a title cited without its journal suffix", () => {
    expect(
      matchStudyTitle(
        "Living Walls Effect on Cooling Energy Consumption in Urban Microclimates",
        STUDIES,
      ),
    ).toBe(STUDIES[2]);
  });

  it("rejects titles that are not in the corpus", () => {
    expect(matchStudyTitle("Urban Forestry and Urban Greening Strategies Study", STUDIES)).toBeNull();
    expect(matchStudyTitle("Urban Heat Island Mitigation Study", STUDIES)).toBeNull();
    expect(matchStudyTitle("Living Walls", STUDIES)).toBeNull();
  });
});

describe("removeUngroundedCitations", () => {
  it("drops author-year citations that are not in the corpus (QA: Davis et al., 2014)", () => {
    const { text, removed } = removeUngroundedCitations(
      "Filling canopy gaps provides shade where it is most needed (Davis et al., 2014).",
      STUDIES,
    );
    expect(text).toBe("Filling canopy gaps provides shade where it is most needed.");
    expect(removed).toEqual(["Davis et al., 2014"]);
  });

  it("keeps author-year citations that match a corpus title", () => {
    const input = "Native planting outperforms exotics (Lozano et al., 2025).";
    expect(removeUngroundedCitations(input, STUDIES).text).toBe(input);
  });

  it("filters mixed citation groups", () => {
    expect(
      removeUngroundedCitations(
        "Dense native planting establishes quickly (Miyawaki, 1998; Garcia et al., 2013).",
        STUDIES,
      ).text,
    ).toBe("Dense native planting establishes quickly (Miyawaki, 1998).");
  });

  it("rewrites narrative citations so the sentence still reads", () => {
    expect(
      removeUngroundedCitations("Israel and Bantayan (2021) found strong cooling.", STUDIES).text,
    ).toBe("research found strong cooling.");
  });

  it("removes quoted titles that are not corpus studies", () => {
    expect(
      removeUngroundedCitations(
        'Trees cut surface heat (per "Urban Heat Island Mitigation Study").',
        STUDIES,
      ).text,
    ).toBe("Trees cut surface heat.");
    expect(
      removeUngroundedCitations(
        'As highlighted in "Urban Forestry and Urban Greening Strategies Study", shade matters.',
        STUDIES,
      ).text,
    ).toBe("As highlighted in research, shade matters.");
  });

  it("keeps quoted corpus titles and short ordinary quotes", () => {
    const corpus =
      'Per "The Sustainability of Native Trees in the Greening Initiatives of the Philippines", natives last longer.';
    expect(removeUngroundedCitations(corpus, STUDIES).text).toBe(corpus);
    const quote = 'Residents call it the "green mile" locally.';
    expect(removeUngroundedCitations(quote, STUDIES).text).toBe(quote);
  });

  it("handles single-quoted titles after a citing word, and ignores apostrophes", () => {
    expect(
      removeUngroundedCitations(
        "Trees cool streets, as noted in 'Urban Heat Island Mitigation Study'.",
        STUDIES,
      ).text,
    ).toBe("Trees cool streets, as noted in research.");
    const kept =
      "Green walls help, as stated in 'The Sustainability of Native Trees in the Greening Initiatives of the Philippines'.";
    expect(removeUngroundedCitations(kept, STUDIES).text).toBe(kept);
    const apostrophes = "The city's parks and Tabok's streets need shade, so it's worth it.";
    expect(removeUngroundedCitations(apostrophes, STUDIES).text).toBe(apostrophes);
  });

  it("removes leftover SOURCE labels", () => {
    expect(removeUngroundedCitations("Bioswales slow runoff (SOURCE 3).", STUDIES).text).toBe(
      "Bioswales slow runoff.",
    );
  });
});

describe("trimToCompleteSentence", () => {
  it("cuts a rationale that stops mid-sentence (QA: 16 of 257)", () => {
    expect(
      trimToCompleteSentence(
        "Filling gaps adds shade. It also cools streets. As highlighted in the research,",
      ),
    ).toBe("Filling gaps adds shade. It also cools streets.");
  });

  it("leaves complete text alone and empties text with no full sentence", () => {
    expect(trimToCompleteSentence("Shade cools streets.")).toBe("Shade cools streets.");
    expect(trimToCompleteSentence("As highlighted in the research,")).toBe("");
  });

  it("keeps the finished part of a single unfinished sentence", () => {
    expect(
      trimToCompleteSentence(
        "Pocket parks add shade in dense areas, helping alleviate urban heat stress while promoting community engagement, as noted in the findings of the study",
      ),
    ).toBe(
      "Pocket parks add shade in dense areas, helping alleviate urban heat stress while promoting community engagement.",
    );
  });
});

describe("removeGreeneryContradictions", () => {
  const tabok = { ndvi: 0.044, treeCanopy: 0.019, greeneryIndex: 0.2 };
  const qaText =
    "This approach fills existing gaps in canopy cover. It is sensitive to the already abundant greenery with a high canopy map. It will aid biodiversity.";

  it("drops claims that a low-green site is already green (QA: Tabok)", () => {
    const { text, removed } = removeGreeneryContradictions(qaText, tabok);
    expect(text).toBe("This approach fills existing gaps in canopy cover. It will aid biodiversity.");
    expect(removed).toHaveLength(1);
  });

  it("keeps outcome statements about future canopy", () => {
    const text = "Planting creates dense canopy that cools streets.";
    expect(removeGreeneryContradictions(text, tabok).text).toBe(text);
  });

  it("does nothing on a genuinely green site", () => {
    expect(
      removeGreeneryContradictions(qaText, { ndvi: 0.6, treeCanopy: 0.45, greeneryIndex: 0.7 }).text,
    ).toBe(qaText);
  });
});
