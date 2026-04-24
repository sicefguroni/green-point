export type OAuthProvider = "google";

export const OAUTH_PROVIDERS: readonly OAuthProvider[] = ["google"];

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/** Starts Supabase OAuth via server route (sets PKCE cookies, then redirects to the IdP). */
export function startOAuthRedirect(provider: OAuthProvider, next: string) {
  if (typeof window === "undefined") return;
  window.location.href = `/api/auth/oauth/${provider}?next=${encodeURIComponent(next)}`;
}
