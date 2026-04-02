import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  bootstrapProfileStub,
  getProfileCompletionState,
} from "@/lib/auth/registrant";

function oauthEmail(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  if (user.email) return user.email;
  const meta = user.user_metadata ?? {};
  const fromMeta = meta.email;
  if (typeof fromMeta === "string" && fromMeta.includes("@")) return fromMeta;
  return null;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const { url, anonKey } = getSupabaseEnv();

  const response = NextResponse.redirect(new URL("/auth/onboarding", origin));

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        origin
      )
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    await supabase.auth.signOut();
    response.headers.set(
      "Location",
      new URL("/login?error=oauth_no_user", origin).toString()
    );
    return response;
  }

  const resolvedEmail = oauthEmail(user);

  let prismaOnboarded = false;
  try {
    await bootstrapProfileStub(user.id, resolvedEmail);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.warn(
      "[auth/callback] Prisma/bootstrap skipped (auth still succeeds):",
      detail
    );
  }

  try {
    const { hasCompletedOnboarding } = await getProfileCompletionState(
      user.id
    );
    prismaOnboarded = hasCompletedOnboarding;
  } catch {
    /* DB down or table missing — fall back to Supabase metadata only */
  }

  const meta = user.user_metadata ?? {};
  const onboarded =
    prismaOnboarded ||
    meta.onboarded === true ||
    meta.hasCompletedOnboarding === true;

  const dest = onboarded
    ? "/home_dashboard?toast=welcome_oauth"
    : "/auth/onboarding";

  response.headers.set("Location", new URL(dest, origin).toString());
  return response;
}
