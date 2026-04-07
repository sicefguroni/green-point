import { NextRequest, NextResponse } from "next/server";
import { generateTimelineRecord } from "@/lib/timeline/service";
import { TimelineServiceError } from "@/lib/timeline/service";
import { getCostEstimateCoherenceError } from "@/lib/cost-estimate-validation";
import { resolveRecommendationCostEstimate } from "@/lib/recommendation-cost-estimate";
import {
  retrieveRelevantChunks,
  type LocationContext,
} from "@/lib/rag";
import type { TimelineGenerateRequest, TimelineGenerateResponse } from "@/types/timeline";

function slugifyRecommendation(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizePayload(
  body: Partial<TimelineGenerateRequest>,
): TimelineGenerateRequest | null {
  const recommendation = body.recommendation;
  if (
    !recommendation?.solutionTitle ||
    !recommendation.solutionDescription ||
    !recommendation.interventionType
  ) {
    return null;
  }

  const fallbackRecommendationId =
    recommendation.recommendationId || slugifyRecommendation(recommendation.solutionTitle);

  return {
    ...body,
    recommendation: {
      ...recommendation,
      id: recommendation.id || fallbackRecommendationId,
      recommendationId: fallbackRecommendationId,
    },
  };
}

function normalizeRagContext(locationContext: LocationContext) {
  return {
    areaName: locationContext.areaName ?? undefined,
    ndvi: locationContext.ndvi ?? undefined,
    lst: locationContext.lst ?? undefined,
    treeCanopy: locationContext.treeCanopy ?? undefined,
    greeneryIndex: locationContext.greeneryIndex ?? undefined,
    greeneryLevel: locationContext.greeneryLevel ?? undefined,
    floodHazard: locationContext.floodHazard ?? undefined,
    stormHazard: locationContext.stormHazard ?? undefined,
    aqi: locationContext.aqi ?? undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<TimelineGenerateRequest>;
    const normalizedBody = normalizePayload(body);

    if (!normalizedBody) {
      return NextResponse.json(
        { success: false, error: "Invalid timeline generation payload." },
        { status: 400 },
      );
    }

    const locationContext: LocationContext = {
      areaName: normalizedBody.location?.barangay || normalizedBody.location?.name,
      ndvi: normalizedBody.metrics?.ndvi,
      lst: normalizedBody.metrics?.lst,
      treeCanopy: normalizedBody.metrics?.treeCanopy,
      greeneryIndex: normalizedBody.metrics?.greeneryIndex,
      greeneryLevel: normalizedBody.metrics?.greeneryLevel,
      floodHazard: normalizedBody.metrics?.floodHazard,
      stormHazard: normalizedBody.metrics?.stormHazard,
      aqi: normalizedBody.metrics?.aqi,
    };

    const ragResult = normalizedBody.ragMetadata ?? await retrieveRelevantChunks(locationContext, 6);
    const costEstimate = await resolveRecommendationCostEstimate(
      normalizedBody.recommendation,
      {
        location: normalizedBody.location,
        metrics: locationContext,
        ragQuery: ragResult.query,
        ragChunks: ragResult.chunks,
        providedCostEstimate: normalizedBody.costEstimate,
        refreshCostEstimate: normalizedBody.refreshCostEstimate,
      },
    );

    const costEstimateError = getCostEstimateCoherenceError(costEstimate);
    if (costEstimateError) {
      return NextResponse.json(
        { success: false, error: costEstimateError },
        { status: 502 },
      );
    }

    const record = await generateTimelineRecord({
      ...normalizedBody,
      costEstimate,
      ragMetadata: {
        query: ragResult.query,
        context: normalizeRagContext(locationContext),
        chunks: ragResult.chunks,
      },
    });

    // Validate timeline response shape before returning to frontend
    const timeline = record.timeline;
    if (
      !timeline ||
      !Array.isArray(timeline.phases) ||
      timeline.phases.length === 0
    ) {
      console.error("Timeline response has empty or missing phases:", record);
      return NextResponse.json(
        { success: false, error: "Timeline generation produced no valid phases. Please try again." },
        { status: 502 },
      );
    }

    for (const phase of timeline.phases) {
      if (!phase.id || !phase.name) {
        console.warn("Timeline phase missing id or name:", phase);
      }
      if (typeof phase.start_week !== "number" || phase.start_week < 0) {
        phase.start_week = 0;
      }
      if (typeof phase.duration_weeks !== "number" || phase.duration_weeks < 0) {
        phase.duration_weeks = 0;
      }
    }

    const response: TimelineGenerateResponse = {
      success: true,
      data: record,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to generate timeline:", error);
    if (error instanceof TimelineServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to generate timeline." },
      { status: 500 },
    );
  }
}