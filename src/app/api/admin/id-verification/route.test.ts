import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUser,
  findMany,
  findUnique,
  verificationUpdate,
  userUpdate,
  userFindFirst,
  systemLogCreate,
} = vi.hoisted(() => ({
  getUser: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  verificationUpdate: vi.fn(),
  userUpdate: vi.fn(),
  userFindFirst: vi.fn(),
  systemLogCreate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    iDVerification: { findMany, findUnique, update: verificationUpdate },
    user: { update: userUpdate, findFirst: userFindFirst },
    systemLog: { create: systemLogCreate },
  },
}));

import { GET, PUT } from "./route";

const ADMIN = {
  id: "admin-supabase-id",
  email: "admin@example.com",
  app_metadata: { role: "ADMIN" },
  user_metadata: {},
};

function signedInAs(user: unknown) {
  getUser.mockResolvedValue({ data: { user }, error: null });
}

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/id-verification", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const getRequest = () =>
  new NextRequest("http://localhost/api/admin/id-verification");

describe("/api/admin/id-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
    findUnique.mockResolvedValue({
      verificationID: "v1",
      status: "pending",
      plannerID: "planner-row",
      idType: "Government ID",
      planner: { userID: "planner-user" },
    });
    verificationUpdate.mockResolvedValue({ verificationID: "v1", status: "approved" });
    userFindFirst.mockResolvedValue(null);
  });

  it("rejects signed-out callers on GET and PUT", async () => {
    signedInAs(null);

    expect((await GET(getRequest())).status).toBe(401);
    expect((await PUT(putRequest({ verificationID: "v1", action: "approve" }))).status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
    expect(verificationUpdate).not.toHaveBeenCalled();
  });

  it("rejects a user who sets role ADMIN in their own user_metadata", async () => {
    signedInAs({
      id: "resident-id",
      email: "resident@example.com",
      app_metadata: {},
      user_metadata: { role: "ADMIN" },
    });

    expect((await GET(getRequest())).status).toBe(403);
    expect((await PUT(putRequest({ verificationID: "v1", action: "approve" }))).status).toBe(403);
    expect(verificationUpdate).not.toHaveBeenCalled();
  });

  it("lets an admin list verifications without exposing user passwords", async () => {
    signedInAs(ADMIN);

    const res = await GET(getRequest());

    expect(res.status).toBe(200);
    const query = findMany.mock.calls[0][0];
    expect(query.include.planner.include.user.select).not.toHaveProperty("password");
  });

  it("records the signed-in admin, ignoring any admin ID in the body", async () => {
    signedInAs(ADMIN);

    const res = await PUT(
      putRequest({ verificationID: "v1", action: "approve", adminUserID: "someone-else" }),
    );

    expect(res.status).toBe(200);
    expect(verificationUpdate.mock.calls[0][0].data.verifiedBy).toBe("admin-supabase-id");
    expect(verificationUpdate.mock.calls[0][0].include.planner.include.user.select).not.toHaveProperty(
      "password",
    );
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "planner-user" },
      data: { status: "ACTIVE" },
    });
    const log = systemLogCreate.mock.calls[0][0].data;
    expect(log.userID).toBeNull();
    expect(log.details.adminSupabaseUserId).toBe("admin-supabase-id");
  });

  it("does not leak internal error messages", async () => {
    signedInAs(ADMIN);
    verificationUpdate.mockRejectedValue(new Error("connection string postgres://secret"));

    const res = await PUT(putRequest({ verificationID: "v1", action: "reject" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to update verification");
  });
});
