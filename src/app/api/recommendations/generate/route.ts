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
import { evaluateStrategies } from "@/lib/simulation/evaluate-strategies";
import { STRATEGY_LABELS } from "@/lib/simulation/presets";
import { resolveStrategyKey } from "@/lib/simulation/cost-model";
import type { InterventionType } from "@/lib/simulation/coefficients";
import type { SimulationBaselineData } from "@/components/ui/simulation/simulation-types";
import {
  shouldUseVisionContext,
  visionContextSchema,
} from "@/lib/vision/context";
import { prisma } from "@/lib/prisma";

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



// Cache-refresh trigger comment to force IDE types reload
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
      forceRefresh,
    } = body;

    if (!barangayId && !pointId && !cityId && !barangayName) {
      return NextResponse.json(
        { success: false, error: "A location identifier is required." },
        { status: 400 },
      );
    }

    // Try loading from Cache first (skip if forceRefresh)
    if (!forceRefresh) {
      const cached = await getCachedRecommendations(body);
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached,
          meta: {
            cacheHit: true,
            note: "Fetched from persistent database cache.",
          },
        });
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

    // Step 1: RAG — retrieve relevant study excerpts
    const { chunks, query } = await retrieveRelevantChunks(context, 6);

    // Step 2: Build prompt and call OpenAI
    const { systemPrompt, userPrompt } = buildGenerationPrompt(context, chunks);

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
      return NextResponse.json(
        {
          success: false,
          error: "AI returned an invalid format. Please try again.",
        },
        { status: 502 },
      );
    }

    // Handle both {recommendations: [...]} and [...] shapes
    const generated: GeneratedRecommendation[] = Array.isArray(parsed)
      ? parsed
      : ((hasRecommendationEnvelope(parsed) ? parsed.recommendations : []) ??
        []);

    // Validate and filter: ensure each recommendation has required fields and valid ranges
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
      // Coerce numeric fields: clamp 0-1 for unit scores, 0-100 for efficiency
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

    if (validated.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "AI returned no valid recommendations. Please try again.",
        },
        { status: 502 },
      );
    }

    if (validated.length < 3 || validated.length > 5) {
      console.warn(
        `Recommendation count outside expected 3-5 range: got ${validated.length}`,
      );
    }

    const adjusted = validated.map((r) =>
      adjustRecommendationForContext(r, context),
    );

    // Validate citation accuracy: ensure sourceStudy actually exists in retrieved chunks
    const validStudyTitles = new Set(chunks.map((c) => c.studyTitle));
    const hallucinations: string[] = [];

    const citationValidated = adjusted.map((r) => {
      if (r.sourceStudy && typeof r.sourceStudy === "string") {
        // Check if the cited study is in our retrieved chunks (case-insensitive for robustness)
        const isValid = Array.from(validStudyTitles).some(
          (title) =>
            title.toLowerCase().trim() ===
            r.sourceStudy!.toLowerCase().trim(),
        );

        if (!isValid) {
          // Citation doesn't match any retrieved study
          hallucinations.push(
            `"${r.sourceStudy}" (cited in "${r.name}") not found in retrieved studies`,
          );
          console.warn(
            `⚠️ Citation validation: "${r.sourceStudy}" not in retrieved studies for recommendation "${r.name}"`,
          );
          // Clear the invalid citation
          r.sourceStudy = null;
        }
      }
      return r;
    });

    if (hallucinations.length > 0) {
      console.warn(
        `🚨 Detected ${hallucinations.length} potential hallucinations: ${hallucinations.join("; ")}`,
      );
    }

    // Build study reference map from retrieved chunks for formatting.
    // Keys are lowered to match citation validation (which is case-insensitive).
    const studyRefMap = new Map<string, { author: string | null; year: number | null }>();
    const studyTitleKeyMap = new Map<string, string>(); // lowered key → original title
    for (const c of chunks) {
      const key = c.studyTitle.toLowerCase().trim();
      if (!studyRefMap.has(key)) {
        studyRefMap.set(key, { author: c.studyAuthor, year: c.studyYear });
        studyTitleKeyMap.set(key, c.studyTitle);
      }
    }

    // Format sourceStudy with author/year in parentheses
    const withFormattedRefs = citationValidated.map((r) => {
      if (r.sourceStudy) {
        const key = r.sourceStudy.toLowerCase().trim();
        const ref = studyRefMap.get(key);
        const origTitle = studyTitleKeyMap.get(key);
        const displayTitle = origTitle ?? r.sourceStudy;
        if (ref) {
          const authorPart = ref.author ? ref.author : "";
          const yearPart = ref.year ? `, ${ref.year}` : "";
          if (authorPart || yearPart) {
            r.sourceStudy = `${displayTitle} (${authorPart}${yearPart})`;
          }
        }
      }
      return r;
    });

    const sorted = [...withFormattedRefs].sort((a, b) =>
      compareRecommendationsByOverallRating(
        a as unknown as Record<string, unknown>,
        b as unknown as Record<string, unknown>,
      ),
    );

    // === Single source of truth for ALL scores ===
    // The deterministic engine (`evaluateStrategies`) is the canonical
    // scorer for the dashboard table, simulation strategy picker, and
    // explore sidebar. AI provides the text (name, summary, description,
    // species, justification), but every canonical strategy's numerical
    // scores come from the same engine so all views agree.
    const baselineData: SimulationBaselineData = {
      name: barangayName ?? undefined,
      ndvi: ndvi ?? 0,
      lst: lst ?? 0,
      canopyCover: treeCanopy ?? 0,
      greeneryIndex: greeneryIndex ?? 0,
      floodExposure:
        floodHazard != null
          ? floodHazard >= 3
            ? "High"
            : floodHazard >= 2
              ? "Medium"
              : "Low"
          : "Low",
      areaHectares: areaHectares ?? 10,
      currentIntervention: "urban canopy",
    };
    const evaluations = evaluateStrategies(baselineData);
    const evalByStrategy = new Map(
      evaluations.map((e) => [e.strategy, e]),
    );

    // Override EVERY canonical strategy with deterministic engine scores.
    // AI-generated entries that lose their score override still keep their
    // text content (name, summary, species, etc.).
    // Engine evaluation metrics (costPHP, impactGI, canopyDeltaPct, coolingDeltaC,
    // pm25KgPerYear) are also embedded so the dashboard table can derive its
    // column values directly from the API response instead of running
    // `evaluateStrategies` a second time on the client.
    const data: GeneratedRecommendation[] = sorted.map((r) => {
      const canonicalStrategy = resolveStrategyKey(r.interventionType);
      const ev = evalByStrategy.get(canonicalStrategy);
      if (ev) {
        return {
          ...r,
          overallRating: ev.overallRating,
          efficiency: ev.overallRating,
          equity: ev.axes.equity,
          cost: ev.axes.cost,
          impact: ev.axes.impact,
          relevancy: ev.axes.relevancy,
          feasibility: ev.axes.feasibility,
          costPHP: ev.costPHP,
          impactGI: ev.impactGI,
          canopyDeltaPct: ev.canopyDeltaPct,
          coolingDeltaC: ev.coolingDeltaC,
          pm25KgPerYear: ev.pm25KgPerYear,
        };
      }
      return {
        ...r,
        overallRating: computeOverallRating(
          recommendationToRatingInput(
            r as unknown as Record<string, unknown>,
          ),
        ),
      };
    });

    // === Deduplicate: keep only the highest-rated recommendation per canonical strategy ===
    // AI often returns several recommendations with different names but the same
    // intervention type (e.g., "Street Tree Planting" and "Roadside Canopy Enhancement"
    // both map to "urban canopy"). The research-brief scaffold already only needs one
    // representative intervention per canonical strategy — keeping duplicates adds noise.
    const canonicalSeen = new Set<string>();
    const deduplicated: GeneratedRecommendation[] = [];
    for (const rec of data) {
      const canonical = resolveStrategyKey(rec.interventionType);
      if (canonicalSeen.has(canonical)) continue;
      canonicalSeen.add(canonical);
      deduplicated.push(rec);
    }
    data.length = 0;
    data.push(...deduplicated);

    // Re-sort by deterministic overallRating so the explore sidebar
    // card order matches the displayed scores (not the pre-override
    // AI-based sort order).
    data.sort(
      (a, b) => (b.overallRating ?? 0) - (a.overallRating ?? 0),
    );

    // Helper: find the most relevant study from chunks for a given strategy
    function formatStudyRef(studyTitle: string): string {
      const key = studyTitle.toLowerCase().trim();
      const ref = studyRefMap.get(key);
      const authorPart = ref?.author ? ref.author : "";
      const yearPart = ref?.year ? `, ${ref.year}` : "";
      if (authorPart || yearPart) {
        return `${studyTitle} (${authorPart}${yearPart})`;
      }
      return studyTitle;
    }

    function findStudyForStrategy(strategy: string): string | null {
      const labels = STRATEGY_LABELS[strategy as InterventionType];
      const keywords = [
        labels?.label ?? "",
        labels?.tagline ?? "",
        strategy,
      ]
        .filter(Boolean)
        .map((k) => k.toLowerCase());

      if (chunks.length === 0) return null;

      // Pass 1: match against study titles (strongest signal)
      for (const c of chunks) {
        const titleLower = c.studyTitle.toLowerCase();
        if (keywords.some((kw) => kw && titleLower.includes(kw))) {
          return formatStudyRef(c.studyTitle);
        }
      }

      // Pass 2: match against chunk content
      for (const c of chunks) {
        const contentLower = c.content.toLowerCase();
        if (keywords.some((kw) => kw && contentLower.includes(kw))) {
          return formatStudyRef(c.studyTitle);
        }
      }

      // Fallback: highest-similarity chunk
      return formatStudyRef(chunks[0].studyTitle);
    }

    // Fill in missing canonical strategies so every canonical greening
    // solution appears, even ones the AI didn't return.
    const aiInterventionTypes = new Set(
      data.map((r) => r.interventionType.toLowerCase().trim()),
    );
    for (const ev of evaluations) {
      if (aiInterventionTypes.has(ev.strategy.toLowerCase())) continue;
      const labels = STRATEGY_LABELS[ev.strategy];
      const studyRef = findStudyForStrategy(ev.strategy);
      const deterministicRec: GeneratedRecommendation = {
        name: labels?.label ?? ev.strategy,
        interventionType: ev.strategy,
        summary: labels?.tagline ?? `${ev.strategy} intervention for this site`,
        description:
          labels?.tagline ?? `${ev.strategy} intervention for this location`,
        justification:
          "Deterministic context-fit score from the simulation engine.",
        recommendedSpecies: "",
        rationale:
          "Scored by the GreenPoint engine based on site metrics and context-fit analysis.",
        sourceStudy: studyRef,
        priority:
          ev.overallRating >= 70
            ? "high"
            : ev.overallRating >= 45
              ? "medium"
              : "low",
        efficiency: ev.overallRating,
        equity: ev.axes.equity,
        cost: ev.axes.cost,
        impact: ev.axes.impact,
        relevancy: ev.axes.relevancy,
        feasibility: ev.axes.feasibility,
        overallRating: ev.overallRating,
        costPHP: ev.costPHP,
        impactGI: ev.impactGI,
        canopyDeltaPct: ev.canopyDeltaPct,
        coolingDeltaC: ev.coolingDeltaC,
        pm25KgPerYear: ev.pm25KgPerYear,
      };
      data.push(deterministicRec);
    }

    // === Guarantee: every recommendation MUST have a sourceStudy from RAG ===
    // AI-generated recs may have had citations cleared as hallucinations.
    // Deterministic fill-in recs may have gotten null if no chunk matched.
    // This step backfills any remaining nulls with the best available study.
    for (const rec of data) {
      if (rec.sourceStudy) continue;
      const strategy = resolveStrategyKey(rec.interventionType);
      rec.sourceStudy = findStudyForStrategy(strategy) ?? "General urban greening best practices";
    }

    // Cache the newly generated recommendations to DB
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
