import { NextRequest, NextResponse } from "next/server";
import { generateTimelineRecord } from "@/lib/timeline/service";
import { TimelineServiceError } from "@/lib/timeline/service";
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

    const record = await generateTimelineRecord({
      ...normalizedBody,
      ragMetadata: {
        query: ragResult.query,
        context: {
          areaName: locationContext.areaName,
          ndvi: locationContext.ndvi,
          lst: locationContext.lst,
          treeCanopy: locationContext.treeCanopy,
          greeneryIndex: locationContext.greeneryIndex,
          greeneryLevel: locationContext.greeneryLevel,
          floodHazard: locationContext.floodHazard,
          stormHazard: locationContext.stormHazard,
          aqi: locationContext.aqi,
        },
        chunks: ragResult.chunks,
      },
    });
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