import { getSupabaseEnv } from "@/lib/supabase/env";
import { normalizeEmail } from "@/lib/auth/registrant";

type AdminUsersPayload = {
  users?: Array<{ email?: string | null }>;
};

/**
 * Uses GoTrue `GET /auth/v1/admin/users?filter=...` (service role).
 * Filter matching is server-defined; we always compare normalized emails on our side.
 */
export async function isEmailRegisteredInSupabaseAuth(email: string): Promise<{
  checked: boolean;
  exists: boolean;
}> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    return { checked: false, exists: false };
  }

  const norm = normalizeEmail(email);
  const { url, anonKey } = getSupabaseEnv();
  const base = url.replace(/\/+$/, "");
  const filter = encodeURIComponent(norm);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(
      `${base}/auth/v1/admin/users?filter=${filter}&per_page=200`,
      {
        method: "GET",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      console.warn(
        "[supabase-auth-email-exists] admin users HTTP",
        res.status,
        await res.text().catch(() => ""),
      );
      return { checked: false, exists: false };
    }

    const body = (await res.json()) as AdminUsersPayload;
    const users = body.users ?? [];
    const exists = users.some(
      (u) => u.email && normalizeEmail(u.email) === norm,
    );
    return { checked: true, exists };
  } catch (e) {
    console.warn(
      "[supabase-auth-email-exists] request failed:",
      e instanceof Error ? e.message : e,
    );
    return { checked: false, exists: false };
  } finally {
    clearTimeout(t);
  }
}
