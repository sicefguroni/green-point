import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BarangayGeeBundle } from "@/lib/data-pipeline/barangay-gee-bundle";

const emptyFc = {
  type: "FeatureCollection" as const,
  features: [],
};

const mockGeeBundle: BarangayGeeBundle = {
  byName: {},
  bounds: emptyFc,
  dateKey: "20250115",
  treesByBarangay: {},
};

const mocks = vi.hoisted(() => ({
  getCachedBarangayGeeBundle: vi.fn(),
  getCachedAqiFeatureCollection: vi.fn(),
  getCachedLstTileUrl: vi.fn(),
  getCachedNdviTileUrl: vi.fn(),
  getCachedCanopyTileUrl: vi.fn(),
  getCachedGiTileUrl: vi.fn(),
  buildLst: vi.fn(() => emptyFc),
  buildNdvi: vi.fn(() => emptyFc),
  buildGi: vi.fn(() => emptyFc),
}));

vi.mock("@/lib/data-pipeline/barangay-gee-bundle", () => ({
  getCachedBarangayGeeBundle: mocks.getCachedBarangayGeeBundle,
  buildLstFeatureCollection: mocks.buildLst,
  buildNdviFeatureCollection: mocks.buildNdvi,
  buildGreeneryIndexFeatureCollection: mocks.buildGi,
}));

vi.mock("@/lib/data-pipeline/aqi-layer-builder", () => ({
  getCachedAqiFeatureCollection: mocks.getCachedAqiFeatureCollection,
}));

vi.mock("@/lib/data-pipeline/gee-tile-urls", () => ({
  getCachedLstTileUrl: mocks.getCachedLstTileUrl,
  getCachedNdviTileUrl: mocks.getCachedNdviTileUrl,
  getCachedCanopyTileUrl: mocks.getCachedCanopyTileUrl,
  getCachedGiTileUrl: mocks.getCachedGiTileUrl,
}));

import {
  calendarDateKeyUtc,
  getMapEnvBundle,
  getMapEnvEtagDateKey,
} from "./service";

describe("getMapEnvBundle conditional fetches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCachedBarangayGeeBundle.mockResolvedValue(mockGeeBundle);
    mocks.getCachedAqiFeatureCollection.mockResolvedValue(emptyFc);
    mocks.getCachedLstTileUrl.mockResolvedValue("lst");
    mocks.getCachedNdviTileUrl.mockResolvedValue("ndvi");
    mocks.getCachedCanopyTileUrl.mockResolvedValue("canopy");
    mocks.getCachedGiTileUrl.mockResolvedValue("gi");
  });

  it("fetches all upstreams when include is omitted", async () => {
    await getMapEnvBundle(null);
    expect(mocks.getCachedBarangayGeeBundle).toHaveBeenCalledOnce();
    expect(mocks.getCachedAqiFeatureCollection).toHaveBeenCalledOnce();
    expect(mocks.getCachedLstTileUrl).toHaveBeenCalledOnce();
    expect(mocks.getCachedNdviTileUrl).toHaveBeenCalledOnce();
    expect(mocks.getCachedCanopyTileUrl).toHaveBeenCalledOnce();
    expect(mocks.getCachedGiTileUrl).toHaveBeenCalledOnce();
  });

  it("include=aqi only skips GEE bundle and tile URL fetches", async () => {
    await getMapEnvBundle("aqi");
    expect(mocks.getCachedBarangayGeeBundle).not.toHaveBeenCalled();
    expect(mocks.getCachedAqiFeatureCollection).toHaveBeenCalledOnce();
    expect(mocks.getCachedLstTileUrl).not.toHaveBeenCalled();
    expect(mocks.getCachedNdviTileUrl).not.toHaveBeenCalled();
    expect(mocks.getCachedCanopyTileUrl).not.toHaveBeenCalled();
    expect(mocks.getCachedGiTileUrl).not.toHaveBeenCalled();
  });

  it("include=lst,ndvi skips AQI and tiles", async () => {
    await getMapEnvBundle("lst,ndvi");
    expect(mocks.getCachedBarangayGeeBundle).toHaveBeenCalledOnce();
    expect(mocks.getCachedAqiFeatureCollection).not.toHaveBeenCalled();
    expect(mocks.getCachedLstTileUrl).not.toHaveBeenCalled();
    expect(mocks.getCachedGiTileUrl).not.toHaveBeenCalled();
  });

  it("include=gitile only fetches GI tile URL", async () => {
    await getMapEnvBundle("gi_tile");
    expect(mocks.getCachedBarangayGeeBundle).not.toHaveBeenCalled();
    expect(mocks.getCachedAqiFeatureCollection).not.toHaveBeenCalled();
    expect(mocks.getCachedGiTileUrl).toHaveBeenCalledOnce();
    expect(mocks.getCachedLstTileUrl).not.toHaveBeenCalled();
  });
});

describe("getMapEnvEtagDateKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCachedBarangayGeeBundle.mockResolvedValue(mockGeeBundle);
  });

  it("uses GEE dateKey when barangay geo layers are included", async () => {
    await expect(getMapEnvEtagDateKey(null)).resolves.toBe("20250115");
    expect(mocks.getCachedBarangayGeeBundle).toHaveBeenCalledOnce();
  });

  it("uses GEE dateKey for include=lst", async () => {
    await expect(getMapEnvEtagDateKey("lst")).resolves.toBe("20250115");
    expect(mocks.getCachedBarangayGeeBundle).toHaveBeenCalledOnce();
  });

  it("uses calendar UTC dateKey when only aqi is included", async () => {
    vi.useFakeTimers({ now: new Date("2025-06-20T12:00:00.000Z") });
    try {
      await expect(getMapEnvEtagDateKey("aqi")).resolves.toBe(
        calendarDateKeyUtc(),
      );
      expect(mocks.getCachedBarangayGeeBundle).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
