import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Returns the signed-in Supabase user for this request, or null.
 * Uses `auth.getUser()`, which validates the session with Supabase instead of
 * trusting the cookie contents.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("Failed to read the Supabase session:", error);
    return null;
  }
}

/**
 * Admin access comes only from `app_metadata.role`, which only the Supabase
 * service role can write. `user_metadata` is editable by the user themself and
 * must never grant a role.
 */
export function isAdminUser(user: Pick<User, "app_metadata">): boolean {
  const role = user.app_metadata?.role;
  return typeof role === "string" && role.trim().toUpperCase() === "ADMIN";
}

export type AuthCheck =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

export async function requireUser(
  message = "Sign in to continue.",
): Promise<AuthCheck> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: message },
        { status: 401 },
      ),
    };
  }

  return { ok: true, user };
}

export async function requireAdmin(): Promise<AuthCheck> {
  const check = await requireUser();
  if (!check.ok) {
    return check;
  }

  if (!isAdminUser(check.user)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Administrator access required." },
        { status: 403 },
      ),
    };
  }

  return check;
}
