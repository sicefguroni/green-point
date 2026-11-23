import { describe, expect, it, vi } from "vitest";
import {
  boundedAqi,
  boundedHazardLevel,
  resolveTrustedLocationMetrics,
  type TrustedMetricsLoaders,
} from "./trusted-location-metrics";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

// Two adjacent ~1.1 km squares near Mandaue.
const TABOK: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [[[123.94, 10.34], [123.95, 10.34], [123.95, 10.35], [123.94, 10.35], [123.94, 10.34]]],
};
const BAKILID: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [[[123.95, 10.34], [123.96, 10.34], [123.96, 10.35], [123.95, 10.35], [123.95, 10.34]]],
};

function giFeature(name: string, geometry: GeoJSON.Polygon, props: Record<string, unknown>) {
  return {
    type: "Feature" as const,
    geometry,
    properties: { name, ...props },
  };
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

function loaders(overrides: Partial<TrustedMetricsLoaders> = {}): TrustedMetricsLoaders {
  return {
    loadGreeneryIndex: vi.fn(async () => LIVE),
    loadPointMetrics: vi.fn(async () => ({
      greeneryIndex: 0.3,
      greeneryLevel: "Low",
      ndvi: 0.25,
      lst: 33,
      treeCanopy: 0.15,
      nearbyTaggedTreeCount: 2,
      inventoryCanopyFraction: 0.02,
    })),
    loadTaggedTrees: vi.fn(async () => [
      { latitude: 10.345, longitude: 123.945, dbhCm: 20, heightFt: 30, barangay: "Tabok" },
      { latitude: 10.345, longitude: 123.955, dbhCm: 20, heightFt: 30, barangay: "Bakilid" },
    ]),
    ...overrides,
  };
}

describe("resolveTrustedLocationMetrics", () => {
  it("takes a barangay's metrics from the live greenery-index data", async () => {
    const result = await resolveTrustedLocationMetrics(
      { mode: "barangay", barangayName: "tabok" },
      loaders(),
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
      },
    });
    if (result.ok) expect(result.metrics.areaHectares).toBeGreaterThan(100);
  });

  it("has no metrics for a barangay missing from the live data", async () => {
    expect(
      await resolveTrustedLocationMetrics(
        { mode: "barangay", barangayName: "Nowhere" },
        loaders(),
      ),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it("has no metrics for a barangay whose live GI is missing", async () => {
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [giFeature("Tabok", TABOK, { greeneryIndex: null })],
    };
    expect(
      await resolveTrustedLocationMetrics(
        { mode: "barangay", barangayName: "Tabok" },
        loaders({ loadGreeneryIndex: async () => fc }),
      ),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it("reads a point's metrics at the rounded cache coordinates and finds its barangay", async () => {
    const l = loaders();
    const result = await resolveTrustedLocationMetrics(
      { mode: "poi", coords: { lat: 10.345012345, lng: 123.955098765 } },
      l,
    );

    expect(l.loadPointMetrics).toHaveBeenCalledWith(10.345, 123.9551);
    expect(result).toMatchObject({
      ok: true,
      metrics: {
        areaName: "Bakilid",
        greeneryIndex: 0.3,
        greeneryLevel: "Low",
        taggedTreeCount: 2,
        areaHectares: 0.75,
      },
    });
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
      metrics: { areaName: "Tabok", greeneryIndex: 0.234, taggedTreeCount: 1 },
    });
    if (result.ok) {
      expect(result.metrics.areaHectares).toBeGreaterThan(4);
      expect(result.metrics.areaHectares).toBeLessThan(6);
      expect(result.metrics.inventoryCanopyFraction).toBeGreaterThan(0);
    }
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

  it("rejects a custom selection that is not a polygon", async () => {
    expect(
      await resolveTrustedLocationMetrics(
        { mode: "custom", customSelectionGeometry: { type: "Point", coordinates: [0, 0] } },
        loaders(),
      ),
    ).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("bounded hazard and AQI values", () => {
  it("keeps hazard levels 0–3 and drops anything else", () => {
    expect(boundedHazardLevel(2)).toBe(2);
    expect(boundedHazardLevel(0)).toBe(0);
    expect(boundedHazardLevel(4)).toBeNull();
    expect(boundedHazardLevel(1.5)).toBeNull();
    expect(boundedHazardLevel("3")).toBeNull();
    expect(boundedHazardLevel(null)).toBeNull();
  });

  it("keeps AQI 0–500 and drops anything else", () => {
    expect(boundedAqi(87)).toBe(87);
    expect(boundedAqi(-1)).toBeNull();
    expect(boundedAqi(9000)).toBeNull();
    expect(boundedAqi(Number.NaN)).toBeNull();
  });
});
