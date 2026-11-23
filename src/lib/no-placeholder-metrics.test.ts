import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { mergeBoundariesWithLiveGreenery, mergeGI } from "@/lib/MergeGI";
import { normalizeFeatureCollection } from "@/components/ui/dashboard/dashboard-table-utils";
import { buildGreeneryIndexFeatureCollection } from "@/lib/data-pipeline/barangay-gee-bundle";

/**
 * Guards against made-up barangay metrics coming back: the static
 * mandaue_barangays_gi.geojson holds labels only, and nothing fills missing
 * metrics with numbers.
 */

const boundary = (name: string): GeoJSON.Feature => ({
  type: "Feature",
  properties: { name },
  geometry: {
    type: "Polygon",
    coordinates: [[[123.93, 10.33], [123.94, 10.33], [123.94, 10.34], [123.93, 10.34], [123.93, 10.33]]],
  },
});
const fc = (...f: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features: f });

describe("mandaue_barangays_gi.geojson", () => {
  it("holds labels only, no metric numbers", () => {
    const rows = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public/geo/mandaue_barangays_gi.geojson"), "utf8"),
    ) as Record<string, unknown>[];
    expect(rows).toHaveLength(27);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["current_intervention", "flood_exposure", "name"]);
    }
  });
});

describe("MergeGI", () => {
  const labels = [{ name: "Tabok", flood_exposure: "Low", current_intervention: "Urban Canopy enhancement" }];

  it("leaves metrics null when the live data has no row for a barangay", () => {
    const merged = mergeBoundariesWithLiveGreenery(fc(boundary("Tabok")), fc(), labels);
    expect(merged.features[0].properties).toMatchObject({
      greenery_index: null,
      ndvi: null,
      lst: null,
      tree_canopy: null,
      flood_exposure: "Low",
    });
  });

  it("the labels-only fallback has no metrics", () => {
    const merged = mergeGI(fc(boundary("Tabok")), labels);
    expect(merged.features[0].properties).toMatchObject({
      greenery_index: null,
      ndvi: null,
      flood_exposure: "Low",
      current_intervention: "Urban Canopy enhancement",
    });
  });
});

describe("dashboard normalizeFeatureCollection", () => {
  const labels = [{ name: "Tabok", flood_exposure: "Low", current_intervention: "Rain Garden" }];

  it("is empty with no live data, instead of rows of default numbers", () => {
    expect(normalizeFeatureCollection(null, labels)).toEqual([]);
  });

  it("drops a barangay with no live GI and adds labels to the rest", () => {
    const live = fc(
      { ...boundary("Tabok"), properties: { name: "Tabok", greenery_index: 0.23, ndvi: 0.18, flood_exposure: "—" } },
      { ...boundary("Centro"), properties: { name: "Centro", greenery_index: null, ndvi: null } },
    );
    const rows = normalizeFeatureCollection(live, labels);
    expect(rows).toHaveLength(1);
    expect(rows[0].properties).toMatchObject({
      name: "Tabok",
      greenery_index: 0.23,
      flood_exposure: "Low",
      current_intervention: "Rain Garden",
    });
  });
});

describe("greenery-index layer", () => {
  it("reports no GI or canopy for a barangay with no stored NDVI/LST", () => {
    const out = buildGreeneryIndexFeatureCollection({
      byName: { Tabok: { ndvi: null, lst: null, lastUpdated: null, isStale: true, source: "db-cache" } },
      bounds: fc(boundary("Tabok")),
      dateKey: "20261123",
      treesByBarangay: {},
    });
    expect(out.features[0].properties).toMatchObject({
      greeneryIndex: null,
      ndvi: null,
      lst: null,
      treeCanopy: null,
    });
  });

  it("computes GI from stored values when they exist", () => {
    const out = buildGreeneryIndexFeatureCollection({
      byName: { Tabok: { ndvi: 0.24, lst: 34.26, lastUpdated: "2026-11-23T00:00:00Z", isStale: false, source: "db-cache" } },
      bounds: fc(boundary("Tabok")),
      dateKey: "20261123",
      treesByBarangay: {},
    });
    expect(typeof out.features[0].properties?.greeneryIndex).toBe("number");
    expect(out.features[0].properties?.ndvi).toBe(0.24);
  });
});
