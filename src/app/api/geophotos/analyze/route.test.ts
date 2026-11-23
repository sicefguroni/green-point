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

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_CHAT_MODEL = "test-model";
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
    expect(typeof json.data.analysisError).toBe("string");
    expect(geoPhotoCreate).toHaveBeenCalledOnce();
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
