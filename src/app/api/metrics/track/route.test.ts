import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, historyFindFirst, historyCreate, historyUpdate, historyCount, barangayFindFirst, barangayMetricsUpsert, pointMetricsUpsert } =
  vi.hoisted(() => ({
    getUser: vi.fn(),
    historyFindFirst: vi.fn(),
    historyCreate: vi.fn(),
    historyUpdate: vi.fn(),
    historyCount: vi.fn(),
    barangayFindFirst: vi.fn(),
    barangayMetricsUpsert: vi.fn(),
    pointMetricsUpsert: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userLocationMetricHistory: {
      findFirst: historyFindFirst,
      create: historyCreate,
      update: historyUpdate,
      count: historyCount,
    },
    barangay: { findFirst: barangayFindFirst },
    barangayMetrics: { upsert: barangayMetricsUpsert },
    pointMetrics: { upsert: pointMetricsUpsert },
  },
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/metrics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const valid = {
  locationType: "BARANGAY",
  locationName: "Tabok",
  coordinates: { lat: 10.3561, lng: 123.9512 },
  ndvi: 0.18,
  lst: 33.5,
  treeCanopy: 0.06,
  greeneryIndex: 0.2,
  greeneryLevel: "Low",
  aqi: 42,
};

describe("POST /api/metrics/track", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    historyFindFirst.mockResolvedValue(null);
    historyCount.mockResolvedValue(0);
    historyCreate.mockImplementation(async ({ data }) => ({ id: "h1", ...data }));
  });

  it("rejects signed-out requests", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await post(valid);
    expect(res.status).toBe(401);
    expect(historyCreate).not.toHaveBeenCalled();
  });

  it("records the view in the user's own history", async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        supabaseUserId: "user-1",
        locationType: "BARANGAY",
        locationName: "Tabok",
        ndvi: 0.18,
        coordinates: { lat: 10.3561, lng: 123.9512 },
      }),
    });
  });

  it.each(["BARANGAY", "POINT"])(
    "never writes the shared metrics tables for a %s view",
    async (locationType) => {
      await post({ ...valid, locationType, locationId: "p-1" });
      expect(barangayFindFirst).not.toHaveBeenCalled();
      expect(barangayMetricsUpsert).not.toHaveBeenCalled();
      expect(pointMetricsUpsert).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["an NDVI above 1", { ndvi: 99 }, "ndvi"],
    ["a canopy fraction above 1", { treeCanopy: 1.5 }, "treeCanopy"],
    ["an implausible LST", { lst: 500 }, "lst"],
    ["a non-numeric metric", { greeneryIndex: "0.9" }, "greeneryIndex"],
    ["an unknown location type", { locationType: "CITY" }, "locationType"],
    ["out-of-range coordinates", { coordinates: { lat: 200, lng: 0 } }, "coordinates.lat"],
    ["an over-long name", { locationName: "x".repeat(500) }, "locationName"],
  ])("rejects %s with 400 and writes nothing", async (_label, patch, field) => {
    const res = await post({ ...valid, ...patch });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fields).toContain(field);
    expect(historyCreate).not.toHaveBeenCalled();
  });

  it("rejects a body that isn't JSON", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
  });

  it("stores AQI -1 (the hazard layer's 'no reading') as null", async () => {
    const res = await post({ ...valid, aqi: -1 });
    expect(res.status).toBe(200);
    expect(historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ aqi: null }),
    });
  });

  it("tracks a CUSTOM location once per day, like the other types", async () => {
    historyFindFirst.mockResolvedValue({ id: "h0", ndvi: 0.2, lst: 31, treeCanopy: 0, greeneryIndex: 0.2 });
    const res = await post({ locationType: "CUSTOM", coordinates: { lat: 10.35, lng: 123.94 }, ndvi: 0.2 });
    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Already tracked today");
    expect(historyFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        locationType: "CUSTOM",
        coordinates: { equals: { lat: 10.35, lng: 123.94 } },
      }),
    });
    expect(historyCreate).not.toHaveBeenCalled();
  });

  it("stops adding rows after the daily cap", async () => {
    historyCount.mockResolvedValue(300);
    const res = await post({ ...valid, locationName: "Centro" });
    expect(res.status).toBe(429);
    expect(historyCreate).not.toHaveBeenCalled();
  });

  it("still adds a row just under the cap", async () => {
    historyCount.mockResolvedValue(299);
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(historyCreate).toHaveBeenCalledTimes(1);
  });

  it("accepts a view with no metrics yet", async () => {
    const res = await post({ locationType: "CUSTOM", coordinates: { lat: 10.35, lng: 123.94 } });
    expect(res.status).toBe(200);
  });
});
