import { NextRequest, NextResponse } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/home_dashboard",
  "/profile",
  "/settings",
  "/auth/onboarding",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** These routes should bounce an already signed-in user to the app (never block /auth/callback or /auth/confirm). */
function shouldRedirectIfAuthenticated(pathname: string) {
  if (pathname === "/login" || pathname === "/signup") return true;
  if (pathname === "/auth" || pathname === "/auth/") return true;
  if (pathname.startsWith("/auth/oauth/")) return true;
  if (pathname === "/auth/verify" || pathname.startsWith("/auth/verify/"))
    return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { response, supabase } = await updateSupabaseSession(request);

  const { pathname, search } = request.nextUrl;

  if (isProtectedPath(pathname)) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(redirectUrl);
    }

    const meta = data.user.user_metadata ?? {};
    const onboarded = Boolean(
      meta.onboarded === true || meta.hasCompletedOnboarding === true,
    );
    if (!onboarded && !pathname.startsWith("/auth/onboarding")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth/onboarding";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (shouldRedirectIfAuthenticated(pathname)) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/home_dashboard";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
