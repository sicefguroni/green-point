import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  GEO_PHOTOS_BUCKET,
  IDENTITY_DOCUMENTS_BUCKET,
  PROFILE_AVATARS_BUCKET,
  geoPhotoObjectPath,
} from "@/lib/storage/paths";
import { normalizeVisionAnalysis } from "@/lib/vision/context";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const OPENAI_MODEL = "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const STORAGE_BUCKET_CANDIDATES = [
  process.env.GEO_PHOTOS_BUCKET,
  IDENTITY_DOCUMENTS_BUCKET,
  PROFILE_AVATARS_BUCKET,
  GEO_PHOTOS_BUCKET,
].filter((bucket): bucket is string => !!bucket);

function toNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTag(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 48);
}

function extractVisionContextFromTags(tags: string[]) {
  const encoded = tags.find((tag) => tag.startsWith("vision_context:"));
  if (!encoded) return null;
  const raw = encoded.slice("vision_context:".length);
  if (!raw || raw === "null") return null;
  try {
    return normalizeVisionAnalysis({ visionContext: JSON.parse(raw), quickTags: [] })
      ?.visionContext ?? null;
  } catch {
    return null;
  }
}

function isBucketNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { statusCode?: string; status?: number; message?: string };
  return (
    maybe.statusCode === "404" ||
    maybe.status === 404 ||
    (typeof maybe.message === "string" &&
      maybe.message.toLowerCase().includes("bucket not found"))
  );
}

async function uploadGeoPhoto(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  objectPath: string,
  imageBuffer: Buffer,
  contentType: string,
): Promise<{ bucket: string; path: string }> {
  let lastError: unknown = null;
  for (const bucket of STORAGE_BUCKET_CANDIDATES) {
    const { error } = await supabase.storage.from(bucket).upload(objectPath, imageBuffer, {
      contentType,
      upsert: false,
    });

    if (!error) {
      return { bucket, path: `${bucket}/${objectPath}` };
    }

    lastError = error;
    if (!isBucketNotFoundError(error)) {
      console.warn(
        `[api/geophotos/analyze] Upload failed for bucket "${bucket}", trying fallback bucket.`,
        error,
      );
    }
  }

  throw lastError ?? new Error("Storage upload failed");
}

async function resolveResidentId(
  supabaseUserId: string,
  email: string | undefined,
): Promise<string> {
  const existingProfile = await prisma.profile.findUnique({
    where: { supabaseUserId },
    select: { email: true },
  });
  const targetEmail = email ?? existingProfile?.email ?? `${supabaseUserId}@local.invalid`;
  const fallbackUsername = `resident_${supabaseUserId.slice(0, 12)}`;

  let user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: { resident: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        username: fallbackUsername,
        email: targetEmail,
        password: `supabase-auth:${supabaseUserId}`,
        role: "RESIDENT",
        status: "ACTIVE",
      },
      include: { resident: true },
    });
  }

  if (user.resident) {
    return user.resident.id;
  }

  const resident = await prisma.resident.create({
    data: {
      residentID: randomUUID(),
      userID: user.id,
      city: "Mandaue City",
    },
  });
  return resident.id;
}

