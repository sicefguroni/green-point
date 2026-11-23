import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseCreateTimelineVersionRequest } from "@/lib/timeline/validation";

class VersionConflictError extends Error {
  constructor(readonly latestVersionId: string | null) {
    super("VERSION_CONFLICT");
  }
}

// Two saves racing for the same next versionNumber trip @@unique([timelineId, versionNumber]).
function isConcurrentVersionInsertError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isMissingTimelineTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    typeof error.meta?.table === "string" &&
    error.meta.table.includes("ProjectTimeline")
  );
}

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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ timelineId: string }> },
) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { timelineId } = await context.params;
  const timeline = await prisma.projectTimeline
    .findUnique({
      where: { id: timelineId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
        },
      },
    })
    .catch((error: unknown) => {
      if (isMissingTimelineTableError(error)) {
        return null;
      }

      throw error;
    });

  if (!timeline) {
    return NextResponse.json({ error: "Timeline not found." }, { status: 404 });
  }

  return NextResponse.json({
    data: timeline.versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      basedOnVersionId: version.basedOnVersionId,
      changeReason: version.changeReason,
      snapshot: version.snapshotJson,
      createdBySupabaseUserId: version.createdBySupabaseUserId,
      createdAt: version.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ timelineId: string }> },
) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseCreateTimelineVersionRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { timelineId } = await context.params;

  const createdVersion = await prisma
    .$transaction(async (tx) => {
      const timeline = await tx.projectTimeline.findUnique({
        where: { id: timelineId },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      });

      if (!timeline) {
        throw new Error("TIMELINE_NOT_FOUND");
      }

      const latestVersion = timeline.versions[0];

      const { expectedVersionId } = parsed.value;
      if (
        expectedVersionId &&
        latestVersion &&
        latestVersion.id !== expectedVersionId
      ) {
        throw new VersionConflictError(latestVersion.id);
      }

      const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

      const version = await tx.projectTimelineVersion.create({
        data: {
          timelineId,
          versionNumber: nextVersionNumber,
          basedOnVersionId: latestVersion?.id,
          changeReason: parsed.value.changeReason ?? "Timeline amendment",
          snapshotJson: parsed.value.snapshot as unknown as Prisma.InputJsonValue,
          createdBySupabaseUserId: user.id,
        },
      });

      await tx.projectTimeline.update({
        where: { id: timelineId },
        data: {
          status: parsed.value.status ?? timeline.status,
          updatedAt: new Date(),
        },
      });

      return version;
    })
    .catch((error: unknown) => {
      if (error instanceof VersionConflictError) {
        return error;
      }

      if (isConcurrentVersionInsertError(error)) {
        return new VersionConflictError(null);
      }

      if (isMissingTimelineTableError(error)) {
        return null;
      }

      if (error instanceof Error && error.message === "TIMELINE_NOT_FOUND") {
        return null;
      }

      throw error;
    });

  if (createdVersion instanceof VersionConflictError) {
    return NextResponse.json(
      {
        error:
          "This timeline was changed by someone else after you started editing.",
        code: "VERSION_CONFLICT",
        latestVersionId: createdVersion.latestVersionId,
      },
      { status: 409 },
    );
  }

  if (!createdVersion) {
    return NextResponse.json(
      {
        error:
          "Timeline tables are not available yet, or the requested timeline was not found. Run the project timeline Prisma migration before saving amendments.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      data: {
        id: createdVersion.id,
        versionNumber: createdVersion.versionNumber,
        basedOnVersionId: createdVersion.basedOnVersionId,
        changeReason: createdVersion.changeReason,
        snapshot: createdVersion.snapshotJson,
        createdBySupabaseUserId: createdVersion.createdBySupabaseUserId,
        createdAt: createdVersion.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}