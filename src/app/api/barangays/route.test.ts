import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, barangayCreate } = vi.hoisted(() => ({
  getUser: vi.fn(),
  barangayCreate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { barangay: { create: barangayCreate } },
}));

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

vi.mock("@/lib/data-api/service", () => ({
  DataApiError: class extends Error {},
  getResourcePayload: vi.fn(),
}));

import { POST } from "./route";

const post = () =>
  POST(
    new NextRequest("http://localhost/api/barangays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barangayID: "b-qa", cityID: "c-1", barangayName: "QA" }),
    }),
  );

function signedInAs(user: unknown) {
  getUser.mockResolvedValue({ data: { user }, error: null });
}

describe("POST /api/barangays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    barangayCreate.mockResolvedValue({ id: "b-qa" });
  });

  it("rejects signed-out callers", async () => {
    signedInAs(null);
    expect((await post()).status).toBe(401);
    expect(barangayCreate).not.toHaveBeenCalled();
  });

  it("rejects signed-in non-admins", async () => {
    signedInAs({ id: "u1", app_metadata: {} });
    expect((await post()).status).toBe(403);
    expect(barangayCreate).not.toHaveBeenCalled();
  });

  it("lets an admin create a barangay", async () => {
    signedInAs({ id: "a1", app_metadata: { role: "ADMIN" } });
    expect((await post()).status).toBe(201);
  });
});
