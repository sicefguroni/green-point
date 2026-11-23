import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { barangayHistoricalMetrics: { findMany } },
}));

import { GET } from "./route";

const get = (name: string) =>
  GET(new NextRequest(`http://localhost/api/barangays/${encodeURIComponent(name)}/history`), {
    params: Promise.resolve({ id: encodeURIComponent(name) }),
  });

function row(month: string) {
  return { month, year: Number(month.slice(0, 4)), NDVI: 0.2, LST: 31, treeCanopy: 0.05 };
}

describe("GET /api/barangays/[id]/history", () => {
  beforeEach(() => findMany.mockReset());

  it("asks for the newest 60 months and returns them oldest first", async () => {
    // Prisma returns newest first because of the desc order.
    findMany.mockResolvedValue([row("2026-03"), row("2026-02"), row("2025-12")]);

    const res = await get("Ibabao Estancia");
    const body = await res.json();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { barangay: { barangayID: "ibabao-estancia" } },
        orderBy: { month: "desc" },
        take: 60,
      }),
    );
    expect(body.data.monthly.map((m: { fullDate: string }) => m.fullDate)).toEqual([
      "2025-12",
      "2026-02",
      "2026-03",
    ]);
    expect(body.data.monthly[0].month).toBe("Dec");
  });

  it("returns 404 when there is no history", async () => {
    findMany.mockResolvedValue([]);
    const res = await get("Tabok");
    expect(res.status).toBe(404);
  });
});
