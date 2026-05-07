import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/saved-solutions — list all saves for the current user
// ---------------------------------------------------------------------------
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const saves = await prisma.savedSolution.findMany({
      where: { supabaseUserId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: saves });
  } catch (err) {
    console.error("[api/saved-solutions] GET error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch saved solutions" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/saved-solutions — create a new save
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      locationType,
      locationId,
      locationName,
      locationMetadata,
      solutionSnapshot,
      contextSnapshot,
      notes,
      tags,
    } = body;

    if (!locationType || !solutionSnapshot || !contextSnapshot) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const save = await prisma.savedSolution.create({
      data: {
        supabaseUserId: user.id,
        locationType,
        locationId: locationId ?? null,
        locationName: locationName ?? null,
        locationMetadata: locationMetadata ?? undefined,
        solutionSnapshot,
        contextSnapshot,
        notes: notes ?? null,
        tags: tags ?? [],
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

// ---------------------------------------------------------------------------
// DELETE /api/saved-solutions?id=<id> — remove a single save
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
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
