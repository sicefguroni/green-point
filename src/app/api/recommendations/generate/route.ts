import { NextRequest, NextResponse } from "next/server";
import type { GreeningRecommendation as DbGreeningRecommendation } from "@prisma/client";
import { generateJsonWithFallback } from "@/lib/ai/orchestrator";
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
import { requireUser } from "@/lib/auth/session";
import {
  isValidRecommendationBatch,
  sanitizeGeneratedRecommendations,
  groundCachedRecommendations,
  normalizeUnitScore,
} from "@/lib/recommendations/generation-quality";
import { loadStudyTitles } from "@/lib/recommendations/corpus";
import {
  boundedHazardLevel,
  resolveTrustedLocationMetrics,
} from "@/lib/recommendations/trusted-location-metrics";

const SIGN_IN_TO_GENERATE = "Sign in to generate AI solutions.";
const NO_LIVE_METRICS =
  "Live data for this location isn't available yet, so AI solutions can't be generated for it.";
const METRICS_UNAVAILABLE =
  "Location data is unavailable right now. Please try again in a moment.";
const AI_UNAVAILABLE =
  "AI recommendations are unavailable right now. Please try again in a moment.";

/**
 * A generation failure whose message is safe to show the user (the model's
 * output was unusable). Any other error, provider errors included, is logged
 * and replaced by AI_UNAVAILABLE: provider messages can quote part of an API key.
 */
class RecommendationOutputError extends Error {}

function parseGenerationJson(rawText: string): unknown {
  try {
    return JSON.parse(rawText);
  } catch {
    throw new RecommendationOutputError(
      "AI returned an invalid format. Please try again.",
    );
  }
}

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
  /** Engine evaluation metrics — populated server-side, consumed by dashboard table columns. */
  costPHP?: number;
  impactGI?: number;
  canopyDeltaPct?: number;
  coolingDeltaC?: number;
  pm25KgPerYear?: number;
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
  /** Engine evaluation metrics — persisted here so the dashboard table can read them from the DB. */
  costPHP?: number;
  impactGI?: number;
  canopyDeltaPct?: number;
  coolingDeltaC?: number;
  pm25KgPerYear?: number;
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
  /** Set true to bypass cache and force re-generation via AI. */
  forceRefresh?: boolean;
  /** Bypass daily DB cache and delete existing AI rows for this location first. */
  regenerate?: boolean;
  /** Skip cache read without deleting (used internally after a failed quality pass). */
  skipCache?: boolean;
}

/** The shared cache a request reads and writes: by barangay, point or drawn area. */
function selectionModeOf(
  body: GenerateRecommendationsBody,
): LocationSelectionMode | undefined {
  if (body.locationSelectionMode) return body.locationSelectionMode;
  const { barangayName, coords, customSelectionGeometry } = body;
  if (barangayName && !coords && !customSelectionGeometry) return "barangay";
  if (coords) return "poi";
  if (customSelectionGeometry) return "custom";
  return undefined;
}

/** The barangay row a barangay-mode request reads and writes the cache for. */
async function findBarangay(body: GenerateRecommendationsBody) {
  const bName = body.barangayId || body.barangayName;
  if (!bName) return null;
  return prisma.barangay.findFirst({
    where: {
      OR: [
        { id: bName },
        { barangayName: { equals: bName, mode: "insensitive" } },
      ],
    },
  });
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
    costPHP: options.costPHP,
    impactGI: options.impactGI,
    canopyDeltaPct: options.canopyDeltaPct,
    coolingDeltaC: options.coolingDeltaC,
    pm25KgPerYear: options.pm25KgPerYear,
  };
}

/**
 * Cached rows, grounded the same way new generations are: citations checked
 * against the whole corpus, species fitted to the intervention, unfinished and
 * contradictory sentences removed. Rows stored before grounding existed are
 * cleaned on read, so nothing ungrounded is served from the cache.
 */
