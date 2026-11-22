import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPECIES_BY_INTERVENTION,
  FORMS_BY_INTERVENTION,
  SPECIES_CATALOG,
  findSpecies,
  groundSpeciesForIntervention,
} from "./species-catalog";
import type { InterventionType } from "@/lib/simulation/coefficients";

describe("species catalog", () => {
  it("finds species by common name, alias, or scientific name in parentheses", () => {
    expect(findSpecies("narra")?.name).toBe("Narra");
    expect(findSpecies("Narra (Pterocarpus indicus)")?.name).toBe("Narra");
    expect(findSpecies("Bakhaw")?.name).toBe("Bakauan");
    expect(findSpecies("Mangrove (Rhizophora apiculata)")?.name).toBe("Bakauan");
    expect(findSpecies("Philippine Plant")).toBeNull();
  });

  it("only uses native species, in a fitting form, for every default", () => {
    for (const [key, names] of Object.entries(DEFAULT_SPECIES_BY_INTERVENTION)) {
      for (const name of names) {
        const entry = findSpecies(name);
        expect(entry, `${key}: ${name}`).not.toBeNull();
        expect(entry!.origin).toBe("native");
        expect(FORMS_BY_INTERVENTION[key as InterventionType]).toContain(entry!.form);
      }
    }
  });

  it("has unique names and aliases", () => {
    const labels = SPECIES_CATALOG.flatMap((e) => [e.name, ...(e.aliases ?? [])]).map((l) =>
      l.toLowerCase(),
    );
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("groundSpeciesForIntervention", () => {
  it("removes trees from green roofs and tops up with fitting natives (QA)", () => {
    const result = groundSpeciesForIntervention("Narra, Talisay, Banaba, Olive Tree", "green roof");
    expect(result.species).toBe("Kamuning, Tsaang Gubat");
    expect(result.toppedUp).toBe(true);
    expect(result.removed).toHaveLength(4);
  });

  it("removes invasive, introduced and made-up entries (QA: Mahogany, Ipil-ipil, Philippine Plant)", () => {
    const result = groundSpeciesForIntervention(
      "Narra (Pterocarpus indicus), Mahogany, Ipil-ipil, Acacia, Philippine Plant, Singing Plant",
      "urban canopy",
    );
    expect(result.species).toBe("Narra, Banaba");
    expect(result.removed.join(" ")).toMatch(/Mahogany \(invasive\)/);
    expect(result.removed.join(" ")).toMatch(/Acacia \(introduced\)/);
    expect(result.removed.join(" ")).toMatch(/Philippine Plant \(not a recognised species\)/);
  });

  it("keeps a valid list untouched apart from canonical names", () => {
    const result = groundSpeciesForIntervention("talisay, Bitaog, Kawayan", "riparian buffer");
    expect(result.species).toBe("Talisay, Bitaog, Kawayan Tinik");
    expect(result.removed).toEqual([]);
    expect(result.toppedUp).toBe(false);
  });

  it("caps at four and removes duplicates", () => {
    const result = groundSpeciesForIntervention(
      "Narra, narra, Molave, Banaba, Talisay, Dao, Ipil",
      "urban canopy",
    );
    expect(result.species).toBe("Narra, Molave, Banaba, Talisay");
  });
});
