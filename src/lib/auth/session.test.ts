import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

import { isAdminUser, requireAdmin, requireUser } from "./session";

describe("isAdminUser", () => {
  it("accepts only app_metadata.role ADMIN", () => {
    expect(isAdminUser({ app_metadata: { role: "ADMIN" } })).toBe(true);
    expect(isAdminUser({ app_metadata: { role: "admin" } })).toBe(true);
    expect(isAdminUser({ app_metadata: { role: "RESIDENT" } })).toBe(false);
    expect(isAdminUser({ app_metadata: {} })).toBe(false);
  });

  it("ignores a role the user wrote into user_metadata", () => {
    const user = { app_metadata: {}, user_metadata: { role: "ADMIN" } };
    expect(isAdminUser(user)).toBe(false);
  });
});

describe("requireUser / requireAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const check = await requireUser("Sign in first.");

    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.response.status).toBe(401);
      expect(await check.response.json()).toEqual({ success: false, error: "Sign in first." });
    }
  });

  it("returns 401 when Supabase reports an error", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    expect((await requireUser()).ok).toBe(false);
  });

  it("returns 403 for a signed-in non-admin", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: {} } }, error: null });

    const check = await requireAdmin();

    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.response.status).toBe(403);
  });

  it("passes an admin through", async () => {
    const admin = { id: "a1", app_metadata: { role: "ADMIN" } };
    getUser.mockResolvedValue({ data: { user: admin }, error: null });

    const check = await requireAdmin();

    expect(check).toEqual({ ok: true, user: admin });
  });
});