function buildVisionPrompt(lat: number | null, lng: number | null): string {
  const locationLine =
    lat !== null && lng !== null
      ? `Photo coordinates: lat=${lat.toFixed(6)}, lng=${lng.toFixed(6)}.`
      : "Photo coordinates are unavailable.";

  return `Analyze this site photo for urban greening planning context.
${locationLine}

Return strict JSON with this exact shape:
{
  "visionContext": {
    "groundOpenSpaceLevel": "LOW|MEDIUM|HIGH",
    "buildingDensityLevel": "LOW|MEDIUM|HIGH",
    "roofGreeningPotential": "LOW|MEDIUM|HIGH",
    "verticalGreeningPotential": "LOW|MEDIUM|HIGH",
    "soilVisibility": "NONE|LIMITED|CLEAR",
    "permeabilityHint": "LOW|MEDIUM|HIGH|UNKNOWN",
    "confidence": number from 0 to 1,
    "rationale": "max 280 chars"
  },
  "quickTags": ["short-tag", "short-tag-2"]
}

Guidelines:
- groundOpenSpaceLevel = visible usable ground area for planting.
- buildingDensityLevel = how built-up the scene is.
- roofGreeningPotential = likely usefulness of roof-based greening.
- verticalGreeningPotential = likely usefulness of facade/wall/balcony greening.
- soilVisibility + permeabilityHint should reflect visible cues only; use UNKNOWN when uncertain.
- confidence must reflect image clarity and certainty of inferences.
- quickTags should be short, plain identifiers for key scene signals.`;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const lat = toNumber(formData.get("lat"));
    const lng = toNumber(formData.get("lng"));
    const barangay = formData.get("barangay");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Image file is required." },
        { status: 400 },
      );
    }

    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Only image uploads are allowed." },
        { status: 400 },
      );
    }

    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Image exceeds 10MB upload limit." },
        { status: 413 },
      );
    }

    const objectPath = geoPhotoObjectPath(user.id, image.name || "geophoto.jpg");
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageHash = createHash("sha256").update(imageBuffer).digest("hex");
    const hashTag = `image_hash:${imageHash}`;
    let storedImagePath = objectPath;
    try {
      const uploaded = await uploadGeoPhoto(
        supabase,
        objectPath,
        imageBuffer,
        image.type,
      );
      storedImagePath = uploaded.path;
    } catch (uploadError) {
      console.error("[api/geophotos/analyze] Storage upload failed:", uploadError);
      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to upload photo. Configure GEO_PHOTOS_BUCKET or create the geo-photos bucket.",
        },
        { status: 500 },
      );
    }

    const cachedPhoto = await prisma.geoPhoto.findFirst({
      where: {
        uploader: user.id,
        tags: { has: hashTag },
      },
      orderBy: { createdAt: "desc" },
      select: { tags: true },
    });

    const cachedVisionContext = cachedPhoto
      ? extractVisionContextFromTags(cachedPhoto.tags)
      : null;
    const cachedQuickTags =
      cachedPhoto?.tags
        .filter((tag) => !tag.startsWith("vision_context:") && !tag.startsWith("image_hash:"))
        .slice(0, 12) ?? [];

    let analysis = cachedVisionContext
      ? {
          visionContext: cachedVisionContext,
          quickTags: cachedQuickTags,
        }
      : null;
    let analysisError: string | null = null;
    const analysisSource = cachedVisionContext ? "cache" : "openai";
    if (!cachedVisionContext) {
      try {
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an urban greening analyst. Output strict JSON only.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: buildVisionPrompt(lat, lng) },
              {
                type: "image_url",
                image_url: {
                  url: `data:${image.type};base64,${imageBuffer.toString("base64")}`,
                  detail: "low",
                },
              },
            ],
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);
      analysis = normalizeVisionAnalysis(parsed);
      if (!analysis) {
        analysisError = "Vision response validation failed";
      }
      } catch (error) {
        console.error("[api/geophotos/analyze] Vision analysis failed:", error);
        analysisError =
          error instanceof Error ? error.message : "Vision analysis failed";
      }
    }

    const residentId = await resolveResidentId(user.id, user.email);
    const quickTags = analysis?.quickTags
      .map(normalizeTag)
      .filter((tag) => tag.length > 0) ?? [];
    const structuredTag = analysis
      ? `vision_context:${JSON.stringify(analysis.visionContext)}`
      : "vision_context:null";

    const photo = await prisma.geoPhoto.create({
      data: {
        photoID: randomUUID(),
        residentID: residentId,
        imagePath: storedImagePath,
        imageFile: image.name || "geophoto.jpg",
        location: {
          lat,
          lng,
          barangay: typeof barangay === "string" ? barangay : null,
        },
        tags: [...quickTags, hashTag, structuredTag],
        uploader: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        geoPhotoId: photo.id,
        imagePath: photo.imagePath,
        visionContext: analysis?.visionContext ?? null,
        quickTags,
        analysisError,
        analysisSource,
      },
    });
  } catch (error) {
    console.error("[api/geophotos/analyze] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to analyze geotagged photo." },
      { status: 500 },
    );
  }
}
