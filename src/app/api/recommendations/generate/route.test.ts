import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUser,
  barangayFindFirst,
  recFindMany,
  recDeleteMany,
  openaiCreate,
  retrieveRelevantChunks,
  buildGenerationPrompt,
  resolveTrustedLocationMetrics,
} = vi.hoisted(() => ({
  getUser: vi.fn(),
  barangayFindFirst: vi.fn(),
  recFindMany: vi.fn(),
  recDeleteMany: vi.fn(),
  openaiCreate: vi.fn(),
  retrieveRelevantChunks: vi.fn(),
  buildGenerationPrompt: vi.fn(() => ({ systemPrompt: "s", userPrompt: "u" })),
  resolveTrustedLocationMetrics: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    barangay: { findFirst: barangayFindFirst },
    greeningRecommendation: { findMany: recFindMany, deleteMany: recDeleteMany },
  },
}));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: openaiCreate } };
  },
}));

vi.mock("@/lib/rag", () => ({
  retrieveRelevantChunks,
  buildGenerationPrompt,
}));

const { isValidRecommendationBatch } = vi.hoisted(() => ({
  isValidRecommendationBatch: vi.fn(),
}));

vi.mock("@/lib/recommendations/generation-quality", () => ({
  sanitizeGeneratedRecommendations: (recs: unknown) => recs,
  // Cache-read grounding is covered in generation-quality.test.ts; here the
  // cached rows pass through so the auth paths are tested on their own.
  groundCachedRecommendations: (rows: unknown) => rows,
  normalizeUnitScore: (value: unknown) => Number(value) || 0.5,
  isValidRecommendationBatch,
}));

vi.mock("@/lib/recommendations/corpus", () => ({
  loadStudyTitles: vi.fn(async () => []),
}));

vi.mock("@/lib/recommendations/trusted-location-metrics", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/recommendations/trusted-location-metrics")
  >()),
  resolveTrustedLocationMetrics,
}));

import { DELETE, POST } from "./route";

/** Tabok's live metrics, as the server reads them. */
const LIVE_TABOK = {
  areaName: "Tabok",
  ndvi: 0.21,
  lst: 34.5,
  treeCanopy: 0.12,
  greeneryIndex: 0.234,
  greeneryLevel: "Low",
  taggedTreeCount: 4,
  inventoryCanopyFraction: 0.01,
  areaHectares: 120,
};

const CACHED_ROW = {
  id: "rec-1",
  title: "Rain Garden",
  description: "Cached recommendation",
  source: "AI Engine",
  barangayID: "b-tabok",
};

function request(method: "POST" | "DELETE", body: unknown) {
  return new NextRequest("http://localhost/api/recommendations/generate", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function signedOut() {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
}

function providerEnv() {
  process.env.AI_PRIMARY_PROVIDER = "openai";
  process.env.AI_FALLBACK_PROVIDER = "gemini";
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_CHAT_MODEL = "test-model";
  // No fallback configured, so nothing reaches the network.
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_CHAT_MODEL;
}

describe("/api/recommendations/generate auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerEnv();
    barangayFindFirst.mockResolvedValue({ id: "b-tabok", barangayName: "Tabok" });
    recFindMany.mockResolvedValue([]);
    isValidRecommendationBatch.mockReturnValue(true);
    resolveTrustedLocationMetrics.mockResolvedValue({ ok: true, metrics: LIVE_TABOK });
  });

  it("does not let signed-out visitors clear an invalid cached batch", async () => {
    signedOut();
    recFindMany.mockResolvedValue([CACHED_ROW]);
    isValidRecommendationBatch.mockReturnValue(false);

    const res = await POST(request("POST", { barangayName: "Tabok" }));

    expect(res.status).toBe(401);
    expect(recDeleteMany).not.toHaveBeenCalled();
    expect(openaiCreate).not.toHaveBeenCalled();
  });

  it("lets a signed-in user replace an invalid cached batch", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: {} } }, error: null });
    recFindMany.mockResolvedValue([CACHED_ROW]);
    isValidRecommendationBatch.mockReturnValue(false);
    retrieveRelevantChunks.mockRejectedValue(new Error("stop after clearing"));

    await POST(request("POST", { barangayName: "Tabok" }));

    expect(recDeleteMany).toHaveBeenCalled();
  });

  it("serves cached recommendations to signed-out visitors without calling the AI", async () => {
    signedOut();
    recFindMany.mockResolvedValue([CACHED_ROW]);

    const res = await POST(request("POST", { barangayName: "Tabok" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.meta.cacheHit).toBe(true);
    expect(openaiCreate).not.toHaveBeenCalled();
  });

  it("asks signed-out visitors to sign in on a cache miss, before any AI call", async () => {
    signedOut();

    const res = await POST(request("POST", { barangayName: "Tabok" }));

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Sign in to generate AI solutions.");
    expect(retrieveRelevantChunks).not.toHaveBeenCalled();
    expect(openaiCreate).not.toHaveBeenCalled();
  });

  it("does not let signed-out visitors clear the cache with regenerate", async () => {
    signedOut();
    recFindMany.mockResolvedValue([CACHED_ROW]);

    const res = await POST(request("POST", { barangayName: "Tabok", regenerate: true }));

    expect(res.status).toBe(401);
    expect(recDeleteMany).not.toHaveBeenCalled();
    expect(openaiCreate).not.toHaveBeenCalled();
  });

  it("does not let signed-out visitors delete cached recommendations", async () => {
    signedOut();

    const res = await DELETE(request("DELETE", { barangayName: "Tabok" }));

    expect(res.status).toBe(401);
    expect(recDeleteMany).not.toHaveBeenCalled();
  });

  it("lets a signed-in user reach generation on a cache miss", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: {} } }, error: null });
    retrieveRelevantChunks.mockRejectedValue(new Error("stop after the auth check"));

    const res = await POST(request("POST", { barangayName: "Tabok" }));

    expect(res.status).not.toBe(401);
    expect(retrieveRelevantChunks).toHaveBeenCalled();
  });
});

