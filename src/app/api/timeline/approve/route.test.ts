import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const approveAgentTimeline = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser,
    },
  })),
}));

vi.mock("@/lib/timeline/swarm-client", () => ({
  approveAgentTimeline: (...args: unknown[]) => approveAgentTimeline(...args),
}));

import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/timeline/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockApproveResponse = {
  threadId: "mandaue-demo-thread-001",
  status: "approved" as const,
  revisionCount: 1,
  ragMetadata: {
    project_title: "Riparian Cooling and Flood Buffer Program",
  },
  pendingRisks: [],
  timeline: {
    projectTitle: "Riparian Cooling and Flood Buffer Program",
    totalDurationWeeks: 14,
    risks: [],
    strategySummary: "Sequence permits, procurement, and field execution.",
    phases: [
      {
        id: "phase-1",
        name: "Site Assessment and Stakeholder Alignment",
        reasoningForDuration: "Needs baseline verification and coordination.",
        startWeek: 1,
        durationWeeks: 3,
        dependencies: [],
        category: "planning" as const,
      },
    ],
  },
  uiSnapshot: {
    objective: "Riparian Cooling and Flood Buffer Program",
    locationLabel: "Mandaue City",
    generatedAt: new Date().toISOString(),
    constraints: [],
    phases: [
      {
        id: "phase-1",
        title: "Site Assessment and Stakeholder Alignment",
        subtitle: "Needs baseline verification and coordination.",
        iconKey: "LAYOUT_PANEL_TOP" as const,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        tasks: [
          {
            id: "phase-1-task",
            title: "Site Assessment and Stakeholder Alignment",
            description: "Needs baseline verification and coordination.",
            phaseId: "phase-1",
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
          },
        ],
      },
    ],
  },
};

describe("POST /api/timeline/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    approveAgentTimeline.mockResolvedValue(mockApproveResponse);
  });

  it("returns 200 for a valid approval request", async () => {
    const res = await POST(
      makeRequest({
        threadId: "mandaue-demo-thread-001",
        reviewAction: "approve",
      }) as never,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("approved");
    expect(approveAgentTimeline).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when the user is not authenticated", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const res = await POST(
      makeRequest({
        threadId: "mandaue-demo-thread-001",
        reviewAction: "approve",
      }) as never,
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid approval body", async () => {
    const res = await POST(
      makeRequest({
        threadId: "",
        reviewAction: "approve",
      }) as never,
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/threadId/i);
  });

  it("returns 502 when approval fails downstream", async () => {
    approveAgentTimeline.mockRejectedValueOnce(
      new Error("Timeline approval failed"),
    );

    const res = await POST(
      makeRequest({
        threadId: "mandaue-demo-thread-001",
        reviewAction: "approve",
      }) as never,
    );

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});