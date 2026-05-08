/**
 * POST /api/recommendations/generate
 *
 * Accepts location metrics, runs RAG retrieval over indexed research studies,
 * then calls OpenAI to generate cited, grounded greening recommendations.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
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

function hasRecommendationEnvelope(
  value: GeneratedRecommendation[] | { recommendations?: GeneratedRecommendation[] },
): value is { recommendations?: GeneratedRecommendation[] } {
  return !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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
    } = body;

    if (!barangayId && !pointId && !cityId && !barangayName) {
      return NextResponse.json(
        { success: false, error: "A location identifier is required." },
        { status: 400 },
      );
    }

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
      : (hasRecommendationEnvelope(parsed) ? parsed.recommendations : []) ?? [];

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

    const sorted = [...validated].sort((a, b) =>
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
