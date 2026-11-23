import { describe, expect, it } from "vitest";
import {
  buildRadarRows,
  computeCityComparison,
  formatDatasetDate,
  yearlyMeans,
  type HistoryRecord,
} from "./barangay-comparison";

function square(
  name: string,
  size: number,
  props: Record<string, unknown> = {},
): GeoJSON.Feature {
  const x = 123.93;
  const y = 10.33;
  return {
    type: "Feature",
    properties: { name, ...props },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [x, y],
          [x + size, y],
          [x + size, y + size],
          [x, y + size],
          [x, y],
        ],
      ],
    },
  };
}

describe("computeCityComparison", () => {
  it("averages only the values that exist", () => {
    const c = computeCityComparison([
      square("A", 0.01, { greenery_index: 0.2, ndvi: 0.4, tree_canopy: 0.1 }),
      square("B", 0.01, { greenery_index: 0.6 }),
    ]);
    expect(c.greeneryIndex).toBeCloseTo(0.4);
    expect(c.ndvi).toBeCloseTo(0.4);
    expect(c.treeCanopy).toBeCloseTo(0.1);
  });

  it("returns null means, not placeholders, when there is no data", () => {
    const c = computeCityComparison([]);
    expect(c.greeneryIndex).toBeNull();
    expect(c.ndvi).toBeNull();
    expect(c.treeCanopy).toBeNull();
    expect(c.maxAreaHa).toBeNull();
  });

  it("computes polygon areas in hectares", () => {
    const c = computeCityComparison([square("Small", 0.01), square("Big", 0.02)]);
    const small = c.areaHaByName.get("small")!;
    const big = c.areaHaByName.get("big")!;
    // 0.01° is ~1.1 km at this latitude, so ~120 ha.
    expect(small).toBeGreaterThan(100);
    expect(small).toBeLessThan(140);
    expect(big / small).toBeCloseTo(4, 1);
    expect(c.maxAreaHa).toBe(big);
  });
});

describe("buildRadarRows", () => {
  const city = computeCityComparison([
    square("Small", 0.01, { greenery_index: 0.2, ndvi: 0.3, tree_canopy: 0.05 }),
    square("Big", 0.02, { greenery_index: 0.4, ndvi: 0.5, tree_canopy: 0.15 }),
  ]);

  it("uses the barangay's own area against the largest one", () => {
    const rows = buildRadarRows(
      { name: "Small", greeneryIndex: 0.2, ndvi: 0.3, treeCanopy: 0.05 },
      city,
    );
    expect(rows.map((r) => r.metric)).toEqual([
      "Greenery Index",
      "NDVI",
      "Canopy %",
      "Area (vs largest)",
    ]);
    const area = rows.find((r) => r.metric === "Area (vs largest)")!;
    expect(area.barangay).toBeCloseTo(0.25, 1);
    expect(area.city).toBeCloseTo(0.625, 1);
  });

  it("has no poverty row", () => {
    const rows = buildRadarRows(
      { name: "Big", greeneryIndex: 0.4, ndvi: 0.5, treeCanopy: 0.15 },
      city,
    );
    expect(rows.some((r) => /poverty/i.test(r.metric))).toBe(false);
  });

  it("drops area when the barangay has no polygon", () => {
    const rows = buildRadarRows(
      { name: "Nowhere", greeneryIndex: 0.4, ndvi: 0.5, treeCanopy: 0.15 },
      city,
    );
    expect(rows.some((r) => r.metric.startsWith("Area"))).toBe(false);
  });
});

function months(year: number, count: number, ndvi: number, lst: number): HistoryRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    month: "x",
    year,
    fullDate: `${year}-${String(i + 1).padStart(2, "0")}`,
    NDVI: ndvi,
    LST: lst,
    canopy: 0,
  }));
}

describe("yearlyMeans", () => {
  it("skips partial years", () => {
    expect(yearlyMeans([...months(2025, 7, 0.3, 32), ...months(2026, 5, 0.3, 32)])).toEqual([]);
  });

  it("averages complete years in order", () => {
    const pts = yearlyMeans([...months(2025, 12, 0.4, 33), ...months(2024, 12, 0.2, 31)]);
    expect(pts.map((p) => p.month)).toEqual(["2024", "2025"]);
    expect(pts[0].NDVI).toBeCloseTo(0.2);
    expect(pts[0].LST).toBeCloseTo(31);
    expect(pts[1].NDVI).toBeCloseTo(0.4);
    expect(pts[1].LST).toBeCloseTo(33);
  });
});

describe("formatDatasetDate", () => {
  it("formats compact and dashed dates", () => {
    expect(formatDatasetDate("20261014")).toBe("14 Oct 2026");
    expect(formatDatasetDate("2026-10-14")).toBe("14 Oct 2026");
  });

  it("leaves other strings alone", () => {
    expect(formatDatasetDate("latest")).toBe("latest");
    expect(formatDatasetDate("20261399")).toBe("20261399");
  });
});
