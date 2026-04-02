import { NextRequest, NextResponse } from "next/server";
import { isEmailRegisteredInPrisma } from "@/lib/auth/registrant";

/** Pre-flight check before email/password sign-up. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const registered = await isEmailRegisteredInPrisma(email);
    return NextResponse.json({ registered });
  } catch (e) {
    console.warn(
      "[check-email] Prisma unavailable — duplicate check skipped:",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ registered: false, degraded: true });
  }
}
