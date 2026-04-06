import { NextRequest, NextResponse } from "next/server";
import { generateTimelineRecord } from "@/lib/timeline/service";
import type { TimelineGenerateRequest, TimelineGenerateResponse } from "@/types/timeline";

function isValidPayload(body: Partial<TimelineGenerateRequest>): body is TimelineGenerateRequest {
  return Boolean(
    body.recommendation?.id &&
      body.recommendation.solutionTitle &&
      body.recommendation.solutionDescription &&
      body.recommendation.interventionType,
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<TimelineGenerateRequest>;

    if (!isValidPayload(body)) {
      return NextResponse.json(
        { success: false, error: "Invalid timeline generation payload." },
        { status: 400 },
      );
    }

    const record = await generateTimelineRecord(body);
    const response: TimelineGenerateResponse = {
      success: true,
      data: record,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to generate timeline:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate timeline." },
      { status: 500 },
    );
  }
}