import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  bootstrapProfileStub,
  getProfileCompletionState,
  registrantExists,
} from "@/lib/auth/registrant";

/**
 * After email/password sign-in: verify Prisma registration and onboarding flag.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const meta = user.user_metadata ?? {};
    const metaOnboarded = Boolean(
      meta.onboarded === true || meta.hasCompletedOnboarding === true
    );

    let registered = true;
    let prismaOnboarded = false;

    try {
      registered = await registrantExists(user.email ?? null, user.id);
      const { hasCompletedOnboarding } = await getProfileCompletionState(
        user.id
      );
      prismaOnboarded = hasCompletedOnboarding;
    } catch (e) {
      console.warn(
        "[registrant-status] Prisma unavailable — allowing sign-in from Supabase only:",
        e instanceof Error ? e.message : e
      );
      registered = true;
      prismaOnboarded = false;
    }

    if (!registered) {
      try {
        await bootstrapProfileStub(user.id, user.email ?? null);
        registered = await registrantExists(user.email ?? null, user.id);
      } catch (e) {
        console.warn(
          "[registrant-status] Profile bootstrap failed:",
          e instanceof Error ? e.message : e
        );
      }
    }

    const onboarded = prismaOnboarded || metaOnboarded;

    return NextResponse.json({
      registered,
      hasCompletedOnboarding: onboarded,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
