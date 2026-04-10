/**
 * Deduplicates concurrent GET /api/profile (navbar provider + profile page + auth events).
 * Call invalidate after PATCH so the next read is not a stale shared result.
 */

export type ProfileGetPayload = {
  profile: Record<string, unknown> | null;
  email: string | null;
  emailConfirmedAt: string | null;
  userMetadata: Record<string, unknown>;
};

export type ProfileGetResult =
  | { ok: true; data: ProfileGetPayload }
  | { ok: false; status: number; error?: string };

let inFlight: Promise<ProfileGetResult> | null = null;

export function invalidateProfileGetDeduped(): void {
  inFlight = null;
}

async function loadProfileOnce(): Promise<ProfileGetResult> {
  const res = await fetch("/api/profile", { credentials: "same-origin" });
  const json = (await res.json()) as ProfileGetPayload & { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: json.error,
    };
  }
  return {
    ok: true,
    data: {
      profile: json.profile ?? null,
      email: json.email ?? null,
      emailConfirmedAt: json.emailConfirmedAt ?? null,
      userMetadata: json.userMetadata ?? {},
    },
  };
}

/** Single in-flight request shared by all callers until it settles. */
export async function fetchProfileGetDeduped(): Promise<ProfileGetResult> {
  if (!inFlight) {
    const p = loadProfileOnce();
    inFlight = p.finally(() => {
      if (inFlight === p) inFlight = null;
    });
  }
  return inFlight;
}
