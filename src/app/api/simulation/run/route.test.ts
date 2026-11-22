import { describe, expect, it, vi, beforeEach } from "vitest";

const { generateNarrative, getUser } = vi.hoisted(() => ({
  generateNarrative: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

vi.mock("@/lib/simulation/narrative", () => ({
  generateSimulationNarrative: (...args: unknown[]) => generateNarrative(...args),
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1", app_metadata: {} } }, error: null });
  generateNarrative.mockResolvedValue({
    narrative: {
      effectivenessRationale: "Mocked rationale.",
      shortcomings: ["Mocked shortcoming."],
      sensitivityNarrative: "Mocked sensitivity.",
      metricCitations: {},
      citedStudies: [{ studyTitle: "Mock Study", similarity: 0.42 }],
    },
    retrievedChunks: 1,
    query: "mock query",
  });
});

const validBody = {
  inputs: {
    temperature_increase_rate: 0.03,
    flooding_severity: "medium",
    rainfall_change_rate: 5,
    canopy_target_percent: 15,
    ndvi_target: 0.1,
    intervention_type: "urban canopy",
    total_budget_cap: 5_000_000,
    cost_per_sqm: 35,
    maintenance_cost_rate: 8,
    time_horizon: 5,
  },
  baseline: {
    name: "Test",
    ndvi: 0.4,
    lst: 33,
    floodExposure: "Medium",
    greeneryIndex: 0.55,
    canopyCover: 25,
    currentIntervention: "Urban Canopy",
    areaHectares: 50,
  },
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/simulation/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/simulation/run", () => {
  it("returns 200 with engine + narrative for a valid body", async () => {
    const res = await POST(makeRequest(validBody) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.estimates.metrics.length).toBeGreaterThan(0);
    expect(json.data.narrative?.effectivenessRationale).toBe("Mocked rationale.");
    expect(json.data.meta.retrievedChunks).toBe(1);
  });

  it("returns 400 on invalid body", async () => {
    const bad = { inputs: { foo: 1 }, baseline: {} };
    const res = await POST(makeRequest(bad) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("falls back to null narrative when narrative layer fails", async () => {
    generateNarrative.mockResolvedValueOnce({
      narrative: null,
      retrievedChunks: 0,
      query: "mock",
      error: "LLM down",
    });
    const res = await POST(makeRequest(validBody) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.narrative).toBeNull();
    expect(json.data.meta.narrativeError).toBe("LLM down");
    expect(json.data.estimates.finalGI).toBeDefined();
  });

  it("rejects signed-out callers before running the engine or narrative", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const res = await POST(makeRequest(validBody) as never);

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Sign in to run a simulation.");
    expect(generateNarrative).not.toHaveBeenCalled();
  });
});
