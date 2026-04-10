import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertValidMapEnvInclude } from "@/lib/data-api/validation";
import { GET } from "./route";

const getMapEnvBundle = vi.fn();

vi.mock("@/lib/data-api/service", () => ({
  DataApiError: class extends Error {
    code: string;
    status: number;
    constructor(message: string, code: string, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
  getMapEnvBundle: (...args: unknown[]) => getMapEnvBundle(...args),
  getResourcePayload: vi.fn(),
  getSMaxAgeForResource: () => 3600,
}));

const emptyFc = () =>
  ({
    type: "FeatureCollection" as const,
    features: [],
  }) satisfies GeoJSON.FeatureCollection;

beforeEach(() => {
  vi.clearAllMocks();
  getMapEnvBundle.mockImplementation(async (include: string | null) => {
    assertValidMapEnvInclude(include);
    return {
      bundle: {
        barangayGeoJson: {
          lst: emptyFc(),
          ndvi: emptyFc(),
          greeneryIndex: emptyFc(),
          aqi: emptyFc(),
        },
        rasterTileUrls: { lst: "u1", ndvi: "u2", canopy: "u3", gi: "u4" },
        meta: { dateKey: "test-date-key" },
      },
      subTimings: { geeBundle: 1, aqiLayer: 2 },
    };
  });
});

describe("GET /api/data", () => {
  it("bundle=map-env returns ok and all required keys", async () => {
    const res = await GET(
      new Request("http://localhost/api/data?bundle=map-env"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.bundle).toBe("map-env");
    expect(json.data.meta.dateKey).toBe("test-date-key");
    expect(json.data.barangayGeoJson.lst.type).toBe("FeatureCollection");
    expect(json.data.barangayGeoJson.ndvi.type).toBe("FeatureCollection");
    expect(json.data.barangayGeoJson.greeneryIndex.type).toBe(
      "FeatureCollection",
    );
    expect(json.data.barangayGeoJson.aqi.type).toBe("FeatureCollection");
    expect(json.data.rasterTileUrls).toEqual({
      lst: "u1",
      ndvi: "u2",
      canopy: "u3",
      gi: "u4",
    });
  });

  it("rejects unknown include token with 400", async () => {
    const res = await GET(
      new Request("http://localhost/api/data?bundle=map-env&include=bogus"),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INVALID_INCLUDE");
  });
});
