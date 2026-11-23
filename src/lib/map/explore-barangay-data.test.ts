import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildExploreBarangayData } from "./explore-barangay-data";

function square(name: string, x = 123.93, y = 10.33, size = 0.01): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: { name },
    geometry: {
      type: "Polygon",
      coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
    },
  };
}

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features,
});

const liveRow = (name: string, props: Record<string, unknown>): GeoJSON.Feature => ({
  type: "Feature",
  geometry: null as unknown as GeoJSON.Geometry,
  properties: { name, ...props },
});

describe("buildExploreBarangayData", () => {
  it("takes the metrics from the live data, not the static file", () => {
    const rows = buildExploreBarangayData(
      fc([square("Tabok")]),
      fc([
        liveRow("Tabok", {
          greeneryIndex: 0.17,
          ndvi: 0.179,
          lst: 33.49,
          treeCanopy: 0.06,
          level: "Low",
          inventoryTreeCount: 4,
          inventoryCanopyFraction: 0.01,
        }),
      ]),
      [{ name: "Tabok", flood_exposure: "Low", current_intervention: "Urban Canopy enhancement" }],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Tabok",
      greeneryIndex: 0.17,
      ndvi: 0.179,
      lst: 33.49,
      treeCanopy: 0.06,
      greeneryLevel: "Low",
      taggedTreeCount: 4,
      inventoryCanopyFraction: 0.01,
      floodExposure: "Low",
      currentIntervention: "Urban Canopy enhancement",
    });
    expect(rows[0].areaHectares).toBeGreaterThan(100);
  });

  it("ignores the placeholder numbers in the real static file", () => {
    const labels = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public/geo/mandaue_barangays_gi.geojson"), "utf8"),
    );
    // The static file says Tabok is GI 0.64, NDVI 0.64, 37 °C, 81 % canopy.
    const rows = buildExploreBarangayData(
      fc([square("Tabok")]),
      fc([liveRow("Tabok", { greeneryIndex: 0.17, ndvi: 0.179, lst: 33.49, treeCanopy: 0.06 })]),
      labels,
    );
    expect(rows[0].greeneryIndex).toBe(0.17);
    expect(rows[0].ndvi).toBe(0.179);
    expect(rows[0].lst).toBe(33.49);
    expect(rows[0].treeCanopy).toBe(0.06);
    expect(rows[0].floodExposure).toBe("Low");
  });

  it("matches names case- and space-insensitively", () => {
    const rows = buildExploreBarangayData(
      fc([square("Ibabao Estancia")]),
      fc([liveRow(" ibabao estancia ", { greeneryIndex: 0.2, ndvi: 0.125, lst: 33.2, treeCanopy: 0 })]),
    );
    expect(rows.map((r) => r.name)).toEqual(["Ibabao Estancia"]);
  });

  it("leaves out a barangay with no live GI instead of inventing one", () => {
    const rows = buildExploreBarangayData(
      fc([square("Tabok"), square("Centro", 123.95)]),
      fc([liveRow("Tabok", { greeneryIndex: 0.17, ndvi: 0.179, lst: 33.49, treeCanopy: 0.06 })]),
    );
    expect(rows.map((r) => r.name)).toEqual(["Tabok"]);
  });

  it("derives the level from GI when the live row has none", () => {
    const rows = buildExploreBarangayData(
      fc([square("Umapad")]),
      fc([liveRow("Umapad", { greeneryIndex: 0.664, ndvi: 0.749, lst: 30, treeCanopy: 0.311 })]),
    );
    expect(rows[0].greeneryLevel).toBe("High");
  });
});
