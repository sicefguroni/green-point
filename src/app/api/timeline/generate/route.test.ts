import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const generateAgentTimeline = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser,
    },
  })),
}));

vi.mock("@/lib/timeline/swarm-client", () => ({
  generateAgentTimeline: (...args: unknown[]) => generateAgentTimeline(...args),
}));

import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/timeline/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockTimelineResponse = {
  threadId: "mandaue-demo-thread-001",
  status: "awaiting_human_review" as const,
  revisionCount: 1,
  ragMetadata: {
    project_title: "Riparian Cooling and Flood Buffer Program",
    barangay_name: "Subangdaku",
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
    locationLabel: "Barangay Subangdaku, Mandaue City",
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

describe("POST /api/timeline/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    generateAgentTimeline.mockResolvedValue(mockTimelineResponse);
  });

  it("returns 200 for a valid request", async () => {
    const res = await POST(
      makeRequest({
        threadId: "mandaue-demo-thread-001",
        ragMetadata: {
          project_title: "Riparian Cooling and Flood Buffer Program",
          barangay_name: "Subangdaku",
        },
      }) as never,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.threadId).toBe("mandaue-demo-thread-001");
    expect(generateAgentTimeline).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when the user is not authenticated", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const res = await POST(
      makeRequest({
        threadId: "mandaue-demo-thread-001",
        ragMetadata: {},
      }) as never,
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 for an invalid request body", async () => {
    const res = await POST(
      makeRequest({
        threadId: "",
        ragMetadata: {},
      }) as never,
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/threadId/i);
  });

  it("returns 502 when the swarm client fails", async () => {
    generateAgentTimeline.mockRejectedValueOnce(
      new Error("Timeline swarm request failed"),
    );

    const res = await POST(
      makeRequest({
        threadId: "mandaue-demo-thread-001",
        ragMetadata: {
          project_title: "Riparian Cooling and Flood Buffer Program",
        },
      }) as never,
    );

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/failed/i);
  });
});