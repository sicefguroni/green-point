import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { bootstrapProfileStub } from "@/lib/auth/registrant";

const TOKEN_HASH_TYPES = new Set([
  "signup",
  "email",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
]);

const DEFAULT_NEXT = "/auth/onboarding";

function safeInternalNext(
  next: string | null,
  origin: string,
  fallback: string = DEFAULT_NEXT,
): string {
  if (!next || next.length > 2048) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  try {
    const baseOrigin = new URL(origin).origin;
    const resolved = new URL(next, origin);
    if (resolved.origin !== baseOrigin) return fallback;
    const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    return path || fallback;
  } catch {
    return fallback;
  }
}

function destinationWithVerifiedFlag(nextPath: string, origin: string): URL {
  const safe = safeInternalNext(nextPath, origin);
  const url = new URL(safe.startsWith("/") ? safe : `/${safe}`, origin);
  if (!url.searchParams.has("verified")) {
    url.searchParams.set("verified", "1");
  }
  return url;
}

async function safeBootstrap(userId: string, email: string | null | undefined) {
  try {
    await bootstrapProfileStub(userId, email ?? null);
  } catch (e) {
    console.warn(
      "[auth/confirm] Profile bootstrap skipped (session still valid):",
      e instanceof Error ? e.message : e,
    );
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const rawNext = safeInternalNext(
    requestUrl.searchParams.get("next"),
    origin,
    DEFAULT_NEXT,
  );

  const { url, anonKey } = getSupabaseEnv();

  const attachCookies = (response: NextResponse) =>
    createServerClient(url, anonKey, {
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

  const code = requestUrl.searchParams.get("code");
  if (code) {
    const response = NextResponse.redirect(destinationWithVerifiedFlag(rawNext, origin));
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    const supabase = attachCookies(response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
      );
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=oauth_no_user", origin));
    }
    await safeBootstrap(user.id, user.email);
    response.headers.set(
      "Location",
      destinationWithVerifiedFlag(rawNext, origin).toString(),
    );
    return response;
  }

  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  if (!token_hash || !type || !TOKEN_HASH_TYPES.has(type)) {
    return NextResponse.redirect(new URL("/login?error=missing_token", origin));
  }

  const response = NextResponse.redirect(destinationWithVerifiedFlag(rawNext, origin));
  response.headers.set("Cache-Control", "no-store, must-revalidate");
  const supabase = attachCookies(response);

  const { error } = await supabase.auth.verifyOtp({
    type: type as
      | "signup"
      | "email"
      | "invite"
      | "magiclink"
      | "recovery"
      | "email_change",
    token_hash,
  });
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id) {
    await safeBootstrap(user.id, user.email ?? null);
  }

  response.headers.set(
    "Location",
    destinationWithVerifiedFlag(rawNext, origin).toString(),
  );
  return response;
}
