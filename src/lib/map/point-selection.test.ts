import { describe, expect, it, vi } from "vitest";

// A plain stub rather than vi.fn(): with vi.fn() the rejection case fails
// under Vitest 4 even though resolveBarangayAt catches the error.
let loadBundle: () => Promise<unknown> = async () => ({});
vi.mock("@/lib/data-api/client", () => ({
  fetchMapEnvBundle: () => loadBundle(),
}));

import {
  DEFAULT_PIN_NAME,
  findBarangayNameAt,
  pinNameFromAddress,
  resolveBarangayAt,
} from "./point-selection";

function square(name: string, west: number, south: number, size: number) {
  return {
    type: "Feature" as const,
    properties: { name },
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [west, south],
          [west + size, south],
          [west + size, south + size],
          [west, south + size],
          [west, south],
        ],
      ],
    },
  };
}

const TABOK = square("Tabok", 123.95, 10.35, 0.01);
const BANILAD = square("Banilad", 123.92, 10.33, 0.01);

describe("findBarangayNameAt", () => {
  it("returns the barangay containing the point", () => {
    expect(findBarangayNameAt([BANILAD, TABOK], 123.955, 10.355)).toBe("Tabok");
  });

  it("returns null outside every barangay", () => {
    expect(findBarangayNameAt([BANILAD, TABOK], 121.02, 14.55)).toBeNull();
  });

  it("skips non-polygon and malformed features", () => {
    const point = {
      type: "Feature" as const,
      properties: { name: "Not an area" },
      geometry: { type: "Point" as const, coordinates: [123.955, 10.355] },
    };
    const broken = { type: "Feature" as const, properties: { name: "Broken" }, geometry: null };
    expect(findBarangayNameAt([point, broken, TABOK], 123.955, 10.355)).toBe("Tabok");
  });

  it("returns null for non-finite coordinates", () => {
    expect(findBarangayNameAt([TABOK], Number.NaN, 10.355)).toBeNull();
  });
});

describe("resolveBarangayAt", () => {
  const bundleWith = (features: unknown[]) => ({
    barangayGeoJson: { greeneryIndex: { features } },
  });

  it("reports inside with the barangay name", async () => {
    loadBundle = async () => bundleWith([TABOK]);
    await expect(resolveBarangayAt(123.955, 10.355)).resolves.toEqual({
      status: "inside",
      name: "Tabok",
    });
  });

  it("reports outside for a point beyond Mandaue", async () => {
    loadBundle = async () => bundleWith([TABOK]);
    await expect(resolveBarangayAt(121.02, 14.55)).resolves.toEqual({ status: "outside" });
  });

  it("reports unknown when the boundaries can't be loaded", async () => {
    loadBundle = async () => {
      throw new Error("network");
    };
    const result = await resolveBarangayAt(123.955, 10.355);
    expect(result).toEqual({ status: "unknown" });
  });

  it("reports unknown, not outside, when the bundle has no polygons", async () => {
    loadBundle = async () => bundleWith([]);
    await expect(resolveBarangayAt(123.955, 10.355)).resolves.toEqual({ status: "unknown" });
  });
});

describe("pinNameFromAddress", () => {
  it("uses the first part of the geocoded address", () => {
    expect(pinNameFromAddress("12 A. Cortes Ave, Mandaue City, Cebu, Philippines")).toBe(
      "12 A. Cortes Ave",
    );
  });

  it("falls back when there is no address", () => {
    expect(pinNameFromAddress(null)).toBe(DEFAULT_PIN_NAME);
    expect(pinNameFromAddress("  , Cebu")).toBe(DEFAULT_PIN_NAME);
  });
});
