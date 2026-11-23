import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { buildGreeneryIndexFeatureCollection } from "@/lib/data-pipeline/barangay-gee-bundle";
import { getCustomSelectionCentroid } from "@/lib/map/custom_selection";
import {
  boundedHazardLevel,
  resolveTrustedLocationMetrics,
  type TrustedMetricsLoaders,
} from "./trusted-location-metrics";

// Two adjacent ~1.1 km squares near Mandaue.
const square = (west: number, east: number): GeoJSON.Polygon => ({
  type: "Polygon",
  coordinates: [[[west, 10.34], [east, 10.34], [east, 10.35], [west, 10.35], [west, 10.34]]],
});
const TABOK = square(123.94, 123.95);
const BAKILID = square(123.95, 123.96);
const STORED = "2026-11-22T00:00:00.000Z";

function giFeature(name: string, geometry: GeoJSON.Polygon, props: Record<string, unknown>) {
  return { type: "Feature" as const, geometry, properties: { name, lastUpdated: STORED, ...props } };
}

const LIVE: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    giFeature("Tabok", TABOK, {
      greeneryIndex: 0.234,
      level: "Low",
      ndvi: 0.21,
      lst: 34.5,
      treeCanopy: 0.12,
      inventoryTreeCount: 4,
      inventoryCanopyFraction: 0.01,
    }),
    giFeature("Bakilid", BAKILID, {
      greeneryIndex: 0.5,
      level: "Moderate",
      ndvi: 0.4,
      lst: 31,
      treeCanopy: 0.3,
      inventoryTreeCount: 0,
      inventoryCanopyFraction: 0,
    }),
  ],
};

const MEASURED_POINT = {
  greeneryIndex: 0.3,
  greeneryLevel: "Low",
  ndvi: 0.25,
  lst: 33,
  treeCanopy: 0.15,
  nearbyTaggedTreeCount: 2,
  inventoryCanopyFraction: 0.02,
  estimated: [],
};

function loaders(overrides: Partial<TrustedMetricsLoaders> = {}): TrustedMetricsLoaders {
  return {
    loadGreeneryIndex: vi.fn(async () => LIVE),
    loadPointMetrics: vi.fn(async () => MEASURED_POINT),
    loadTaggedTrees: vi.fn(async () => [
      { latitude: 10.345, longitude: 123.945, dbhCm: 20, heightFt: 30, barangay: "Tabok" },
      { latitude: 10.345, longitude: 123.955, dbhCm: 20, heightFt: 30, barangay: "Bakilid" },
    ]),
    loadFloodLabels: vi.fn(async () => [
      { name: "Tabok", flood_exposure: "High" },
      { name: "Bakilid", flood_exposure: "Low" },
    ]),
    loadAqiAt: vi.fn(async () => 87),
    ...overrides,
  };
}

