import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { bootstrapProfileStub } from "@/lib/auth/registrant";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as
    | "signup"
    | "invite"
    | "magiclink"
    | "recovery"
    | "email_change"
    | null;
  const next = requestUrl.searchParams.get("next") ?? "/auth/onboarding";

  const response = NextResponse.redirect(new URL(next, requestUrl.origin));

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/login?error=missing_token", requestUrl.origin));
  }

  const { url, anonKey } = getSupabaseEnv();
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

  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id) {
    await bootstrapProfileStub(user.id, user.email ?? null);
  }

  return response;
}

