import { describe, expect, it, vi } from "vitest";

const { historyFindFirst } = vi.hoisted(() => ({ historyFindFirst: vi.fn() }));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { userLocationMetricHistory: { findFirst: historyFindFirst } },
}));
vi.mock("@/lib/api/nasa_power", () => ({
  fetchNasaPowerPoint: vi.fn(async () => ({
    lst: null,
    t2m: 29,
    humidity: 70,
    precipitation: 0,
    timestamp: "2026-11-23T00:00:00Z",
  })),
}));
vi.mock("@/lib/api/gee_service", () => ({
  fetchGeeMetricsPoint: vi.fn(async () => ({ ndvi: 0.42, lst: 31.2 })),
}));
vi.mock("@/lib/data-pipeline/tree-canopy", () => ({
  getCachedTaggedTrees: vi.fn(async () => []),
  computePointInventoryCanopy: vi.fn(() => 0),
  blendCanopy: vi.fn((_inv: number, spectral: number) => spectral),
}));

import { fetchGeeMetricsPoint } from "@/lib/api/gee_service";
import { fetchNasaPowerPoint } from "@/lib/api/nasa_power";
import { getCachedPointEnvironmentalMetrics } from "./point-environmental-metrics";

describe("getCachedPointEnvironmentalMetrics", () => {
  it("uses satellite values, never another user's tracked history", async () => {
    // A tracked row with browser-sent values must not be served as the point's metrics.
    historyFindFirst.mockResolvedValue({ ndvi: 0.99, lst: 10, treeCanopy: 1 });

    const res = await getCachedPointEnvironmentalMetrics(10.35, 123.94);

    expect(historyFindFirst).not.toHaveBeenCalled();
    expect(res.metrics.ndvi).toBe(0.42);
    expect(res.metrics.lst).toBe(31.2);
    expect(res.sources.ndvi).toMatch(/Sentinel-2/);
  });

  it("lists nothing as estimated when every metric was measured", async () => {
    const res = await getCachedPointEnvironmentalMetrics(10.35, 123.94);
    expect(res.metrics.estimated).toEqual([]);
  });

  it("marks NDVI as estimated when the pixel has no reading", async () => {
    vi.mocked(fetchGeeMetricsPoint).mockResolvedValueOnce({ ndvi: null, lst: 31.2 });

    const res = await getCachedPointEnvironmentalMetrics(10.35, 123.94);

    expect(res.metrics.ndvi).toBe(0.3);
    expect(res.metrics.estimated).toEqual(["ndvi"]);
  });

  it("takes LST from NASA POWER before calling it estimated", async () => {
    vi.mocked(fetchGeeMetricsPoint).mockResolvedValueOnce({ ndvi: 0.42, lst: null });
    vi.mocked(fetchNasaPowerPoint).mockResolvedValueOnce({
      lst: 33.1,
      t2m: 29,
      humidity: 70,
      precipitation: 0,
      timestamp: "2026-11-23T00:00:00Z",
    } as Awaited<ReturnType<typeof fetchNasaPowerPoint>>);

    const res = await getCachedPointEnvironmentalMetrics(10.35, 123.94);

    expect(res.metrics.lst).toBe(33.1);
    expect(res.metrics.estimated).toEqual([]);
  });

  it("marks LST as estimated when neither source has it", async () => {
    vi.mocked(fetchGeeMetricsPoint).mockResolvedValueOnce({ ndvi: 0.42, lst: null });

    const res = await getCachedPointEnvironmentalMetrics(10.35, 123.94);

    expect(res.metrics.lst).toBe(30);
    expect(res.metrics.estimated).toEqual(["lst"]);
  });
});