describe("resolveTrustedLocationMetrics — barangay", () => {
  it("takes a barangay's metrics, flood level and AQI from server data", async () => {
    const l = loaders();
    const result = await resolveTrustedLocationMetrics(
      { mode: "barangay", barangayName: "tabok" },
      l,
    );

    expect(result).toMatchObject({
      ok: true,
      metrics: {
        areaName: "Tabok",
        greeneryIndex: 0.234,
        greeneryLevel: "Low",
        ndvi: 0.21,
        lst: 34.5,
        treeCanopy: 0.12,
        taggedTreeCount: 4,
        inventoryCanopyFraction: 0.01,
        floodHazard: 3,
        aqi: 87,
      },
    });
    if (result.ok) expect(result.metrics.areaHectares).toBeGreaterThan(100);
    // AQI is sampled at the barangay's centre.
    const [lat, lng] = vi.mocked(l.loadAqiAt).mock.calls[0];
    expect(lat).toBeCloseTo(10.345, 3);
    expect(lng).toBeCloseTo(123.945, 3);
  });

  it("has no metrics for a barangay missing from the live data", async () => {
    expect(
      await resolveTrustedLocationMetrics(
        { mode: "barangay", barangayName: "Nowhere" },
        loaders(),
      ),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it("treats a barangay with no stored metrics as having none, not the bundle's placeholders", async () => {
    // Exactly what loadBarangayGeeBundleUncached produces for a barangay
    // without a metrics row: NDVI 0.3, LST 30 and lastUpdated null.
    const fc = buildGreeneryIndexFeatureCollection({
      bounds: { type: "FeatureCollection", features: [{ type: "Feature", geometry: TABOK, properties: { name: "Tabok" } }] },
      dateKey: "20261123",
      treesByBarangay: {},
      byName: { Tabok: { ndvi: 0.3, lst: 30, lastUpdated: null, isStale: true, source: "db-cache" } },
    });
    expect(fc.features[0].properties?.greeneryIndex).toEqual(expect.any(Number));

    expect(
      await resolveTrustedLocationMetrics(
        { mode: "barangay", barangayName: "Tabok" },
        loaders({ loadGreeneryIndex: async () => fc }),
      ),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it("uses a stored barangay's metrics through the real bundle builder", async () => {
    const fc = buildGreeneryIndexFeatureCollection({
      bounds: { type: "FeatureCollection", features: [{ type: "Feature", geometry: TABOK, properties: { name: "Tabok" } }] },
      dateKey: "20261122",
      treesByBarangay: {},
      byName: { Tabok: { ndvi: 0.21, lst: 34.5, lastUpdated: STORED, isStale: true, source: "db-cache" } },
    });

    const result = await resolveTrustedLocationMetrics(
      { mode: "barangay", barangayName: "Tabok" },
      loaders({ loadGreeneryIndex: async () => fc }),
    );
    expect(result).toMatchObject({ ok: true, metrics: { ndvi: 0.21, lst: 34.5 } });
  });

  it("still generates when flood labels or AQI fail, leaving them unknown", async () => {
    const result = await resolveTrustedLocationMetrics(
      { mode: "barangay", barangayName: "Tabok" },
      loaders({
        loadFloodLabels: async () => {
          throw new Error("file missing");
        },
        loadAqiAt: async () => {
          throw new Error("WAQI down");
        },
      }),
    );
    expect(result).toMatchObject({ ok: true, metrics: { floodHazard: null, aqi: null } });
  });

  it("drops a negative AQI (WAQI's 'no reading')", async () => {
    const result = await resolveTrustedLocationMetrics(
      { mode: "barangay", barangayName: "Tabok" },
      loaders({ loadAqiAt: async () => -1 }),
    );
    expect(result).toMatchObject({ ok: true, metrics: { aqi: null } });
  });

  it("reports live data that fails to load as unavailable", async () => {
    expect(
      await resolveTrustedLocationMetrics(
        { mode: "barangay", barangayName: "Tabok" },
        loaders({
          loadGreeneryIndex: async () => {
            throw new Error("db down");
          },
        }),
      ),
    ).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("resolveTrustedLocationMetrics — point", () => {
  it("reads a point's metrics at the rounded cache coordinates and finds its barangay", async () => {
    const l = loaders();
    const result = await resolveTrustedLocationMetrics(
      { mode: "poi", coords: { lat: 10.345012345, lng: 123.955098765 } },
      l,
    );

    expect(l.loadPointMetrics).toHaveBeenCalledWith(10.345, 123.9551);
    expect(l.loadAqiAt).toHaveBeenCalledWith(10.345, 123.9551);
    expect(result).toMatchObject({
      ok: true,
      metrics: {
        areaName: "Bakilid",
        greeneryIndex: 0.3,
        greeneryLevel: "Low",
        taggedTreeCount: 2,
        areaHectares: 0.75,
        floodHazard: 1,
        aqi: 87,
      },
    });
  });

  it("has no metrics where NDVI was a placeholder (cloud-masked pixel)", async () => {
    expect(
      await resolveTrustedLocationMetrics(
        { mode: "poi", coords: { lat: 10.345, lng: 123.945 } },
        loaders({ loadPointMetrics: async () => ({ ...MEASURED_POINT, ndvi: 0.3, estimated: ["ndvi"] }) }),
      ),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it("has no metrics for a payload that doesn't say what was measured", async () => {
    const { estimated: _omit, ...legacy } = MEASURED_POINT;
    void _omit;
    expect(
      await resolveTrustedLocationMetrics(
        { mode: "poi", coords: { lat: 10.345, lng: 123.945 } },
        loaders({ loadPointMetrics: async () => legacy }),
      ),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it("keeps a point outside every barangay, with no area name or flood level", async () => {
    const result = await resolveTrustedLocationMetrics(
      { mode: "poi", coords: { lat: 14, lng: 120 } },
      loaders(),
    );
    expect(result).toMatchObject({ ok: true, metrics: { areaName: undefined, floodHazard: null } });
  });

  it("reports point metrics that fail to load as unavailable", async () => {
    expect(
      await resolveTrustedLocationMetrics(
        { mode: "poi", coords: { lat: 10.345, lng: 123.945 } },
        loaders({
          loadPointMetrics: async () => {
            throw new Error("Earth Engine down");
          },
        }),
      ),
    ).toEqual({ ok: false, reason: "unavailable" });
  });

  it("rejects non-numeric coordinates", async () => {
    expect(
      await resolveTrustedLocationMetrics(
        { mode: "poi", coords: { lat: "10.3", lng: 123.9 } as unknown as { lat: number; lng: number } },
        loaders(),
      ),
    ).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("resolveTrustedLocationMetrics — drawn area", () => {
  it("gives a drawn area its host barangay's metrics and its own trees", async () => {
    const drawn: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [[[123.944, 10.344], [123.946, 10.344], [123.946, 10.346], [123.944, 10.346], [123.944, 10.344]]],
    };
    const result = await resolveTrustedLocationMetrics(
      { mode: "custom", customSelectionGeometry: drawn },
      loaders(),
    );

    expect(result).toMatchObject({
      ok: true,
      metrics: { areaName: "Tabok", greeneryIndex: 0.234, taggedTreeCount: 1, floodHazard: 3 },
    });
    if (result.ok) {
      expect(result.metrics.areaHectares).toBeGreaterThan(4);
      expect(result.metrics.areaHectares).toBeLessThan(6);
      expect(result.metrics.inventoryCanopyFraction).toBeGreaterThan(0);
    }
  });

  it("picks the same barangay as Explore for a lasso traced densely along one edge", async () => {
    // Mostly in Bakilid (centre of mass lng ~123.9515), with 20 lasso points
    // crowded on the Tabok side. A vertex average lands in Tabok.
    const lasso: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [[
        [123.945, 10.349],
        [123.958, 10.349],
        [123.958, 10.341],
        ...Array.from({ length: 20 }, (_, i) => [123.945, 10.341 + i * 0.0004]),
        [123.945, 10.349],
      ]],
    };
    expect(getCustomSelectionCentroid(lasso).lng).toBeGreaterThan(123.95);

    const result = await resolveTrustedLocationMetrics(
      { mode: "custom", customSelectionGeometry: lasso },
      loaders(),
    );
    expect(result).toMatchObject({ ok: true, metrics: { areaName: "Bakilid", greeneryIndex: 0.5 } });
  });

  it("has no metrics for a drawn area outside every barangay", async () => {
    const faraway: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [[[120, 14], [120.01, 14], [120.01, 14.01], [120, 14.01], [120, 14]]],
    };
    expect(
      await resolveTrustedLocationMetrics(
        { mode: "custom", customSelectionGeometry: faraway },
        loaders(),
      ),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it.each([
    ["a point", { type: "Point", coordinates: [0, 0] }],
    ["an empty ring", { type: "Polygon", coordinates: [[]] }],
    ["no rings", { type: "Polygon", coordinates: [] }],
    ["a string", "Polygon"],
  ])("rejects %s as a drawn area", async (_label, geometry) => {
    expect(
      await resolveTrustedLocationMetrics(
        { mode: "custom", customSelectionGeometry: geometry },
        loaders(),
      ),
    ).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("resolveTrustedLocationMetrics — no mode", () => {
  it("has no metrics when the selection mode can't be told", async () => {
    expect(await resolveTrustedLocationMetrics({ mode: undefined }, loaders())).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("boundedHazardLevel", () => {
  it("keeps storm levels 0–3 and drops anything else", () => {
    expect(boundedHazardLevel(2)).toBe(2);
    expect(boundedHazardLevel(0)).toBe(0);
    expect(boundedHazardLevel(4)).toBeNull();
    expect(boundedHazardLevel(1.5)).toBeNull();
    expect(boundedHazardLevel("3")).toBeNull();
    expect(boundedHazardLevel(null)).toBeNull();
  });
});
