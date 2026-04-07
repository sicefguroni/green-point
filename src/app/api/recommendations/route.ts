import { NextRequest, NextResponse } from 'next/server';
import { getCostEstimateCoherenceError } from '@/lib/cost-estimate-validation';
import { prisma } from '@/lib/prisma';

function deriveCostFields(
  costEstimate: { totalEstimate?: unknown; currencyUnit?: unknown } | null | undefined,
  cost: unknown,
  costUnit: unknown,
) {
  const resolvedCost =
    typeof cost === 'number'
      ? cost
      : typeof costEstimate?.totalEstimate === 'number'
        ? costEstimate.totalEstimate
        : undefined;
  const resolvedCostUnit =
    typeof costUnit === 'string'
      ? costUnit
      : typeof costEstimate?.currencyUnit === 'string'
        ? costEstimate.currencyUnit
        : undefined;

  return { resolvedCost, resolvedCostUnit };
}


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
    const barangayId = request.nextUrl.searchParams.get('barangayId');
    const cityId = request.nextUrl.searchParams.get('cityId');
    const status = request.nextUrl.searchParams.get('status');
    const priority = request.nextUrl.searchParams.get('priority');

    const where: any = {};

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
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ success: true, data: recommendations });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recommendations' },
      { status: 500 }
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
      costEstimate,
      equity,
      priority,
    } = body;

    const { resolvedCost, resolvedCostUnit } = deriveCostFields(
      costEstimate,
      cost,
      costUnit,
    );

    if (costEstimate) {
      const coherenceError = getCostEstimateCoherenceError(costEstimate);
      if (coherenceError) {
        return NextResponse.json(
          { success: false, error: coherenceError },
          { status: 400 }
        );
      }
    }

    if (!recommendationID || !name || !description || !interventionType || relevancy === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const recommendation = await prisma.greeningRecommendation.create({
      data: {
        recommendationID,
        areaID,
        cityID,
        barangayID,
        pointID,
        source: source || 'USER_SUGGESTION',
        name,
        description,
        interventionType,
        relevancy,
        efficiency,
        equipmentNeeded,
        cost: resolvedCost,
        costUnit: resolvedCostUnit,
        costEstimate,
        costEstimateUpdatedAt: costEstimate ? new Date() : null,
        equity,
        priority: priority || 'MEDIUM',
        status: 'PROPOSED',
      },
    });

    return NextResponse.json(
      { success: true, data: recommendation },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating recommendation:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Recommendation already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create recommendation' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/recommendations/[id] - Update a recommendation
 */
export async function PUT(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    if (body.costEstimate) {
      const coherenceError = getCostEstimateCoherenceError(body.costEstimate);
      if (coherenceError) {
        return NextResponse.json(
          { success: false, error: coherenceError },
          { status: 400 }
        );
      }
    }

    const { resolvedCost, resolvedCostUnit } = deriveCostFields(
      body.costEstimate,
      body.cost,
      body.costUnit,
    );

    const updateData = {
      ...body,
      cost: resolvedCost ?? body.cost,
      costUnit: resolvedCostUnit ?? body.costUnit,
      costEstimateUpdatedAt:
        body.costEstimate === undefined
          ? body.costEstimateUpdatedAt
          : body.costEstimate
            ? new Date()
            : null,
    };

    const updated = await prisma.greeningRecommendation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update recommendation' },
      { status: 500 }
    );
  }
}
