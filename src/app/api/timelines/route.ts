import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseCreateProjectTimelineRequest } from "@/lib/timeline/validation";
import {
  type ProjectTimelineRecord,
  type TimelineRecommendationInput,
} from "@/types/timeline";

const timelinePrisma = prisma as typeof prisma & {
  greeningRecommendation: any;
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

function toTimelineRecord(
  timeline: any,
): ProjectTimelineRecord {
  const orderedVersions = [...timeline.versions].sort(
    (left, right) => right.versionNumber - left.versionNumber,
  );
  const currentVersion = orderedVersions[0];

  return {
    id: timeline.id,
    recommendationId: timeline.recommendationId,
    status: timeline.status,
    createdBySupabaseUserId: timeline.createdBySupabaseUserId,
    createdAt: timeline.createdAt.toISOString(),
    updatedAt: timeline.updatedAt.toISOString(),
    currentVersion: {
      id: currentVersion.id,
      versionNumber: currentVersion.versionNumber,
      basedOnVersionId: currentVersion.basedOnVersionId,
      changeReason: currentVersion.changeReason,
      createdBySupabaseUserId: currentVersion.createdBySupabaseUserId,
      createdAt: currentVersion.createdAt.toISOString(),
      snapshot: currentVersion.snapshotJson as ProjectTimelineRecord["currentVersion"]["snapshot"],
    },
    versions: orderedVersions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      basedOnVersionId: version.basedOnVersionId,
      changeReason: version.changeReason,
      createdBySupabaseUserId: version.createdBySupabaseUserId,
      createdAt: version.createdAt.toISOString(),
    })),
  };
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

async function resolveRecommendationId(
  recommendationId: string | undefined,
  recommendationKey: string | undefined,
  recommendation: TimelineRecommendationInput | undefined,
) {
  if (recommendationId) {
    const existingRecommendation = await timelinePrisma.greeningRecommendation.findUnique({
      where: { id: recommendationId },
      select: { id: true },
    });

    if (existingRecommendation) {
      return existingRecommendation.id;
    }
  }

  const recommendationLookupKey =
    recommendationKey ?? recommendation?.recommendationKey;

  if (!recommendationLookupKey) {
    return null;
  }

  const existingByKey = await timelinePrisma.greeningRecommendation.findUnique({
    where: { recommendationID: recommendationLookupKey },
    select: { id: true },
  });

  if (existingByKey) {
    return existingByKey.id;
  }

  if (!recommendation) {
    return null;
  }

  const createdRecommendation = await timelinePrisma.greeningRecommendation.create({
    data: {
      recommendationID: recommendationLookupKey,
      source: recommendation.source ?? "Explore UI",
      name: recommendation.title,
      description: recommendation.description,
      interventionType: recommendation.interventionType ?? "general",
      relevancy: recommendation.relevancy ?? 0.5,
      efficiency: recommendation.efficiencyScore ?? undefined,
      cost: recommendation.estimatedCost ?? undefined,
      costUnit: recommendation.costUnit ?? undefined,
      equity: recommendation.equityIndex ?? undefined,
      priority: recommendation.priority ?? "medium",
      status: "proposed",
      hasBudget: recommendation.hasBudget ?? false,
    },
    select: { id: true },
  });

  return createdRecommendation.id;
}

export async function GET(request: NextRequest) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recommendationId = request.nextUrl.searchParams.get("recommendationId");
  const recommendationKey = request.nextUrl.searchParams.get("recommendationKey");
  const timelineId = request.nextUrl.searchParams.get("timelineId");

  if (!recommendationId && !recommendationKey && !timelineId) {
    return NextResponse.json(
      {
        error:
          "recommendationId, recommendationKey, or timelineId is required.",
      },
      { status: 400 },
    );
  }

  const timeline = await timelinePrisma.projectTimeline
    .findFirst({
      where: timelineId
        ? { id: timelineId }
        : recommendationId
          ? { recommendationId }
          : { recommendation: { recommendationID: recommendationKey! } },
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

  return NextResponse.json({ data: toTimelineRecord(timeline) });
}

export async function POST(request: NextRequest) {
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

  const parsed = parseCreateProjectTimelineRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const resolvedRecommendationId = await resolveRecommendationId(
    parsed.value.recommendationId,
    parsed.value.recommendationKey,
    parsed.value.recommendation,
  );

  if (!resolvedRecommendationId) {
    return NextResponse.json(
      { error: "Recommendation not found or could not be created." },
      { status: 404 },
    );
  }

  const existingTimeline = await timelinePrisma.projectTimeline
    .findUnique({
      where: { recommendationId: resolvedRecommendationId },
      select: { id: true },
    })
    .catch((error: unknown) => {
      if (isMissingTimelineTableError(error)) {
        return null;
      }

      throw error;
    });

  if (existingTimeline) {
    return NextResponse.json(
      {
        error:
          "A project timeline already exists for this recommendation. Create a new version instead.",
      },
      { status: 409 },
    );
  }

  const createdTimeline = await timelinePrisma
    .$transaction(async (tx) => {
      const timelineTx = tx as typeof tx & {
        projectTimeline: any;
        projectTimelineVersion: any;
      };

      const timeline = await timelineTx.projectTimeline.create({
        data: {
          recommendationId: resolvedRecommendationId,
          status: parsed.value.status ?? "active",
          createdBySupabaseUserId: user.id,
        },
      });

      await timelineTx.projectTimelineVersion.create({
        data: {
          timelineId: timeline.id,
          versionNumber: 1,
          changeReason: parsed.value.changeReason ?? "Initial project timeline",
          snapshotJson: parsed.value.snapshot,
          createdBySupabaseUserId: user.id,
        },
      });

      return timelineTx.projectTimeline.findUniqueOrThrow({
        where: { id: timeline.id },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
          },
        },
      });
    })
    .catch((error: unknown) => {
      if (isMissingTimelineTableError(error)) {
        return null;
      }

      throw error;
    });

  if (!createdTimeline) {
    return NextResponse.json(
      {
        error:
          "Timeline tables are not available yet. Run the project timeline Prisma migration before creating timelines.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { data: toTimelineRecord(createdTimeline) },
    { status: 201 },
  );
}