import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/prisma_app/generated/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const prisma = new PrismaClient();

type Body = {
  firstName: string;
  lastName: string;
  phone?: string | null;
  address: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();
    const address = body.address?.trim();
    const phone = body.phone?.trim() || null;

    if (!firstName || !lastName || !address) {
      return NextResponse.json(
        { error: "firstName, lastName, and address are required" },
        { status: 400 }
      );
    }

    await prisma.profile.upsert({
      where: { supabaseUserId: user.id },
      create: {
        supabaseUserId: user.id,
        email: user.email ?? null,
        firstName,
        lastName,
        phone,
        address,
        hasCompletedOnboarding: true,
      },
      update: {
        email: user.email ?? undefined,
        firstName,
        lastName,
        phone,
        address,
        hasCompletedOnboarding: true,
      },
    });

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        onboarded: true,
        hasCompletedOnboarding: true,
        first_name: firstName,
        last_name: lastName,
        phone,
        address,
      },
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
