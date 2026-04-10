import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseCreateTimelineVersionRequest } from "@/lib/timeline/validation";

const timelinePrisma = prisma as typeof prisma & {
  projectTimeline: any;
  projectTimelineVersion: any;
};

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
  const timeline = await timelinePrisma.projectTimeline
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

  const createdVersion = await timelinePrisma
    .$transaction(async (tx) => {
      const timelineTx = tx as typeof tx & {
        projectTimeline: any;
        projectTimelineVersion: any;
      };

      const timeline = await timelineTx.projectTimeline.findUnique({
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
      const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

      const version = await timelineTx.projectTimelineVersion.create({
        data: {
          timelineId,
          versionNumber: nextVersionNumber,
          basedOnVersionId: latestVersion?.id,
          changeReason: parsed.value.changeReason ?? "Timeline amendment",
          snapshotJson: parsed.value.snapshot,
          createdBySupabaseUserId: user.id,
        },
      });

      await timelineTx.projectTimeline.update({
        where: { id: timelineId },
        data: {
          status: parsed.value.status ?? timeline.status,
          updatedAt: new Date(),
        },
      });

      return version;
    })
    .catch((error: unknown) => {
      if (isMissingTimelineTableError(error)) {
        return null;
      }

      if (error instanceof Error && error.message === "TIMELINE_NOT_FOUND") {
        return null;
      }

      throw error;
    });

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