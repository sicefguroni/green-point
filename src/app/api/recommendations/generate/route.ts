import { NextRequest, NextResponse } from "next/server";
import type { GreeningRecommendation as DbGreeningRecommendation } from "@prisma/client";
import OpenAI from "openai";
import type { LocationSelectionMode } from "@/types/maplayers";
import {
  retrieveRelevantChunks,
  buildGenerationPrompt,
  type LocationContext,
} from "@/lib/rag";
import {
  compareRecommendationsByOverallRating,
  computeOverallRating,
  recommendationToRatingInput,
} from "@/lib/recommendations";
import { adjustRecommendationForContext } from "@/lib/intervention-context-scoring";
import {
  shouldUseVisionContext,
  visionContextSchema,
} from "@/lib/vision/context";
import { prisma } from "@/lib/prisma";
import {
  isValidRecommendationBatch,
  sanitizeGeneratedRecommendations,
} from "@/lib/recommendations/generation-quality";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface GeneratedRecommendation {
  name: string;
  interventionType: string;
  summary: string;
  description: string;
  justification: string;
  recommendedSpecies: string;
  rationale: string;
  sourceStudy: string | null;
  priority: "high" | "medium" | "low";
  efficiency: number; // 0-100
  equity: number; // 0-1
  cost: number; // 0-1 normalized
  impact: number; // 0-1
  relevancy: number; // 0-1
  feasibility: number; // 0-1 practical feasibility
  overallRating?: number; // 0-100 composite (set server-side)
}

type Numeric01Key = "equity" | "cost" | "impact" | "relevancy" | "feasibility";

interface RecommendationImplementationOptions {
  summary?: string;
  justification?: string;
  recommendedSpecies?: string;
  rationale?: string;
  sourceStudy?: string | null;
  impact?: number;
  feasibility?: number;
  overallRating?: number;
}

interface GenerateRecommendationsBody {
  barangayName?: string;
  barangayId?: string;
  pointId?: string;
  cityId?: string;
  coords?: { lat: number; lng: number };
  customSelectionGeometry?: unknown;
  locationSelectionMode?: LocationSelectionMode;
  areaHectares?: number;
  ndvi?: number;
  lst?: number;
  treeCanopy?: number;
  greeneryIndex?: number;
  greeneryLevel?: string;
  floodHazard?: number | null;
  stormHazard?: number | null;
  aqi?: number;
  taggedTreeCount?: number;
  inventoryCanopyFraction?: number;
  visionContext?: unknown;
  /** Bypass daily DB cache and delete existing AI rows for this location first. */
  regenerate?: boolean;
  /** Skip cache read without deleting (used internally after a failed quality pass). */
  skipCache?: boolean;
}

function parseImplementationOptions(
  raw: DbGreeningRecommendation["implementationOptions"],
): RecommendationImplementationOptions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as RecommendationImplementationOptions;
}

function parsePriority(
  priority: string,
): GeneratedRecommendation["priority"] {
  if (priority === "high" || priority === "medium" || priority === "low") {
    return priority;
  }
  return "medium";
}

function hasRecommendationEnvelope(
  value:
    | GeneratedRecommendation[]
    | { recommendations?: GeneratedRecommendation[] },
): value is { recommendations?: GeneratedRecommendation[] } {
  return !Array.isArray(value);
}

function mapDbRecToGenerated(
  dbRec: DbGreeningRecommendation,
): GeneratedRecommendation {
  const options = parseImplementationOptions(dbRec.implementationOptions);
  return {
    name: dbRec.name,
    interventionType: dbRec.interventionType,
    summary: options.summary || dbRec.description,
    description: dbRec.description,
    justification: options.justification || "",
    recommendedSpecies: options.recommendedSpecies || "",
    rationale: options.rationale || "",
    sourceStudy: options.sourceStudy || null,
    priority: parsePriority(dbRec.priority),
    efficiency: dbRec.efficiency ?? 0,
    equity: dbRec.equity ?? 0,
    cost: dbRec.cost ?? 0,
    impact: options.impact ?? 0,
    relevancy: dbRec.relevancy,
    feasibility: options.feasibility ?? 0.5,
    overallRating: options.overallRating,
  };
}

