import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client/index";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";


export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { supabaseUserId: user.id },
    });

    return NextResponse.json({
      profile,
      email: user.email,
      emailConfirmedAt: user.email_confirmed_at,
      userMetadata: user.user_metadata ?? {},
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

type PatchBody = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  address?: string | null;
  bio?: string | null;
  businessName?: string | null;
  portfolioLinks?: string | null;
  avatarUrl?: string | null;
  avatarStoragePath?: string | null;
  idDocumentPath?: string | null;
  idDocumentFileName?: string | null;
};

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as PatchBody;

    const data: Prisma.ProfileUpdateInput = {};
    if (body.firstName !== undefined) data.firstName = body.firstName.trim() || null;
    if (body.lastName !== undefined) data.lastName = body.lastName.trim() || null;
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.address !== undefined) data.address = body.address?.trim() || null;
    if (body.bio !== undefined) data.bio = body.bio?.trim() || null;
    if (body.businessName !== undefined) data.businessName = body.businessName?.trim() || null;
    if (body.portfolioLinks !== undefined) data.portfolioLinks = body.portfolioLinks?.trim() || null;
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;
    if (body.avatarStoragePath !== undefined) data.avatarStoragePath = body.avatarStoragePath;
    if (body.idDocumentPath !== undefined) data.idDocumentPath = body.idDocumentPath;
    if (body.idDocumentFileName !== undefined) data.idDocumentFileName = body.idDocumentFileName;

    const profile = await prisma.profile.upsert({
      where: { supabaseUserId: user.id },
      create: {
        supabaseUserId: user.id,
        email: user.email ?? null,
        ...data,
      } as Prisma.ProfileUncheckedCreateInput,
      update: {
        email: user.email ?? undefined,
        ...data,
      },
    });

    const meta: Record<string, unknown> = { ...((user.user_metadata ?? {}) as Record<string, unknown>) };
    if (body.firstName !== undefined) meta.first_name = data.firstName;
    if (body.lastName !== undefined) meta.last_name = data.lastName;
    if (body.phone !== undefined) meta.phone = data.phone;
    if (body.address !== undefined) meta.address = data.address;
    if (body.bio !== undefined) meta.bio = data.bio;
    if (body.businessName !== undefined) meta.business_name = data.businessName;
    if (body.portfolioLinks !== undefined) meta.portfolio_links = data.portfolioLinks;
    if (body.avatarUrl !== undefined) meta.avatar_url = body.avatarUrl;

    const { error: updateError } = await supabase.auth.updateUser({
      data: meta as Record<string, string | null | boolean | undefined>,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ profile });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
