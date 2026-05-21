import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { evaluateStrategies } from "@/lib/simulation/evaluate-strategies";
import { STRATEGY_LABELS } from "@/lib/simulation/presets";
import { resolveStrategyKey } from "@/lib/simulation/cost-model";
import { computeOverallRating, recommendationToRatingInput } from "@/lib/recommendations";
import { adjustRecommendationForContext } from "@/lib/intervention-context-scoring";
import {
  retrieveRelevantChunks,
  buildGenerationPrompt,
} from "@/lib/rag";
import type { LocationContext } from "@/lib/rag";
import type { SimulationBaselineData } from "@/components/ui/simulation/simulation-types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Shape of a raw row from the static GeoJSON file. */
interface StaticBarangayRow {
  name: string;
  greenery_index?: number;
  ndvi?: number;
  lst?: number;
  tree_canopy?: number;
  flood_exposure?: string;
  current_intervention?: string;
}

/** Shape returned to callers — every field guaranteed via defaults. */
export interface StaticBarangayMetrics {
  name: string;
  greenery_index: number;
  ndvi: number;
  lst: number;
  tree_canopy: number;
  flood_exposure: string;
  current_intervention: string;
}

/**
 * Full recommendation shape from the AI pipeline — matches what the POST
 * generate route produces, with engine evaluation metrics (costPHP, …).
 */
export interface AIBarangayRecommendation {
  name: string;
  interventionType: string;
  summary: string;
  description: string;
  justification: string;
  recommendedSpecies: string;
  rationale: string;
  sourceStudy: string | null;
  priority: "high" | "medium" | "low";
  efficiency: number;
  equity: number;
  cost: number;
  impact: number;
  relevancy: number;
  feasibility: number;
  overallRating: number;
  costPHP: number;
  impactGI: number;
  canopyDeltaPct: number;
  coolingDeltaC: number;
  pm25KgPerYear: number;
}

type Numeric01Key = "equity" | "cost" | "impact" | "relevancy" | "feasibility";

/**
 * Static barangay metrics for all Mandaue barangays, read from the GeoJSON
 * file bundled with the frontend.
 */
export function readStaticBarangayMetrics(): StaticBarangayMetrics[] {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "geo",
      "mandaue_barangays_gi.geojson",
    );
    const raw = fs.readFileSync(filePath, "utf-8");
    const rows = JSON.parse(raw) as StaticBarangayRow[];
    return rows
      .filter((r) => r.name && typeof r.name === "string")
      .map((r) => ({
        name: r.name,
        greenery_index: r.greenery_index ?? 0.5,
        ndvi: r.ndvi ?? 0.4,
        lst: r.lst ?? 32,
        tree_canopy: r.tree_canopy ?? 0.5,
        flood_exposure: r.flood_exposure ?? "Low",
        current_intervention: r.current_intervention ?? "None",
      }));
  } catch (err) {
    console.error("Error reading static barangay metrics:", err);
    return [];
  }
}