async function getCachedRecommendations(
  body: GenerateRecommendationsBody,
): Promise<GeneratedRecommendation[] | null> {
  const rows = await readCachedRecommendations(body);
  if (!rows) return null;
  const studyTitles = await loadStudyTitles();
  const metrics = {
    ndvi: body.ndvi,
    treeCanopy: body.treeCanopy,
    greeneryIndex: body.greeneryIndex,
  };
  return groundCachedRecommendations(rows, { studyTitles, metrics });
}

async function readCachedRecommendations(
  body: GenerateRecommendationsBody,
): Promise<GeneratedRecommendation[] | null> {
  const { coords, customSelectionGeometry } = body;

  const mode = selectionModeOf(body);

  try {
    if (mode === "barangay") {
      const b = await findBarangay(body);
      if (!b) return null;

      const dbRecs = await prisma.greeningRecommendation.findMany({
        where: {
          barangayID: b.id,
          source: "AI Engine",
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
          coordinates: {
            equals: { lat, lng },
          },
        },
      });
      if (!p) return null;

      const dbRecs = await prisma.greeningRecommendation.findMany({
        where: {
          pointID: p.id,
        },
      });

      if (dbRecs.length > 0) {
        return dbRecs.map(mapDbRecToGenerated);
      }
    } else if (mode === "custom") {
      if (!customSelectionGeometry) return null;

      const customAreas = await prisma.customArea.findMany({
        where: {},
      });

      const geomStr = JSON.stringify(customSelectionGeometry);
      const matchedArea = customAreas.find(
        (ca) => JSON.stringify(ca.boundary) === geomStr,
      );
      if (!matchedArea) return null;

      const dbRecs = await prisma.greeningRecommendation.findMany({
        where: {
          customAreaID: matchedArea.id,
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
  const { coords, customSelectionGeometry } = body;

  const mode = selectionModeOf(body);

  try {
    if (mode === "barangay") {
      const b = await findBarangay(body);
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
  const { coords, customSelectionGeometry, areaHectares } = body;

  const mode = selectionModeOf(body);

  try {
    if (mode === "barangay") {
      const b = await findBarangay(body);
      if (!b) return;

      // Always replace old AI recommendations to prevent duplicate accumulation.
      // Both explore and dashboard read from this cache, so stale duplicates would
      // show as repeated entries in both views.
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
              costPHP: rec.costPHP,
              impactGI: rec.impactGI,
              canopyDeltaPct: rec.canopyDeltaPct,
              coolingDeltaC: rec.coolingDeltaC,
              pm25KgPerYear: rec.pm25KgPerYear,
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

      let bId = (await findBarangay(body))?.id ?? "";

      if (!bId) {
        const firstB = await prisma.barangay.findFirst();
        if (firstB) bId = firstB.id;
      }

      if (!bId) return;

      // Find existing Point by coordinates to avoid creating duplicates.
      // The cache lookup uses the same rounding, so if this save happens after
      // a cache miss, we still want to reuse any previous Point record rather
      // than creating orphaned duplicates.
      let p = await prisma.point.findFirst({
        where: {
          coordinates: {
            equals: { lat, lng },
          },
        },
      });

      if (p) {
        // Replace old recommendations for this Point
        await prisma.greeningRecommendation.deleteMany({
          where: { pointID: p.id },
        });
      } else {
        const pointID = `poi-${Math.random().toString(36).substring(2, 11)}`;
        p = await prisma.point.create({
          data: {
            pointID,
            pointName: `POI ${lat}, ${lng}`,
            barangayID: bId,
            coordinates: { lat, lng },
            isTemporary: true,
          },
        });
      }

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
              costPHP: rec.costPHP,
              impactGI: rec.impactGI,
              canopyDeltaPct: rec.canopyDeltaPct,
              coolingDeltaC: rec.coolingDeltaC,
              pm25KgPerYear: rec.pm25KgPerYear,
            },
          },
        });
      }
    } else if (mode === "custom") {
      if (!customSelectionGeometry) return;

      // Find existing CustomArea by geometry to avoid creating duplicates
      const customAreas = await prisma.customArea.findMany({ where: {} });
      const geomStr = JSON.stringify(customSelectionGeometry);
      const existingArea = customAreas.find(
        (ca) => JSON.stringify(ca.boundary) === geomStr,
      );

      let ca: { id: string };
      if (existingArea) {
        // Replace old recommendations for this CustomArea
        await prisma.greeningRecommendation.deleteMany({
          where: { customAreaID: existingArea.id },
        });
        ca = { id: existingArea.id };
      } else {
        ca = await prisma.customArea.create({
          data: {
            boundary: customSelectionGeometry,
            areaHectares: typeof areaHectares === "number" ? areaHectares : null,
          },
        });
      }

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
              costPHP: rec.costPHP,
              impactGI: rec.impactGI,
              canopyDeltaPct: rec.canopyDeltaPct,
              coolingDeltaC: rec.coolingDeltaC,
              pm25KgPerYear: rec.pm25KgPerYear,
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
  const auth = await requireUser(SIGN_IN_TO_GENERATE);
  if (!auth.ok) return auth.response;

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
  searchUnavailable: boolean;
}> {
  const { chunks, query, searchUnavailable = false } =
    await retrieveRelevantChunks(context, 6);
  const { systemPrompt, userPrompt } = buildGenerationPrompt(
    context,
    chunks,
    options,
  );

  // Invalid JSON from the primary provider also moves on to the fallback.
  const { value: parsed } = await generateJsonWithFallback<
    { recommendations?: GeneratedRecommendation[] } | GeneratedRecommendation[]
  >({
    feature: "recommendations",
    systemPrompt,
    userPrompt,
    timeoutMs: 120_000,
    parse: (rawText) =>
      parseGenerationJson(rawText) as
        | { recommendations?: GeneratedRecommendation[] }
        | GeneratedRecommendation[],
  });

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
      r[key] = normalizeUnitScore(r[key], () =>
        console.warn(`Missing "${key}" score for ${r.name}; using neutral 0.5.`),
      );
    }
    const rawEff = Number(r.efficiency);
    r.efficiency = Number.isFinite(rawEff)
      ? Math.min(100, Math.max(0, rawEff))
      : 0;
    return true;
  });

  // Everything removed while grounding (invented citations, unfit species,
  // contradicting claims) is reported back as `hallucinations`.
  const grounding: string[] = [];
  const qualityFiltered = sanitizeGeneratedRecommendations(validated, chunks, {
    studyTitles: [...new Set(chunks.map((c) => c.studyTitle))],
    metrics: context,
    report: grounding,
  });

  if (!isValidRecommendationBatch(qualityFiltered)) {
    throw new RecommendationOutputError(
      `AI returned ${qualityFiltered.length} valid catalog recommendations (expected 3–5). Please try again.`,
    );
  }

  const adjusted = qualityFiltered.map((r) =>
    adjustRecommendationForContext(r, context),
  );

  const validStudyTitles = new Set(chunks.map((c) => c.studyTitle));
  const hallucinations: string[] = [...grounding];

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

  return { data, chunks, query, hallucinations, searchUnavailable };
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
      stormHazard,
      visionContext: rawVisionContext,
    } = body;

    if (!barangayId && !pointId && !cityId && !barangayName) {
      return NextResponse.json(
        { success: false, error: "A location identifier is required." },
        { status: 400 },
      );
    }

    const forceFresh = Boolean(body.regenerate || body.skipCache || body.forceRefresh);

    // Clearing the cache or skipping it always costs an AI call, so it needs a
    // signed-in user. Cache hits below stay public: they cost nothing.
    if (forceFresh) {
      const auth = await requireUser(SIGN_IN_TO_GENERATE);
      if (!auth.ok) return auth.response;
    }

    let cached: GeneratedRecommendation[] | null = null;
    if (!forceFresh) {
      cached = await getCachedRecommendations(body);
      const sanitizedCache = cached
        ? sanitizeGeneratedRecommendations(cached, [])
        : null;
      if (sanitizedCache && isValidRecommendationBatch(sanitizedCache)) {
        return NextResponse.json({
          success: true,
          data: sanitizedCache,
          meta: {
            cacheHit: true,
            note: "Fetched from daily database cache.",
          },
        });
      }

      // Cache miss or an invalid cached batch: replacing it deletes rows and
      // calls the AI provider, so check sign-in before touching anything.
      const auth = await requireUser(SIGN_IN_TO_GENERATE);
      if (!auth.ok) return auth.response;
    }

    // What is generated here replaces the cache every visitor reads for this
    // location, so the metrics come from the server's own live data, never
    // from the request body. Resolve them before deleting anything.
    const mode = selectionModeOf(body);
    const barangay = mode === "barangay" ? await findBarangay(body) : null;
    const trusted = await resolveTrustedLocationMetrics({
      mode,
      barangayName: barangay?.barangayName,
      coords: body.coords,
      customSelectionGeometry: body.customSelectionGeometry,
    });
    if (!trusted.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            trusted.reason === "unavailable"
              ? METRICS_UNAVAILABLE
              : NO_LIVE_METRICS,
        },
        { status: trusted.reason === "unavailable" ? 503 : 404 },
      );
    }
    const metrics = trusted.metrics;

    const parsedVisionContext = visionContextSchema.safeParse(rawVisionContext);
    const visionContext =
      parsedVisionContext.success && shouldUseVisionContext(parsedVisionContext.data)
        ? parsedVisionContext.data
        : null;
    // A photo is one user's evidence, sent by their browser. A result shaped by
    // it is returned to them only: it neither clears nor replaces the
    // recommendations every visitor reads for this location.
    const personal = visionContext !== null;

    if (!personal && (body.regenerate || body.forceRefresh || cached)) {
      await clearCachedRecommendations(body);
    }

    const context: LocationContext = {
      areaName: metrics.areaName,
      ndvi: metrics.ndvi,
      lst: metrics.lst,
      treeCanopy: metrics.treeCanopy,
      greeneryIndex: metrics.greeneryIndex,
      greeneryLevel: metrics.greeneryLevel || null,
      floodHazard: metrics.floodHazard,
      stormHazard: boundedHazardLevel(stormHazard),
      aqi: metrics.aqi,
      taggedTreeCount: metrics.taggedTreeCount,
      inventoryCanopyFraction: metrics.inventoryCanopyFraction,
      areaHectares: metrics.areaHectares,
      visionContext,
    };

    let chunks: Awaited<ReturnType<typeof retrieveRelevantChunks>>["chunks"];
    let query: string;
    let hallucinations: string[] = [];
    let searchUnavailable = false;
    let data: GeneratedRecommendation[];

    try {
      const first = await runGeneration(body, context, {
        regenerate: body.regenerate,
      });
      data = first.data;
      chunks = first.chunks;
      query = first.query;
      hallucinations = first.hallucinations;
      searchUnavailable = first.searchUnavailable;
    } catch (firstErr) {
      console.warn("Recommendation generation failed; retrying once:", firstErr);
      try {
        const retry = await runGeneration(body, context, { regenerate: true });
        data = retry.data;
        chunks = retry.chunks;
        query = retry.query;
        hallucinations = retry.hallucinations;
        searchUnavailable = retry.searchUnavailable;
      } catch (retryErr) {
        console.error("Recommendation generation failed after retry:", retryErr);
        return NextResponse.json(
          {
            success: false,
            error:
              retryErr instanceof RecommendationOutputError
                ? retryErr.message
                : AI_UNAVAILABLE,
          },
          { status: 502 },
        );
      }
    }

    if (hallucinations.length > 0) {
      console.warn(
        `Detected ${hallucinations.length} potential hallucinations: ${hallucinations.join("; ")}`,
      );
    }

    if (!personal) {
      await saveGeneratedRecommendations(
        { ...body, areaHectares: metrics.areaHectares ?? undefined },
        data,
      );
    }

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
        groundingNote: searchUnavailable
          ? "Research search is unavailable right now, so these recommendations are based on general urban greening knowledge."
          : chunks.length === 0
            ? "No research studies matched this query. Recommendations are based on general urban greening knowledge."
            : chunks.length < 3
              ? "Limited research grounding. Recommendations may rely partially on general knowledge."
              : undefined,
        hallucinations:
          hallucinations.length > 0 ? hallucinations : undefined,
        query,
        // True when the result used the caller's photo and was not cached.
        personal: personal || undefined,
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
