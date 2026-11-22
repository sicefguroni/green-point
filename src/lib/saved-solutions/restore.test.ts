import { describe, expect, it } from "vitest";
import type { SavedSolutionRow } from "@/hooks/useSavedSolutions";
import { resolveSelectedAreaHectares } from "@/lib/selection-area";
import {
  savedBarangayName,
  toSavedBarangayData,
  toSelectedFeature,
} from "./restore";

function makeSave(overrides: Partial<SavedSolutionRow> = {}): SavedSolutionRow {
  return {
    id: "save-1",
    locationType: "barangay",
    locationId: "Tabok",
    locationName: "Brgy. Tabok",
    locationMetadata: null,
    solutionSnapshot: { solutionTitle: "Rain Garden" },
    contextSnapshot: {
      ndvi: 0.31,
      lst: 33.5,
      treeCanopy: 0.12,
      greeneryIndex: 0.28,
      greeneryLevel: "Low",
      floodHazard: 3,
      areaHectares: 135.46,
    } as SavedSolutionRow["contextSnapshot"],
    notes: null,
    tags: [],
    createdAt: "2026-11-20T00:00:00.000Z",
    updatedAt: "2026-11-20T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

/** What the cost card prices once the saved solution is reopened. */
function reopenedSiteArea(save: SavedSolutionRow) {
  const feature = toSelectedFeature(save);
  return resolveSelectedAreaHectares({
    customSelectionAreaHectares: feature.customSelectionAreaHectares,
    pointSelectionAreaHectares: feature.pointSelectionAreaHectares,
    barangayAreaHectares: toSavedBarangayData(save)?.areaHectares,
  });
}

describe("saved solution restore", () => {
  it("recovers the barangay area for saves made before it was stored in metadata", () => {
    // Before the fix this was null, so the cost card priced a 1 ha reference site.
    expect(reopenedSiteArea(makeSave())).toBe(135.46);
  });

  it("prefers the area stored in locationMetadata", () => {
    const save = makeSave({
      locationMetadata: { areaHectares: 140, coords: { lat: 10.35, lng: 123.94 } },
    });
    expect(reopenedSiteArea(save)).toBe(140);
    expect(toSelectedFeature(save).coords).toEqual({ lat: 10.35, lng: 123.94 });
  });

  it("uses the bare barangay name, as Explore does", () => {
    expect(toSelectedFeature(makeSave()).barangay).toBe("Tabok");
    expect(savedBarangayName(makeSave({ locationId: null }))).toBe("Tabok");
  });

  it("rebuilds the barangay context and labels the flood level", () => {
    const data = toSavedBarangayData(makeSave());
    expect(data).toMatchObject({
      name: "Tabok",
      ndvi: 0.31,
      lst: 33.5,
      treeCanopy: 0.12,
      greeneryIndex: 0.28,
      floodExposure: "High",
      currentIntervention: "Unknown",
    });
  });

  it("returns no barangay context for pins and custom areas", () => {
    expect(toSavedBarangayData(makeSave({ locationType: "poi" }))).toBeNull();
    expect(toSavedBarangayData(makeSave({ locationType: "custom" }))).toBeNull();
  });

  it("returns no barangay context when the snapshot lacks its metrics", () => {
    const save = makeSave({
      contextSnapshot: { areaHectares: 100 } as SavedSolutionRow["contextSnapshot"],
    });
    expect(toSavedBarangayData(save)).toBeNull();
  });
});