async function getCachedRecommendations(
  body: GenerateRecommendationsBody,
): Promise<GeneratedRecommendation[] | null> {
  const { barangayName, barangayId, coords, customSelectionGeometry } = body;

  let mode = body.locationSelectionMode;
  if (!mode) {
    if (barangayName && !coords && !customSelectionGeometry) {
      mode = "barangay";
    } else if (coords) {
      mode = "poi";
    } else if (customSelectionGeometry) {
      mode = "custom";
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    if (mode === "barangay") {
      const bName = barangayId || barangayName;
      if (!bName) return null;
      const b = await prisma.barangay.findFirst({
        where: {
          OR: [
            { id: bName },
            { barangayName: { equals: bName, mode: "insensitive" } },
          ],
        },
      });
      if (!b) return null;

      const dbRecs = await prisma.greeningRecommendation.findMany({
        where: {
          barangayID: b.id,
          source: "AI Engine",
          createdAt: { gte: today },
        },
      });

      if (dbRecs.length > 0) {
        return dbRecs.map(mapDbRecToGenerated);
      }
    } else if (mode === "poi") {
      if (
        !coords ||
        typeof coords.lat !== "number" ||
        typeof coords.lng !== "number"
      )
        return null;

      const lat = Math.round(coords.lat * 10000) / 10000;
      const lng = Math.round(coords.lng * 10000) / 10000;

      const p = await prisma.point.findFirst({
        where: {
          createdAt: { gte: today },
          coordinates: {
            equals: { lat, lng },
          },
        },
      });
      if (!p) return null;

      const dbRecs = await prisma.greeningRecommendation.findMany({
        where: {
          pointID: p.id,
          createdAt: { gte: today },
        },
      });

      if (dbRecs.length > 0) {
        return dbRecs.map(mapDbRecToGenerated);
      }
    } else if (mode === "custom") {
      if (!customSelectionGeometry) return null;

      const customAreas = await prisma.customArea.findMany({
        where: {
          createdAt: { gte: today },
        },
      });

      const geomStr = JSON.stringify(customSelectionGeometry);
      const matchedArea = customAreas.find(
        (ca) => JSON.stringify(ca.boundary) === geomStr,
      );
      if (!matchedArea) return null;

      const dbRecs = await prisma.greeningRecommendation.findMany({
        where: {
          customAreaID: matchedArea.id,
          createdAt: { gte: today },
        },
      });

      if (dbRecs.length > 0) {
        return dbRecs.map(mapDbRecToGenerated);
      }
    }
  } catch (err) {
    console.error("Error looking up cached recommendations:", err);
  }

  return null;
}

async function clearCachedRecommendations(
  body: GenerateRecommendationsBody,
): Promise<void> {
  const { barangayName, barangayId, coords, customSelectionGeometry } = body;

  let mode = body.locationSelectionMode;
  if (!mode) {
    if (barangayName && !coords && !customSelectionGeometry) {
      mode = "barangay";
    } else if (coords) {
      mode = "poi";
    } else if (customSelectionGeometry) {
      mode = "custom";
    }
  }

  try {
    if (mode === "barangay") {
      const bName = barangayId || barangayName;
      if (!bName) return;
      const b = await prisma.barangay.findFirst({
        where: {
          OR: [
            { id: bName },
            { barangayName: { equals: bName, mode: "insensitive" } },
          ],
        },
      });
      if (!b) return;
      await prisma.greeningRecommendation.deleteMany({
        where: { barangayID: b.id, source: "AI Engine" },
      });
    } else if (mode === "poi") {
      if (
        !coords ||
        typeof coords.lat !== "number" ||
        typeof coords.lng !== "number"
      ) {
        return;
      }
      const lat = Math.round(coords.lat * 10000) / 10000;
      const lng = Math.round(coords.lng * 10000) / 10000;
      const points = await prisma.point.findMany({
        where: {
          coordinates: { equals: { lat, lng } },
        },
      });
      if (points.length === 0) return;
      await prisma.greeningRecommendation.deleteMany({
        where: { pointID: { in: points.map((p) => p.id) } },
      });
    } else if (mode === "custom") {
      if (!customSelectionGeometry) return;
      const customAreas = await prisma.customArea.findMany();
      const geomStr = JSON.stringify(customSelectionGeometry);
      const matched = customAreas.filter(
        (ca) => JSON.stringify(ca.boundary) === geomStr,
      );
      if (matched.length === 0) return;
      await prisma.greeningRecommendation.deleteMany({
        where: { customAreaID: { in: matched.map((ca) => ca.id) } },
      });
    }
  } catch (err) {
    console.error("Error clearing cached recommendations:", err);
  }
}

async function saveGeneratedRecommendations(
  body: GenerateRecommendationsBody,
  recommendations: GeneratedRecommendation[],
) {
  const {
    barangayName,
    barangayId,
    coords,
    customSelectionGeometry,
    areaHectares,
  } = body;

  let mode = body.locationSelectionMode;
  if (!mode) {
    if (barangayName && !coords && !customSelectionGeometry) {
      mode = "barangay";
    } else if (coords) {
      mode = "poi";
    } else if (customSelectionGeometry) {
      mode = "custom";
    }
  }

  try {
    if (mode === "barangay") {
      const bName = barangayId || barangayName;
      if (!bName) return;
      const b = await prisma.barangay.findFirst({
        where: {
          OR: [
            { id: bName },
            { barangayName: { equals: bName, mode: "insensitive" } },
          ],
        },
      });
      if (!b) return;

      // Delete previous day's AI recommendations for this barangay
      await prisma.greeningRecommendation.deleteMany({
        where: {
          barangayID: b.id,
          source: "AI Engine",
        },
      });

      for (const rec of recommendations) {
        await prisma.greeningRecommendation.create({
          data: {
            recommendationID: `rec-${Math.random().toString(36).substring(2, 11)}`,
            barangayID: b.id,
            source: "AI Engine",
            name: rec.name,
            description: rec.description,
            interventionType: rec.interventionType,
            relevancy: rec.relevancy,
            efficiency: rec.efficiency,
            cost: rec.cost,
            costUnit: "PHP",
            equity: rec.equity,
            priority: rec.priority,
            status: "proposed",
            implementationOptions: {
              summary: rec.summary,
              justification: rec.justification,
              recommendedSpecies: rec.recommendedSpecies,
              rationale: rec.rationale,
              sourceStudy: rec.sourceStudy,
              impact: rec.impact,
              feasibility: rec.feasibility,
              overallRating: rec.overallRating,
            },
          },
        });
      }
    } else if (mode === "poi") {
      if (
        !coords ||
        typeof coords.lat !== "number" ||
        typeof coords.lng !== "number"
      )
        return;
      const lat = Math.round(coords.lat * 10000) / 10000;
      const lng = Math.round(coords.lng * 10000) / 10000;

      const bName = barangayId || barangayName;
      let bId = "";
      if (bName) {
        const b = await prisma.barangay.findFirst({
          where: {
            OR: [
              { id: bName },
              { barangayName: { equals: bName, mode: "insensitive" } },
            ],
          },
        });
        if (b) bId = b.id;
      }

      if (!bId) {
        const firstB = await prisma.barangay.findFirst();
        if (firstB) bId = firstB.id;
      }

      if (!bId) return;

      const pointName = `POI ${lat}, ${lng}`;
      const pointID = `poi-${Math.random().toString(36).substring(2, 11)}`;

      const p = await prisma.point.create({
        data: {
          pointID,
          pointName,
          barangayID: bId,
          coordinates: { lat, lng },
          isTemporary: true,
        },
      });

      for (const rec of recommendations) {
        await prisma.greeningRecommendation.create({
          data: {
            recommendationID: `rec-${Math.random().toString(36).substring(2, 11)}`,
            pointID: p.id,
            source: "AI Engine",
            name: rec.name,
            description: rec.description,
            interventionType: rec.interventionType,
            relevancy: rec.relevancy,
            efficiency: rec.efficiency,
            cost: rec.cost,
            costUnit: "PHP",
            equity: rec.equity,
            priority: rec.priority,
            status: "proposed",
            implementationOptions: {
              summary: rec.summary,
              justification: rec.justification,
              recommendedSpecies: rec.recommendedSpecies,
              rationale: rec.rationale,
              sourceStudy: rec.sourceStudy,
              impact: rec.impact,
              feasibility: rec.feasibility,
              overallRating: rec.overallRating,
            },
          },
        });
      }
    } else if (mode === "custom") {
      if (!customSelectionGeometry) return;

      const ca = await prisma.customArea.create({
        data: {
          boundary: customSelectionGeometry,
          areaHectares: typeof areaHectares === "number" ? areaHectares : null,
        },
      });

      for (const rec of recommendations) {
        await prisma.greeningRecommendation.create({
          data: {
            recommendationID: `rec-${Math.random().toString(36).substring(2, 11)}`,
            customAreaID: ca.id,
            source: "AI Engine",
            name: rec.name,
            description: rec.description,
            interventionType: rec.interventionType,
            relevancy: rec.relevancy,
            efficiency: rec.efficiency,
            cost: rec.cost,
            costUnit: "PHP",
            equity: rec.equity,
            priority: rec.priority,
            status: "proposed",
            implementationOptions: {
              summary: rec.summary,
              justification: rec.justification,
              recommendedSpecies: rec.recommendedSpecies,
              rationale: rec.rationale,
              sourceStudy: rec.sourceStudy,
              impact: rec.impact,
              feasibility: rec.feasibility,
              overallRating: rec.overallRating,
            },
          },
        });
      }
    }
  } catch (err) {
    console.error(
      "Error saving generated recommendations to database cache:",
      err,
    );
  }
}

export async function DELETE(request: NextRequest) {
  let body: GenerateRecommendationsBody;
  try {
    body = (await request.json()) as GenerateRecommendationsBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid or empty JSON body." },
      { status: 400 },
    );
  }

  await clearCachedRecommendations(body);
  return NextResponse.json({ success: true });
}

