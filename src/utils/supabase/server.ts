import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/supabase/env";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Server Supabase client with an explicit cookie store (Supabase doc-style).
 * Prefer `createSupabaseServerClient` from `@/lib/supabase/server` when you do not need to pass cookies.
 */
export function createClient(cookieStore: CookieStore) {
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component without mutable cookies; middleware refreshes sessions.
        }
      },
    },
  });
}
