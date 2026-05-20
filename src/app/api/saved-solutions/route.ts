import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

type VersionedSave = { id: string; previousVersionId: string | null } & Record<string, unknown>;

export async function GET(request: NextRequest) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const versionOf = request.nextUrl.searchParams.get("versionOf");
  const id = request.nextUrl.searchParams.get("id");

  try {
    if (id) {
      const save = await prisma.savedSolution.findFirst({
        where: { id, supabaseUserId: user.id },
      });
      return NextResponse.json({ success: true, data: save ?? null });
    }

    const saves = await prisma.savedSolution.findMany({
      where: { supabaseUserId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        previousVersionId: true,
        supabaseUserId: true,
        locationType: true,
        locationId: true,
        locationName: true,
        locationMetadata: true,
        solutionSnapshot: true,
        contextSnapshot: true,
        notes: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (versionOf) {
      const current = saves.find((save) => save.id === versionOf);
      if (!current) {
        return NextResponse.json({ success: true, data: [] });
      }

      let root = current;
      while (root.previousVersionId) {
        const previous = saves.find((save) => save.id === root.previousVersionId);
        if (!previous) break;
        root = previous;
      }

      const chain = [root];
      while (true) {
        const next = saves.find((save) => save.previousVersionId === chain[chain.length - 1].id);
        if (!next) break;
        chain.push(next);
      }

      return NextResponse.json({ success: true, data: chain });
    }

    return NextResponse.json({ success: true, data: saves.reverse() });
  } catch (err) {
    console.error("[api/saved-solutions] GET error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch saved solutions" },
      { status: 500 },
    );
  }
}

import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const {
    locationType,
    locationId,
    locationName,
    locationMetadata,
    solutionSnapshot,
    contextSnapshot,
    notes,
    tags,
    version,
    previousVersionId,
  } = body as Record<string, unknown>;

  if (!locationType || !solutionSnapshot || !contextSnapshot) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Build a deterministic checksum from the core inputs influencing the recommendation.
  const checksumPayload = {
    locationType,
    locationId,
    locationName,
    locationMetadata,
    solutionSnapshot,
    contextSnapshot,
    generationParams: (body as any).generationParams ?? {},
    sourceStudyIds: (body as any).sourceStudyIds ?? [],
  };
  const inputChecksum = crypto.createHash('sha256').update(JSON.stringify(checksumPayload)).digest('hex');

  // Find the most recent version for this user/location.
  const latest = await prisma.savedSolution.findFirst({
    where: {
      supabaseUserId: user.id,
      locationType: String(locationType),
      locationId: locationId ? String(locationId) : null,
    },
    orderBy: { createdAt: 'desc' },
  });

  // If the checksum matches the latest version, return the existing record (prevent duplicate).
  if (latest && latest.inputChecksum === inputChecksum) {
    return NextResponse.json({ success: true, data: latest }, { status: 200 });
  }

  try {
    const save = await prisma.savedSolution.create({
      data: {
        supabaseUserId: user.id,
        locationType: String(locationType),
        locationId: locationId ? String(locationId) : null,
        locationName: locationName ? String(locationName) : null,
        locationMetadata: locationMetadata ?? undefined,
        solutionSnapshot,
        contextSnapshot,
        notes: notes ? String(notes) : null,
        tags: Array.isArray(tags) ? tags : [],
        generationParams: (body as any).generationParams ?? {},
        sourceStudyIds: (body as any).sourceStudyIds ?? [],
        inputChecksum,
        previousVersionId: latest?.id,
      },
    });

    return NextResponse.json({ success: true, data: save }, { status: 201 });
  } catch (err) {
    console.error("[api/saved-solutions] POST error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to save solution" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { success: false, error: "id is required" },
      { status: 400 },
    );
  }

  try {
    await prisma.savedSolution.deleteMany({
      where: { id, supabaseUserId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/saved-solutions] DELETE error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete saved solution" },
      { status: 500 },
    );
  }
}