async function runGeneration(
  body: GenerateRecommendationsBody,
  context: LocationContext,
  options: { regenerate?: boolean },
): Promise<{
  data: GeneratedRecommendation[];
  chunks: Awaited<ReturnType<typeof retrieveRelevantChunks>>["chunks"];
  query: string;
  hallucinations: string[];
}> {
  const { chunks, query } = await retrieveRelevantChunks(context, 6);
  const { systemPrompt, userPrompt } = buildGenerationPrompt(
    context,
    chunks,
    options,
  );

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const rawText = completion.choices[0].message.content ?? "{}";

  let parsed:
    | { recommendations?: GeneratedRecommendation[] }
    | GeneratedRecommendation[];
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("AI returned an invalid format. Please try again.");
  }

  const generated: GeneratedRecommendation[] = Array.isArray(parsed)
    ? parsed
    : ((hasRecommendationEnvelope(parsed) ? parsed.recommendations : []) ??
      []);

  const REQUIRED_STRING_KEYS: (keyof GeneratedRecommendation)[] = [
    "name",
    "interventionType",
    "summary",
    "description",
    "justification",
    "recommendedSpecies",
  ];
  const NUMERIC_01_KEYS: Numeric01Key[] = [
    "equity",
    "cost",
    "impact",
    "relevancy",
    "feasibility",
  ];

  const validated = generated.filter((r) => {
    const hasStrings = REQUIRED_STRING_KEYS.every(
      (key) =>
        typeof r[key] === "string" && (r[key] as string).trim().length > 0,
    );
    if (!hasStrings) {
      console.warn(
        "Dropped recommendation missing required string field:",
        r.name ?? "(unnamed)",
      );
      return false;
    }
    for (const key of NUMERIC_01_KEYS) {
      const raw = Number(r[key]);
      r[key] = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
    }
    const rawEff = Number(r.efficiency);
    r.efficiency = Number.isFinite(rawEff)
      ? Math.min(100, Math.max(0, rawEff))
      : 0;
    return true;
  });

  const qualityFiltered = sanitizeGeneratedRecommendations(validated, chunks);

  if (!isValidRecommendationBatch(qualityFiltered)) {
    throw new Error(
      `AI returned ${qualityFiltered.length} valid catalog recommendations (expected 3–5). Please try again.`,
    );
  }

  const adjusted = qualityFiltered.map((r) =>
    adjustRecommendationForContext(r, context),
  );

  const validStudyTitles = new Set(chunks.map((c) => c.studyTitle));
  const hallucinations: string[] = [];

  const citationValidated = adjusted.map((r) => {
    if (r.sourceStudy && typeof r.sourceStudy === "string") {
      const isValid = Array.from(validStudyTitles).some(
        (title) =>
          title.toLowerCase().trim() === r.sourceStudy!.toLowerCase().trim(),
      );

      if (!isValid) {
        hallucinations.push(
          `"${r.sourceStudy}" (cited in "${r.name}") not found in retrieved studies`,
        );
        r.sourceStudy = null;
      }
    }
    return r;
  });

  const sorted = [...citationValidated].sort((a, b) =>
    compareRecommendationsByOverallRating(
      a as unknown as Record<string, unknown>,
      b as unknown as Record<string, unknown>,
    ),
  );
  const data: GeneratedRecommendation[] = sorted.map((r) => ({
    ...r,
    overallRating: computeOverallRating(
      recommendationToRatingInput(r as unknown as Record<string, unknown>),
    ),
  }));

  return { data, chunks, query, hallucinations };
}

