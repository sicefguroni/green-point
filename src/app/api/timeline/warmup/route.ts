import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkSwarmHealth } from "@/lib/timeline/swarm-client";

// A sleeping Render instance holds the /health request until it has booted,
// which can take most of a minute.
export const maxDuration = 60;

const WARMUP_TIMEOUT_MS = 50_000;

/** Wakes the timeline swarm service so the user's first generation doesn't hit a cold start. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ready = await checkSwarmHealth(WARMUP_TIMEOUT_MS);

  return NextResponse.json(
    { ready },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
