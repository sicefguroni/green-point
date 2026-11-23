import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, checkSwarmHealth } = vi.hoisted(() => ({
  getUser: vi.fn(),
  checkSwarmHealth: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

vi.mock("@/lib/timeline/swarm-client", () => ({ checkSwarmHealth }));

import { GET } from "./route";

describe("GET /api/timeline/warmup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns 200 once the swarm service answers its health check", async () => {
    checkSwarmHealth.mockResolvedValueOnce(true);

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ready: true });
  });

  it("returns 503 while the service is still waking", async () => {
    checkSwarmHealth.mockResolvedValueOnce(false);

    const res = await GET();

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ ready: false });
  });

  it("does not wake the service for anonymous visitors", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const res = await GET();

    expect(res.status).toBe(401);
    expect(checkSwarmHealth).not.toHaveBeenCalled();
  });
});