export async function POST(request: NextRequest) {
  let body: GenerateRecommendationsBody;
  try {
    body = (await request.json()) as GenerateRecommendationsBody;
  } catch (err) {
    console.warn(
      "Failed to parse request JSON (likely aborted or empty body):",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Invalid or empty JSON body." },
      { status: 400 },
    );
  }

  try {
    const {
      barangayId,
      barangayName,
      pointId,
      cityId,
      ndvi,
      lst,
      treeCanopy,
      greeneryIndex,
      greeneryLevel,
      floodHazard,
      stormHazard,
      aqi,
      taggedTreeCount,
      inventoryCanopyFraction,
      areaHectares,
      visionContext: rawVisionContext,
    } = body;

    if (!barangayId && !pointId && !cityId && !barangayName) {
      return NextResponse.json(
        { success: false, error: "A location identifier is required." },
        { status: 400 },
      );
    }

    const forceFresh = Boolean(body.regenerate || body.skipCache);

    if (body.regenerate) {
      await clearCachedRecommendations(body);
    }

    if (!forceFresh) {
      const cached = await getCachedRecommendations(body);
      if (cached) {
        const sanitizedCache = sanitizeGeneratedRecommendations(cached, []);
        if (isValidRecommendationBatch(sanitizedCache)) {
          return NextResponse.json({
            success: true,
            data: sanitizedCache,
            meta: {
              cacheHit: true,
              note: "Fetched from daily database cache.",
            },
          });
        }
        await clearCachedRecommendations(body);
      }
    }

    const parsedVisionContext = visionContextSchema.safeParse(rawVisionContext);
    const visionContext = parsedVisionContext.success
      ? parsedVisionContext.data
      : null;

    const context: LocationContext = {
      areaName: barangayName,
      ndvi,
      lst,
      treeCanopy,
      greeneryIndex,
      greeneryLevel,
      floodHazard,
      stormHazard,
      aqi,
      taggedTreeCount:
        typeof taggedTreeCount === "number" ? taggedTreeCount : null,
      inventoryCanopyFraction:
        typeof inventoryCanopyFraction === "number"
          ? inventoryCanopyFraction
          : null,
      areaHectares: typeof areaHectares === "number" ? areaHectares : null,
      visionContext: shouldUseVisionContext(visionContext)
        ? visionContext
        : null,
    };

    let chunks: Awaited<ReturnType<typeof retrieveRelevantChunks>>["chunks"];
    let query: string;
    let hallucinations: string[] = [];
    let data: GeneratedRecommendation[];

    try {
      const first = await runGeneration(body, context, {
        regenerate: body.regenerate,
      });
      data = first.data;
      chunks = first.chunks;
      query = first.query;
      hallucinations = first.hallucinations;
    } catch (firstErr) {
      const message =
        firstErr instanceof Error ? firstErr.message : "Generation failed.";
      try {
        const retry = await runGeneration(body, context, { regenerate: true });
        data = retry.data;
        chunks = retry.chunks;
        query = retry.query;
        hallucinations = retry.hallucinations;
      } catch {
        return NextResponse.json(
          { success: false, error: message },
          { status: 502 },
        );
      }
    }

    if (hallucinations.length > 0) {
      console.warn(
        `Detected ${hallucinations.length} potential hallucinations: ${hallucinations.join("; ")}`,
      );
    }

    await saveGeneratedRecommendations(body, data);

    return NextResponse.json({
      success: true,
      data,
      meta: {
        retrievedChunks: chunks.length,
        uniqueStudies: [...new Set(chunks.map((c) => c.studyTitle))],
        averageSimilarity:
          chunks.length > 0
            ? Math.round(
                (chunks.reduce((sum, c) => sum + c.similarity, 0) /
                  chunks.length) *
                  1000,
              ) / 1000
            : null,
        minSimilarity:
          chunks.length > 0
            ? Math.round(Math.min(...chunks.map((c) => c.similarity)) * 1000) /
              1000
            : null,
        groundingNote:
          chunks.length === 0
            ? "No research studies matched this query. Recommendations are based on general urban greening knowledge."
            : chunks.length < 3
              ? "Limited research grounding. Recommendations may rely partially on general knowledge."
              : undefined,
        hallucinations:
          hallucinations.length > 0 ? hallucinations : undefined,
        query,
      },
    });
  } catch (error) {
    console.error("Error generating RAG recommendations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate recommendations." },
      { status: 500 },
    );
  }
}
