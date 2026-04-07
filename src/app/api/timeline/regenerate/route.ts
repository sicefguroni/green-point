import { NextRequest, NextResponse } from "next/server";
import { buildGroundedCostEstimate } from "@/lib/cost-grounding";
import {
  retrieveRelevantChunks,
  type LocationContext,
} from "@/lib/rag";
import {
  regenerateTimelineRecord,
  TimelineServiceError,
} from "@/lib/timeline/service";
import type {
  TimelineRegenerateRequest,
  TimelineRegenerateResponse,
} from "@/types/timeline";

function slugifyRecommendation(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizePayload(
  body: Partial<TimelineRegenerateRequest>,
): TimelineRegenerateRequest | null {
  const recommendation = body.recommendation;
  if (
    !body.threadId ||
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
    threadId: body.threadId,
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
    const body = (await request.json()) as Partial<TimelineRegenerateRequest>;
    const normalizedBody = normalizePayload(body);

    if (!normalizedBody) {
      return NextResponse.json(
        { success: false, error: "Invalid timeline regeneration payload." },
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
    const costEstimate =
      normalizedBody.costEstimate ??
      await buildGroundedCostEstimate({
        interventionType: normalizedBody.recommendation.interventionType,
        solutionTitle: normalizedBody.recommendation.solutionTitle,
        solutionDescription: normalizedBody.recommendation.solutionDescription,
        rationale: normalizedBody.recommendation.rationale,
        sourceStudy: normalizedBody.recommendation.sourceStudy,
        barangay: normalizedBody.location?.barangay,
        locationName: normalizedBody.location?.name,
        metrics: locationContext,
        ragQuery: ragResult.query,
        ragChunks: ragResult.chunks,
      });

    const record = await regenerateTimelineRecord({
      ...normalizedBody,
      costEstimate,
      ragMetadata: {
        query: ragResult.query,
        context: normalizeRagContext(locationContext),
        chunks: ragResult.chunks,
      },
    });

    const response: TimelineRegenerateResponse = {
      success: true,
      data: record,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to regenerate timeline:", error);
    if (error instanceof TimelineServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to regenerate timeline." },
      { status: 500 },
    );
  }
}