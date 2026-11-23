import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateAgentTimeline } from "@/lib/timeline/swarm-client";
import {
  SwarmUnavailableError,
  toSwarmUnavailableBody,
} from "@/lib/timeline/swarm-errors";
import { parseGenerateAgentTimelineRequest } from "@/lib/timeline/swarm-validation";

// Covers the swarm call's 45s timeout on every Vercel plan.
export const maxDuration = 60;

async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function POST(request: NextRequest) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseGenerateAgentTimelineRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const data = await generateAgentTimeline(parsed.value);

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof SwarmUnavailableError) {
      return NextResponse.json(toSwarmUnavailableBody(error), { status: 503 });
    }

    console.error("Timeline generate route failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Timeline generation failed.",
      },
      { status: 502 },
    );
  }
}