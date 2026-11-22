import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, recFindMany, generateAIBarangayRecs, readStaticBarangayMetrics } = vi.hoisted(
  () => ({
    getUser: vi.fn(),
    recFindMany: vi.fn(),
    generateAIBarangayRecs: vi.fn(),
    readStaticBarangayMetrics: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { greeningRecommendation: { findMany: recFindMany } },
}));

vi.mock("@/lib/recommendations/barangay-backfill", () => ({
  readStaticBarangayMetrics,
  generateAIBarangayRecs,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/recommendations/backfill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function signedInAs(user: unknown) {
  getUser.mockResolvedValue({ data: { user }, error: null });
}

describe("POST /api/recommendations/backfill auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readStaticBarangayMetrics.mockReturnValue([{ name: "Tabok", ndvi: 0.04 }]);
    recFindMany.mockResolvedValue([{ barangay: { barangayName: "Tabok" } }]);
  });

  it("rejects signed-out callers", async () => {
    signedInAs(null);

    const res = await POST(request({}));

    expect(res.status).toBe(401);
    expect(generateAIBarangayRecs).not.toHaveBeenCalled();
  });

  it("does not let a non-admin force-regenerate every barangay", async () => {
    signedInAs({ id: "u1", app_metadata: {}, user_metadata: { role: "ADMIN" } });

    const res = await POST(request({ force: true }));

    expect(res.status).toBe(403);
    expect(generateAIBarangayRecs).not.toHaveBeenCalled();
  });

  it("lets a signed-in user fill in missing barangays", async () => {
    signedInAs({ id: "u1", app_metadata: {} });

    const res = await POST(request({}));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.processed).toBe(0);
  });

  it("lets an admin force-regenerate", async () => {
    signedInAs({ id: "a1", app_metadata: { role: "ADMIN" } });
    generateAIBarangayRecs.mockResolvedValue(undefined);

    const res = await POST(request({ force: true }));

    expect(res.status).toBe(200);
    expect(generateAIBarangayRecs).toHaveBeenCalledTimes(1);
  });
});
