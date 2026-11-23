import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  refreshCurrentBarangayMetrics: vi.fn(),
  upsertBarangayHistoryMonth: vi.fn(),
  pointDeleteMany: vi.fn(),
  customAreaDeleteMany: vi.fn(),
  historyDeleteMany: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    point: { deleteMany: m.pointDeleteMany },
    customArea: { deleteMany: m.customAreaDeleteMany },
    userLocationMetricHistory: { deleteMany: m.historyDeleteMany },
  },
}));
vi.mock("@/lib/data-pipeline/static-geo-source", () => ({
  getCachedMandaueBarangayBoundaries: vi.fn(async () => ({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Tabok" },
        geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      },
    ],
  })),
}));
vi.mock("@/lib/data-pipeline/tree-canopy", () => ({ getCachedTaggedTrees: vi.fn(async () => []) }));
vi.mock("@/lib/data-pipeline/barangay-metrics-refresh", async (orig) => ({
  ...(await orig<typeof import("@/lib/data-pipeline/barangay-metrics-refresh")>()),
  refreshCurrentBarangayMetrics: m.refreshCurrentBarangayMetrics,
  upsertBarangayHistoryMonth: m.upsertBarangayHistoryMonth,
}));

import { GET } from "./route";

const call = (auth?: string) =>
  GET(new Request("http://localhost/api/cron/data-pipeline", { headers: auth ? { authorization: auth } : {} }));

describe("GET /api/cron/data-pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cret";
    m.refreshCurrentBarangayMetrics.mockResolvedValue({
      updated: 1,
      unmatched: [],
      metrics: new Map([["Tabok", { ndvi: 0.24, lst: 33 }]]),
    });
    m.upsertBarangayHistoryMonth.mockResolvedValue({ written: 1, missingNdvi: [], missingLst: [] });
    for (const f of [m.pointDeleteMany, m.customAreaDeleteMany, m.historyDeleteMany]) f.mockResolvedValue({ count: 0 });
  });

  it("rejects calls without the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(m.refreshCurrentBarangayMetrics).not.toHaveBeenCalled();
  });

  it("refreshes current metrics and last month's history over the barangay polygons", async () => {
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    const polygons = m.refreshCurrentBarangayMetrics.mock.calls[0][1];
    expect(polygons.map((p: { name: string }) => p.name)).toEqual(["Tabok"]);
    const [, , , month, annualLst] = m.upsertBarangayHistoryMonth.mock.calls[0];
    expect(month).toMatch(/^\d{4}-\d{2}$/);
    expect(annualLst.get("Tabok")).toBe(33);
  });

  it("never deletes a custom area that has a timeline on one of its recommendations", async () => {
    await call("Bearer s3cret");
    expect(m.customAreaDeleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expect.any(Date) },
        recommendations: { none: { projectTimeline: { isNot: null } } },
      },
    });
  });
});
