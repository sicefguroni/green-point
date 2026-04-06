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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface GeneratedRecommendation {
  name: string;
  interventionType: string;
  description: string;
  rationale: string;
  sourceStudy: string | null;
  priority: "high" | "medium" | "low";
  estimatedImpact: string;
  efficiency: number;
  relevancy: number;
  cost: number;
  costUnit: string;
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
    } = body;

    if (!barangayId && !pointId && !cityId && !barangayName) {
      return NextResponse.json(
        { success: false, error: "A location identifier is required." },
        { status: 400 }
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

    let parsed: { recommendations?: GeneratedRecommendation[] } | GeneratedRecommendation[];
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { success: false, error: "AI returned an invalid format. Please try again." },
        { status: 502 }
      );
    }

    // Handle both {recommendations: [...]} and [...] shapes
    const generated: GeneratedRecommendation[] = Array.isArray(parsed)
      ? parsed
      : (parsed as any).recommendations ?? [];

    return NextResponse.json({
      success: true,
      data: generated,
      meta: {
        retrievedChunks: chunks.length,
        uniqueStudies: [...new Set(chunks.map((c) => c.studyTitle))],
        query,
      },
    });
  } catch (error) {
    console.error("Error generating RAG recommendations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate recommendations." },
      { status: 500 }
    );
  }
}
