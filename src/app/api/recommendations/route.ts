import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/recommendations - Fetch greening recommendations
 * Query parameters:
 *   - barangayId: Filter by barangay
 *   - cityId: Filter by city
 *   - status: Filter by status (proposed, approved, rejected, implemented)
 *   - priority: Filter by priority (low, medium, high)
 */
export async function GET(request: NextRequest) {
  try {
    const barangayId = request.nextUrl.searchParams?.get("barangayId");
    const cityId = request.nextUrl.searchParams?.get("cityId");
    const status = request.nextUrl.searchParams?.get("status");
    const priority = request.nextUrl.searchParams?.get("priority");

    const where: Prisma.GreeningRecommendationWhereInput = {};

    if (barangayId) where.barangayID = barangayId;
    if (cityId) where.cityID = cityId;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const recommendations = await prisma.greeningRecommendation.findMany({
      where,
      include: {
        city: true,
        barangay: true,
        point: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, data: recommendations });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch recommendations" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/recommendations - Create a new recommendation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      recommendationID,
      areaID,
      cityID,
      barangayID,
      pointID,
      source,
      name,
      description,
      interventionType,
      relevancy,
      efficiency,
      equipmentNeeded,
      cost,
      costUnit,
      equity,
      priority,
    } = body;

    if (
      !recommendationID ||
      !name ||
      !description ||
      !interventionType ||
      relevancy === undefined
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const recommendation = await prisma.greeningRecommendation.create({
      data: {
        recommendationID,
        areaID,
        cityID,
        barangayID,
        pointID,
        source: source || "USER_SUGGESTION",
        name,
        description,
        interventionType,
        relevancy,
        efficiency,
        equipmentNeeded,
        cost,
        costUnit,
        equity,
        priority: priority || "MEDIUM",
        status: "PROPOSED",
      },
    });

    return NextResponse.json(
      { success: true, data: recommendation },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Error creating recommendation:", error);
    const prismaError = error as { code?: string };

    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Recommendation already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to create recommendation" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/recommendations/[id] - Update a recommendation
 */
export async function PUT(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams?.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();

    const updated = await prisma.greeningRecommendation.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Recommendation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to update recommendation" },
      { status: 500 },
    );
  }
}
