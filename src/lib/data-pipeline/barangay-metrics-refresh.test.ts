import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchGeeMetricsForPolygons } = vi.hoisted(() => ({
  fetchGeeMetricsForPolygons: vi.fn(),
}));
vi.mock("@/lib/api/gee_service", () => ({ fetchGeeMetricsForPolygons }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  annualWindow,
  barangayCanopy,
  barangayPolygons,
  lastFullMonths,
  monthKey,
  monthWindow,
  refreshCurrentBarangayMetrics,
  setBarangayCentroids,
  upsertBarangayHistoryMonth,
} from "./barangay-metrics-refresh";

const square = (name: string, x = 123.93): GeoJSON.Feature => ({
  type: "Feature",
  properties: { name },
  geometry: {
    type: "Polygon",
    coordinates: [[[x, 10.33], [x + 0.01, 10.33], [x + 0.01, 10.34], [x, 10.34], [x, 10.33]]],
  },
});
const fc = (...f: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features: f });

function fakeDb() {
  return {
    barangay: {
      findMany: vi.fn(async () => [
        { id: "b-tabok", barangayName: "Tabok" },
        { id: "b-centro", barangayName: "Centro" },
      ]),
      update: vi.fn(),
    },
    barangayMetrics: { upsert: vi.fn() },
    barangayHistoricalMetrics: { upsert: vi.fn() },
  };
}

describe("month windows", () => {
  it("formats and bounds a month in UTC", () => {
    expect(monthKey(new Date("2026-11-23T08:00:00Z"))).toBe("2026-11");
    expect(monthWindow("2025-12")).toEqual({
      start: new Date("2025-12-01T00:00:00Z"),
      end: new Date("2026-01-01T00:00:00Z"),
    });
    expect(() => monthWindow("2025-13")).toThrow();
  });

  it("lists the full months before the current one, oldest first", () => {
    expect(lastFullMonths(new Date("2026-03-05T00:00:00Z"), 4)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("uses the 12 months ending now for current values", () => {
    const now = new Date("2026-11-23T00:00:00Z");
    expect(annualWindow(now)).toEqual({ start: new Date("2025-11-23T00:00:00Z"), end: now });
  });
});

describe("barangayPolygons", () => {
  it("keeps named polygons only", () => {
    const point: GeoJSON.Feature = { type: "Feature", properties: { name: "Pin" }, geometry: { type: "Point", coordinates: [0, 0] } };
    const unnamed = { ...square("x"), properties: {} };
    expect(barangayPolygons(fc(square(" Tabok "), point, unnamed)).map((p) => p.name)).toEqual(["Tabok"]);
  });
});

describe("barangayCanopy", () => {
  it("is null without NDVI", () => {
    expect(barangayCanopy(null, 31, 31, [], 1e6)).toBeNull();
  });
  it("uses the 12-month LST for the heat penalty when the month has none", () => {
    expect(barangayCanopy(0.5, null, 36, [], 1e6)).toBe(barangayCanopy(0.5, 36, null, [], 1e6));
  });
});

describe("refreshCurrentBarangayMetrics", () => {
  beforeEach(() => fetchGeeMetricsForPolygons.mockReset());

  it("writes 12-month polygon means and keeps a field that came back empty", async () => {
    fetchGeeMetricsForPolygons.mockResolvedValue(
      new Map([
        ["Tabok", { ndvi: 0.24, lst: 34.26 }],
        ["Centro", { ndvi: 0.18, lst: null }],
        ["Nowhere", { ndvi: 0.3, lst: 30 }],
      ]),
    );
    const db = fakeDb();
    const now = new Date("2026-11-23T00:00:00Z");
    const r = await refreshCurrentBarangayMetrics(db as never, [], now);

    expect(fetchGeeMetricsForPolygons.mock.calls[0][1]).toEqual(annualWindow(now));
    expect(r.updated).toBe(2);
    expect(r.unmatched).toEqual(["Nowhere"]);
    expect(db.barangayMetrics.upsert).toHaveBeenCalledWith({
      where: { barangayID: "b-tabok" },
      update: { NDVI: 0.24, LST: 34.26, lastUpdated: now },
      create: { barangayID: "b-tabok", NDVI: 0.24, LST: 34.26, lastUpdated: now },
    });
    // Centro's LST was empty: not overwritten with null.
    expect(db.barangayMetrics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { NDVI: 0.18, lastUpdated: now } }),
    );
  });
});

describe("upsertBarangayHistoryMonth", () => {
  beforeEach(() => fetchGeeMetricsForPolygons.mockReset());

  it("writes one row per barangay for the month, storing nulls for missing imagery", async () => {
    fetchGeeMetricsForPolygons.mockResolvedValue(
      new Map([
        ["Tabok", { ndvi: 0.245, lst: null }],
        ["Centro", { ndvi: null, lst: null }],
      ]),
    );
    const db = fakeDb();
    const polygons = barangayPolygons(fc(square("Tabok"), square("Centro", 123.95)));
    const r = await upsertBarangayHistoryMonth(db as never, polygons, [], "2026-10", new Map([["Tabok", 34.3]]));

    expect(fetchGeeMetricsForPolygons.mock.calls[0][1]).toEqual(monthWindow("2026-10"));
    expect(r).toEqual({ written: 2, missingNdvi: ["Centro"], missingLst: ["Tabok", "Centro"] });
    expect(db.barangayHistoricalMetrics.upsert).toHaveBeenCalledWith({
      where: { barangayID_month: { barangayID: "b-centro", month: "2026-10" } },
      update: { NDVI: null, LST: null, treeCanopy: null, year: 2026 },
      create: { barangayID: "b-centro", month: "2026-10", NDVI: null, LST: null, treeCanopy: null, year: 2026 },
    });
    const tabok = db.barangayHistoricalMetrics.upsert.mock.calls.find(
      (c) => c[0].where.barangayID_month.barangayID === "b-tabok",
    )![0];
    expect(tabok.update.NDVI).toBe(0.245);
    expect(tabok.update.LST).toBeNull();
    expect(typeof tabok.update.treeCanopy).toBe("number");
  });
});

describe("setBarangayCentroids", () => {
  it("stores each polygon's area centroid", async () => {
    const db = fakeDb();
    await setBarangayCentroids(db as never, barangayPolygons(fc(square("Tabok"))));
    expect(db.barangay.update).toHaveBeenCalledWith({
      where: { id: "b-tabok" },
      data: { coordinates: { lat: 10.335, lng: 123.935 } },
    });
  });
});