describe("/api/recommendations/generate errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerEnv();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: {} } }, error: null });
    barangayFindFirst.mockResolvedValue({ id: "b-tabok", barangayName: "Tabok" });
    recFindMany.mockResolvedValue([]);
    retrieveRelevantChunks.mockResolvedValue({ chunks: [], query: "q" });
    resolveTrustedLocationMetrics.mockResolvedValue({ ok: true, metrics: LIVE_TABOK });
  });

  it("never sends the provider's own error message to the browser", async () => {
    openaiCreate.mockRejectedValue(
      Object.assign(new Error("401 Incorrect API key provided: sk-proj-****abcd"), {
        status: 401,
      }),
    );

    const res = await POST(request("POST", { barangayName: "Tabok" }));
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error).toBe(
      "AI recommendations are unavailable right now. Please try again in a moment.",
    );
    expect(JSON.stringify(json)).not.toMatch(/sk-proj|Incorrect API key/);
  });

  it("still explains an unusable answer, which is safe to show", async () => {
    openaiCreate.mockResolvedValue({ choices: [{ message: { content: "not json" } }] });

    const res = await POST(request("POST", { barangayName: "Tabok" }));

    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("AI returned an invalid format. Please try again.");
  });
});

describe("/api/recommendations/generate shared-cache metrics", () => {
  const FORGED = {
    barangayName: "Tabok",
    ndvi: 0.95,
    lst: 12,
    treeCanopy: 0.99,
    greeneryIndex: 0.99,
    greeneryLevel: "Very High",
    taggedTreeCount: 99999,
    inventoryCanopyFraction: 1,
    areaHectares: 0.01,
    floodHazard: 42,
    stormHazard: 2,
    aqi: 99999,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    providerEnv();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: {} } }, error: null });
    barangayFindFirst.mockResolvedValue({ id: "b-tabok", barangayName: "Tabok" });
    recFindMany.mockResolvedValue([]);
    isValidRecommendationBatch.mockReturnValue(true);
    retrieveRelevantChunks.mockResolvedValue({ chunks: [], query: "q" });
    resolveTrustedLocationMetrics.mockResolvedValue({ ok: true, metrics: LIVE_TABOK });
  });

  it("generates from the server's live metrics, not the ones the browser sent", async () => {
    // Stop right after the prompt is built; the context is what matters.
    openaiCreate.mockRejectedValue(new Error("stop"));

    await POST(request("POST", { ...FORGED, regenerate: true }));

    expect(resolveTrustedLocationMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "barangay", barangayName: "Tabok" }),
    );
    const context = buildGenerationPrompt.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >;
    expect(context).toMatchObject({
      areaName: "Tabok",
      ndvi: 0.21,
      lst: 34.5,
      treeCanopy: 0.12,
      greeneryIndex: 0.234,
      greeneryLevel: "Low",
      taggedTreeCount: 4,
      inventoryCanopyFraction: 0.01,
      areaHectares: 120,
      floodHazard: null,
      stormHazard: 2,
      aqi: null,
    });
  });

  it("looks the barangay up by its stored name, whatever casing was sent", async () => {
    retrieveRelevantChunks.mockRejectedValue(new Error("stop"));

    await POST(request("POST", { barangayId: "b-tabok", barangayName: "TABOK" }));

    expect(resolveTrustedLocationMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ barangayName: "Tabok" }),
    );
  });

  it("keeps the shared cache when the location has no live metrics", async () => {
    resolveTrustedLocationMetrics.mockResolvedValue({ ok: false, reason: "not_found" });

    const res = await POST(request("POST", { ...FORGED, regenerate: true }));

    expect(res.status).toBe(404);
    expect(recDeleteMany).not.toHaveBeenCalled();
    expect(retrieveRelevantChunks).not.toHaveBeenCalled();
    expect(openaiCreate).not.toHaveBeenCalled();
  });

  it("keeps an invalid cached batch when live metrics can't load", async () => {
    recFindMany.mockResolvedValue([CACHED_ROW]);
    isValidRecommendationBatch.mockReturnValue(false);
    resolveTrustedLocationMetrics.mockResolvedValue({ ok: false, reason: "unavailable" });

    const res = await POST(request("POST", { barangayName: "Tabok" }));

    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe(
      "Location data is unavailable right now. Please try again in a moment.",
    );
    expect(recDeleteMany).not.toHaveBeenCalled();
    expect(openaiCreate).not.toHaveBeenCalled();
  });

  it("does not resolve live metrics for a cache hit", async () => {
    recFindMany.mockResolvedValue([CACHED_ROW]);

    const res = await POST(request("POST", { barangayName: "Tabok" }));

    expect((await res.json()).meta.cacheHit).toBe(true);
    expect(resolveTrustedLocationMetrics).not.toHaveBeenCalled();
  });
});
