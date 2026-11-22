import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUser,
  barangayFindFirst,
  recFindMany,
  recDeleteMany,
  openaiCreate,
  retrieveRelevantChunks,
} = vi.hoisted(() => ({
  getUser: vi.fn(),
  barangayFindFirst: vi.fn(),
  recFindMany: vi.fn(),
  recDeleteMany: vi.fn(),
  openaiCreate: vi.fn(),
  retrieveRelevantChunks: vi.fn(),
}));

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
  buildGenerationPrompt: vi.fn(() => ({ systemPrompt: "s", userPrompt: "u" })),
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

import { DELETE, POST } from "./route";

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

describe("/api/recommendations/generate auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    barangayFindFirst.mockResolvedValue({ id: "b-tabok", barangayName: "Tabok" });
    recFindMany.mockResolvedValue([]);
    isValidRecommendationBatch.mockReturnValue(true);
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
