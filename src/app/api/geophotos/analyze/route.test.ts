import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUser,
  storageFrom,
  storageUpload,
  geoPhotoCreate,
  geoPhotoFindFirst,
  profileFindUnique,
  userFindUnique,
  userCreate,
  residentCreate,
  openaiCreate,
} = vi.hoisted(() => ({
  getUser: vi.fn(),
  storageFrom: vi.fn(),
  storageUpload: vi.fn(),
  geoPhotoCreate: vi.fn(),
  geoPhotoFindFirst: vi.fn(),
  profileFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  residentCreate: vi.fn(),
  openaiCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser },
    storage: { from: storageFrom },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    geoPhoto: { create: geoPhotoCreate, findFirst: geoPhotoFindFirst },
    profile: { findUnique: profileFindUnique },
    user: { findUnique: userFindUnique, create: userCreate },
    resident: { create: residentCreate },
  },
}));

vi.mock("openai", () => {
  return {
    default: class OpenAI {
      chat = {
        completions: {
          create: openaiCreate,
        },
      };
    },
  };
});

import { POST } from "./route";

function makeFormRequest(): Request {
  const formData = new FormData();
  formData.append("image", new File(["img-bytes"], "sample.jpg", { type: "image/jpeg" }));
  formData.append("lat", "10.321");
  formData.append("lng", "123.912");
  formData.append("barangay", "Centro");

  return new Request("http://localhost/api/geophotos/analyze", {
    method: "POST",
    body: formData,
  });
}

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const VALID_ANALYSIS = {
  visionContext: {
    groundOpenSpaceLevel: "LOW",
    buildingDensityLevel: "HIGH",
    roofGreeningPotential: "HIGH",
    verticalGreeningPotential: "HIGH",
    soilVisibility: "LIMITED",
    permeabilityHint: "LOW",
    confidence: 0.82,
    rationale: "Dense blocks with minimal open planting strips",
  },
  quickTags: ["dense-urban", "roof-opportunity"],
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  process.env.AI_PRIMARY_PROVIDER = "openai";
  process.env.AI_FALLBACK_PROVIDER = "gemini";
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_CHAT_MODEL = "test-model";
  // No fallback unless a test configures one, so nothing reaches the network.
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_CHAT_MODEL;
  getUser.mockResolvedValue({ data: { user: { id: "supa-1", email: "test@example.com" } }, error: null });
  storageFrom.mockImplementation(() => ({ upload: storageUpload }));
  storageUpload.mockResolvedValue({ error: null });
  openaiCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            visionContext: {
              groundOpenSpaceLevel: "LOW",
              buildingDensityLevel: "HIGH",
              roofGreeningPotential: "HIGH",
              verticalGreeningPotential: "HIGH",
              soilVisibility: "LIMITED",
              permeabilityHint: "LOW",
              confidence: 0.82,
              rationale: "Dense blocks with minimal open planting strips",
            },
            quickTags: ["dense-urban", "roof-opportunity"],
          }),
        },
      },
    ],
  });
  profileFindUnique.mockResolvedValue(null);
  geoPhotoFindFirst.mockResolvedValue(null);
  userFindUnique.mockResolvedValue({
    id: "legacy-user-1",
    resident: { id: "resident-1" },
  });
  geoPhotoCreate.mockResolvedValue({
    id: "geo-1",
    imagePath: "supa-1/123-sample.jpg",
  });
});

describe("POST /api/geophotos/analyze", () => {
  it("returns persisted geophoto plus vision context on success", async () => {
    const res = await POST(makeFormRequest() as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.geoPhotoId).toBe("geo-1");
    expect(json.data.visionContext.buildingDensityLevel).toBe("HIGH");
    expect(storageUpload).toHaveBeenCalledOnce();
    expect(geoPhotoCreate).toHaveBeenCalledOnce();
  });

  it("falls back gracefully when OpenAI analysis fails", async () => {
    openaiCreate.mockRejectedValueOnce(new Error("vision timeout"));
    const res = await POST(makeFormRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.visionContext).toBeNull();
    expect(json.data.analysisError).toBe(
      "Photo analysis is unavailable right now, so recommendations use map metrics only.",
    );
    expect(geoPhotoCreate).toHaveBeenCalledOnce();
  });

  it("never sends the provider's own error message to the browser", async () => {
    openaiCreate.mockRejectedValueOnce(
      Object.assign(new Error("401 Incorrect API key provided: sk-proj-****abcd"), {
        status: 401,
      }),
    );
    const res = await POST(makeFormRequest() as never);
    const body = await res.text();
    expect(body).not.toMatch(/sk-proj|Incorrect API key|401/);
  });

  it("analyses the photo with Gemini when OpenAI rejects the key", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GEMINI_CHAT_MODEL = "gemini-test";
    openaiCreate.mockRejectedValueOnce(
      Object.assign(new Error("401 Incorrect API key provided"), { status: 401 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_ANALYSIS) }] } }],
        }),
        { status: 200 },
      ),
    );

    const res = await POST(makeFormRequest() as never);
    const json = await res.json();

    expect(json.data.visionContext.buildingDensityLevel).toBe("HIGH");
    expect(json.data.analysisSource).toBe("gemini");
    expect(json.data.analysisError).toBeNull();
    const geminiBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(geminiBody.contents[0].parts[1].inlineData.mimeType).toBe("image/jpeg");
  });

  it("reports an unreadable answer differently from an outage", async () => {
    openaiCreate.mockResolvedValueOnce({ choices: [{ message: { content: '{"nope":1}' } }] });
    const res = await POST(makeFormRequest() as never);
    const json = await res.json();
    expect(json.data.visionContext).toBeNull();
    expect(json.data.analysisError).toBe(
      "The photo couldn’t be analysed clearly, so recommendations use map metrics only.",
    );
  });

  it("reuses cached image analysis when image hash already exists", async () => {
    geoPhotoFindFirst.mockResolvedValueOnce({
      tags: [
        "dense-urban",
        "image_hash:abc",
        'vision_context:{"groundOpenSpaceLevel":"LOW","buildingDensityLevel":"HIGH","roofGreeningPotential":"HIGH","verticalGreeningPotential":"HIGH","soilVisibility":"LIMITED","permeabilityHint":"LOW","confidence":0.82,"rationale":"Cached analysis"}',
      ],
    });

    const res = await POST(makeFormRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.analysisSource).toBe("cache");
    expect(openaiCreate).not.toHaveBeenCalled();
  });

  it("stores the photo in the geo-photos bucket", async () => {
    const res = await POST(makeFormRequest() as never);
    expect(res.status).toBe(200);
    expect(storageFrom).toHaveBeenCalledTimes(1);
    expect(storageFrom).toHaveBeenCalledWith("geo-photos");
    expect(geoPhotoCreate.mock.calls[0][0].data.imagePath).toMatch(/^geo-photos\/supa-1\//);
  });

  it("never falls back to the identity-documents or avatar buckets", async () => {
    storageUpload.mockResolvedValue({
      error: { statusCode: "404", message: "Bucket not found" },
    });
    const res = await POST(makeFormRequest() as never);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).not.toMatch(/bucket|GEO_PHOTOS/i);
    const buckets = storageFrom.mock.calls.map(([bucket]) => bucket);
    expect(buckets).toEqual(["geo-photos"]);
    expect(geoPhotoCreate).not.toHaveBeenCalled();
    expect(openaiCreate).not.toHaveBeenCalled();
  });
});
