import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, recCreate, recUpdate } = vi.hoisted(() => ({
  getUser: vi.fn(),
  recCreate: vi.fn(),
  recUpdate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { greeningRecommendation: { create: recCreate, update: recUpdate } },
}));

import { POST, PUT } from "./route";

const VALID_BODY = {
  recommendationID: "rec-1",
  name: "Rain Garden",
  description: "Bioswale",
  interventionType: "Rain Garden",
  relevancy: 0.8,
};

const post = () =>
  POST(
    new NextRequest("http://localhost/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    }),
  );
const put = () =>
  PUT(
    new NextRequest("http://localhost/api/recommendations?id=rec-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Rewritten" }),
    }),
  );

function signedInAs(user: unknown) {
  getUser.mockResolvedValue({ data: { user }, error: null });
}

describe("/api/recommendations writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recCreate.mockResolvedValue({ id: "rec-1" });
    recUpdate.mockResolvedValue({ id: "rec-1" });
  });

  it("rejects signed-out callers", async () => {
    signedInAs(null);

    expect((await post()).status).toBe(401);
    expect((await put()).status).toBe(401);
    expect(recCreate).not.toHaveBeenCalled();
    expect(recUpdate).not.toHaveBeenCalled();
  });

  it("rejects signed-in non-admins, including a self-claimed role", async () => {
    signedInAs({ id: "u1", app_metadata: {}, user_metadata: { role: "ADMIN" } });

    expect((await post()).status).toBe(403);
    expect((await put()).status).toBe(403);
    expect(recCreate).not.toHaveBeenCalled();
    expect(recUpdate).not.toHaveBeenCalled();
  });

  it("lets an admin create and update", async () => {
    signedInAs({ id: "a1", app_metadata: { role: "ADMIN" } });

    expect((await post()).status).toBe(201);
    expect((await put()).status).toBe(200);
  });
});
