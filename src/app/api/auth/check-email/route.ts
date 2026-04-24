import { NextRequest, NextResponse } from "next/server";
import { isEmailRegisteredInSupabaseAuth } from "@/lib/auth/supabase-auth-email-exists";
import { isEmailRegisteredInPrisma } from "@/lib/auth/registrant";

type CheckEmailResponse = {
  registered: boolean;
  /** True when Prisma failed and/or Supabase Auth admin could not be queried. */
  degraded: boolean;
  /** True when GoTrue admin returned a response for this email (requires SUPABASE_SERVICE_ROLE_KEY). */
  supabaseAuthChecked: boolean;
};

/** Pre-flight check before email/password sign-up (Prisma + Supabase Auth when service role is set). */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 },
    );
  }

  let prismaRegistered = false;
  let prismaOk = true;
  try {
    prismaRegistered = await isEmailRegisteredInPrisma(email);
  } catch (e) {
    prismaOk = false;
    console.warn(
      "[check-email] Prisma unavailable:",
      e instanceof Error ? e.message : e,
    );
  }

  let supabaseAuthChecked = false;
  let supabaseRegistered = false;
  try {
    const auth = await isEmailRegisteredInSupabaseAuth(email);
    supabaseAuthChecked = auth.checked;
    supabaseRegistered = auth.exists;
  } catch (e) {
    console.warn(
      "[check-email] Supabase Auth admin check failed:",
      e instanceof Error ? e.message : e,
    );
  }

  const registered = prismaRegistered || supabaseRegistered;
  const degraded = !prismaOk || !supabaseAuthChecked;

  const payload: CheckEmailResponse = {
    registered,
    degraded,
    supabaseAuthChecked,
  };

  return NextResponse.json(payload);
}
