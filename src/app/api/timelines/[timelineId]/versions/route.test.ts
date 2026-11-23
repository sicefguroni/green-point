import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, findUnique, versionCreate, timelineUpdate } = vi.hoisted(() => ({
  getUser: vi.fn(),
  findUnique: vi.fn(),
  versionCreate: vi.fn(),
  timelineUpdate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    projectTimeline: { findUnique, update: timelineUpdate },
    projectTimelineVersion: { create: versionCreate },
  };
  return {
    prisma: { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) },
  };
});

import { POST } from "./route";

const snapshot = {
  objective: "Plant shade trees",
  locationLabel: "Tabok",
  generatedAt: "2026-11-01T00:00:00.000Z",
  constraints: [],
  phases: [
    {
      id: "p1",
      title: "Planning",
      subtitle: "",
      iconKey: "LAYOUT_PANEL_TOP",
      startDate: "2026-11-01T00:00:00.000Z",
      endDate: "2026-11-10T00:00:00.000Z",
      tasks: [],
    },
  ],
};

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/timelines/t1/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot, ...body }),
    }),
    { params: Promise.resolve({ timelineId: "t1" }) },
  );
}

describe("POST /api/timelines/[timelineId]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    findUnique.mockResolvedValue({
      id: "t1",
      status: "draft",
      versions: [{ id: "v2", versionNumber: 2 }],
    });
    versionCreate.mockImplementation(async ({ data }) => ({
      id: "v3",
      ...data,
      createdAt: new Date("2026-11-23T00:00:00.000Z"),
    }));
  });

  it("rejects a save based on an outdated version with 409", async () => {
    const response = await post({ expectedVersionId: "v1" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "VERSION_CONFLICT",
      latestVersionId: "v2",
    });
    expect(versionCreate).not.toHaveBeenCalled();
  });

  it("saves when the expected version is still the latest", async () => {
    const response = await post({ expectedVersionId: "v2" });

    expect(response.status).toBe(201);
    expect(versionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ versionNumber: 3, basedOnVersionId: "v2" }),
    });
  });

  it("reports a concurrent insert of the same version number as a conflict", async () => {
    versionCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const response = await post({ expectedVersionId: "v2" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "VERSION_CONFLICT",
      latestVersionId: null,
    });
  });
});