function parseImplementationOptions(
  raw: unknown,
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

/**
 * Build a SimulationBaselineData from static metrics + optional area.
 */
function metricsToBaseline(
  barangayName: string,
  metrics: {
    ndvi: number;
    lst: number;
    treeCanopy: number;
    greeneryIndex: number;
    floodExposure: string;
    areaHectares?: number;
    currentIntervention?: string;
  },
): SimulationBaselineData {
  return {
    name: barangayName,
    ndvi: metrics.ndvi,
    lst: metrics.lst,
    canopyCover: metrics.treeCanopy,
    greeneryIndex: metrics.greeneryIndex,
    floodExposure: metrics.floodExposure,
    areaHectares: metrics.areaHectares ?? 10,
    currentIntervention: metrics.currentIntervention ?? "urban canopy",
  };
}

/**
 * Run the full AI/RAG pipeline for a single barangay:
 *   1. Build context from static metrics
 *   2. Retrieve relevant research chunks (RAG)
 *   3. Build and send prompt to OpenAI (gpt-4o-mini)
 *   4. Parse, validate, and context-adjust the AI response
 *   5. Override scores with the deterministic engine (evaluateStrategies)
 *   6. Fill in missing canonical strategies (engine-only)
 *   7. Persist to GreeningRecommendation table
 *   8. Return the saved recommendations
 *
 * This mirrors the POST /api/recommendations/generate pipeline exactly.
 */
export async function generateAIBarangayRecs(
  barangayName: string,
  metrics: {
    ndvi: number;
    lst: number;
    treeCanopy: number;
    greeneryIndex: number;
    floodExposure: string;
    areaHectares?: number;
    currentIntervention?: string;
  },
): Promise<AIBarangayRecommendation[]> {
  // --- Step 1: Build context ---
  const floodLabel = (metrics.floodExposure ?? "Low").toLowerCase();
  const floodHazard = floodLabel.includes("high") || floodLabel.includes("severe") || floodLabel.includes("very")
    ? 3
    : floodLabel.includes("medium") || floodLabel.includes("mod")
      ? 2
      : 1;

  const context: LocationContext = {
    areaName: barangayName,
    ndvi: metrics.ndvi,
    lst: metrics.lst,
    treeCanopy: metrics.treeCanopy,
    greeneryIndex: metrics.greeneryIndex,
    floodHazard,
  };

  // --- Step 2: RAG retrieval ---
  const { chunks } = await retrieveRelevantChunks(context, 6);

  // --- Steps 3-4: OpenAI call ---
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

  interface RawRecommendation {
    name?: string;
    interventionType?: string;
    summary?: string;
    description?: string;
    justification?: string;
    recommendedSpecies?: string;
    rationale?: string;
    sourceStudy?: string | null;
    priority?: string;
    efficiency?: number;
    equity?: number;
    cost?: number;
    impact?: number;
    relevancy?: number;
    feasibility?: number;
  }

  let parsed: { recommendations?: RawRecommendation[] } | RawRecommendation[];
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error(`[backfill] AI returned invalid JSON for ${barangayName}, falling back to engine-only`);
    return deterministicFallback(barangayName, metrics);
  }

  const generated: RawRecommendation[] = Array.isArray(parsed)
    ? parsed
    : (parsed.recommendations ?? []);

  // --- Validate ---
  const REQUIRED_STRING_KEYS: (keyof RawRecommendation)[] = [
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
    if (!hasStrings) return false;
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
    console.warn(`[backfill] No valid AI recs for ${barangayName}, falling back to engine-only`);
    return deterministicFallback(barangayName, metrics);
  }

  // --- Step 5: Context adjust and override with engine scores ---
  const adjusted = validated.map((r) =>
    adjustRecommendationForContext(r, context),
  );

  const baseline = metricsToBaseline(barangayName, metrics);
  const evaluations = evaluateStrategies(baseline);
  const evalByStrategy = new Map(evaluations.map((e) => [e.strategy, e]));

  const data: AIBarangayRecommendation[] = adjusted.map((r) => {
    const canonicalStrategy = resolveStrategyKey(r.interventionType ?? "");
    const ev = evalByStrategy.get(canonicalStrategy);
    if (ev) {
      return {
        name: r.name ?? "Recommended Intervention",
        interventionType: canonicalStrategy,
        summary: r.summary ?? "",
        description: r.description ?? "",
        justification: r.justification ?? "",
        recommendedSpecies: r.recommendedSpecies ?? "",
        rationale: r.rationale ?? "",
        sourceStudy: r.sourceStudy ?? null,
        priority: (r.priority === "high" || r.priority === "medium" || r.priority === "low"
          ? r.priority
          : "medium") as "high" | "medium" | "low",
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
    }
    const ratingInput = recommendationToRatingInput(r as unknown as Record<string, unknown>);
    return {
      name: r.name ?? "Recommended Intervention",
      interventionType: r.interventionType ?? "—",
      summary: r.summary ?? "",
      description: r.description ?? "",
      justification: r.justification ?? "",
      recommendedSpecies: r.recommendedSpecies ?? "",
      rationale: r.rationale ?? "",
      sourceStudy: r.sourceStudy ?? null,
      priority: (r.priority === "high" || r.priority === "medium" || r.priority === "low"
        ? r.priority
        : "medium") as "high" | "medium" | "low",
      efficiency: r.efficiency ?? 0,
      equity: r.equity ?? 0,
      cost: r.cost ?? 0,
      impact: r.impact ?? 0,
      relevancy: r.relevancy ?? 0,
      feasibility: r.feasibility ?? 0.5,
      overallRating: computeOverallRating(ratingInput),
      costPHP: 0,
      impactGI: 0,
      canopyDeltaPct: 0,
      coolingDeltaC: 0,
      pm25KgPerYear: 0,
    };
  });

  // Sort by overallRating descending
  data.sort((a, b) => b.overallRating - a.overallRating);

  // --- Fill in missing canonical strategies ---
  const aiInterventionTypes = new Set(
    data.map((r) => r.interventionType.toLowerCase().trim()),
  );
  for (const ev of evaluations) {
    if (aiInterventionTypes.has(ev.strategy.toLowerCase())) continue;
    const labels = STRATEGY_LABELS[ev.strategy];
    data.push({
      name: labels?.label ?? ev.strategy,
      interventionType: ev.strategy,
      summary: labels?.tagline ?? `${ev.strategy} intervention for this site`,
      description: labels?.tagline ?? `${ev.strategy} intervention for this location`,
      justification: "Deterministic context-fit score from the simulation engine.",
      recommendedSpecies: "",
      rationale: "Scored by the GreenPoint engine based on site metrics and context-fit analysis.",
      sourceStudy: null,
      priority: ev.overallRating >= 70
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
    });
  }

  // --- Step 7: Persist to DB ---
  await saveRecsToDb(barangayName, data);
  return data;
}

/**
 * Pure-engine fallback when the AI pipeline fails for a barangay.
 * Produces all canonical strategies with deterministic scores.
 */
async function deterministicFallback(
  barangayName: string,
  metrics: {
    ndvi: number;
    lst: number;
    treeCanopy: number;
    greeneryIndex: number;
    floodExposure: string;
    areaHectares?: number;
    currentIntervention?: string;
  },
): Promise<AIBarangayRecommendation[]> {
  const baseline = metricsToBaseline(barangayName, metrics);
  const evaluations = evaluateStrategies(baseline);

  const data: AIBarangayRecommendation[] = evaluations.map((ev) => {
    const labels = STRATEGY_LABELS[ev.strategy];
    return {
      name: labels?.label ?? ev.strategy,
      interventionType: ev.strategy,
      summary: labels?.tagline ?? `${ev.strategy} intervention for this site`,
      description: labels?.tagline ?? `${ev.strategy} intervention for this location`,
      justification: "Deterministic context-fit score from the simulation engine.",
      recommendedSpecies: "",
      rationale: "Scored by the GreenPoint engine based on site metrics and context-fit analysis.",
      sourceStudy: null,
      priority: ev.overallRating >= 70 ? "high" : ev.overallRating >= 45 ? "medium" : "low",
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
  });

  await saveRecsToDb(barangayName, data);
  return data;
}

/**
 * Persist recommendations to the GreeningRecommendation DB table.
 * Replaces any existing AI Engine recs for this barangay.
 */
async function saveRecsToDb(
  barangayName: string,
  recs: AIBarangayRecommendation[],
): Promise<void> {
  const b = await prisma.barangay.findFirst({
    where: {
      barangayName: { equals: barangayName, mode: "insensitive" },
    },
  });
  if (!b) {
    console.warn(
      `[barangay-backfill] Barangay "${barangayName}" not found in DB — skipping save.`,
    );
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.greeningRecommendation.deleteMany({
      where: {
        barangayID: b.id,
        source: "AI Engine",
      },
    });

    await tx.greeningRecommendation.createMany({
      data: recs.map((rec) => ({
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
      })),
    });
  });
}

/**
 * Build the grouped-by-barangay response shape from raw DB records.
 * Shared so the by-barangay endpoint can use it.
 */
export function groupRecsByBarangay(
  dbRecs: Array<{
    barangay?: { barangayName: string } | null;
    name: string;
    description: string;
    interventionType: string;
    priority: string;
    implementationOptions: unknown;
  }>,
): Record<
  string,
  Array<{
    name: string;
    interventionType: string;
    summary: string;
    justification: string;
    priority: string;
    overallRating: number;
    costPHP?: number;
    impactGI?: number;
    canopyDeltaPct?: number;
    coolingDeltaC?: number;
    pm25KgPerYear?: number;
  }>
> {
  const grouped: Record<string, Array<{
    name: string;
    interventionType: string;
    summary: string;
    justification: string;
    priority: string;
    overallRating: number;
    costPHP?: number;
    impactGI?: number;
    canopyDeltaPct?: number;
    coolingDeltaC?: number;
    pm25KgPerYear?: number;
  }>> = {};

  for (const rec of dbRecs) {
    const bName = rec.barangay?.barangayName;
    if (!bName) continue;

    const options = parseImplementationOptions(rec.implementationOptions);

    const entry = {
      name: rec.name,
      interventionType: rec.interventionType,
      summary: (options.summary as string) ?? rec.description,
      justification: (options.justification as string) ?? "",
      priority: rec.priority,
      overallRating: (options.overallRating as number) ?? 0,
      costPHP: options.costPHP as number | undefined,
      impactGI: options.impactGI as number | undefined,
      canopyDeltaPct: options.canopyDeltaPct as number | undefined,
      coolingDeltaC: options.coolingDeltaC as number | undefined,
      pm25KgPerYear: options.pm25KgPerYear as number | undefined,
    };

    if (!grouped[bName]) grouped[bName] = [];
    grouped[bName].push(entry);
  }

  // Sort by overallRating descending
  for (const bName of Object.keys(grouped)) {
    grouped[bName].sort(
      (a, b) => (b.overallRating ?? 0) - (a.overallRating ?? 0),
    );
  }

  return grouped;
}
