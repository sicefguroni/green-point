import { NextRequest, NextResponse } from "next/server";
import { approveTimelineRecord } from "@/lib/timeline/service";
import { TimelineServiceError } from "@/lib/timeline/service";
import type { TimelineApproveRequest, TimelineApproveResponse } from "@/types/timeline";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<TimelineApproveRequest>;

    if (!body.threadId) {
      return NextResponse.json(
        { success: false, error: "threadId is required." },
        { status: 400 },
      );
    }

    const record = await approveTimelineRecord(body.threadId, body.reviewerNotes);

    const response: TimelineApproveResponse = {
      success: true,
      data: record,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to approve timeline:", error);
    if (error instanceof TimelineServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to approve timeline." },
      { status: 500 },
    );
  }
}