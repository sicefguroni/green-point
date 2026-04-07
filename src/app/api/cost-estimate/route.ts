import { NextRequest, NextResponse } from "next/server";

import { buildGroundedCostEstimate } from "@/lib/cost-grounding";
import {
  getCostEstimateCoherenceError,
  parseGroundedCostEstimateBody,
  parseGroundedCostEstimateQuery,
} from "@/lib/cost-estimate-validation";
import type { CostEstimate } from "@/types/green_solutions";

type AdditionalService = {
  label?: string;
  cost?: number;
};

function parseOptionalNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function applyAdditionalServices(
  estimate: CostEstimate,
  additionalServices: AdditionalService[] | undefined,
): CostEstimate {
  if (!additionalServices || additionalServices.length === 0) {
    return estimate;
  }

  const extraCost = additionalServices.reduce((sum, service) => {
    const cost = Number(service.cost ?? 0);
    return Number.isFinite(cost) ? sum + cost : sum;
  }, 0);

  if (extraCost <= 0) {
    return estimate;
  }

  return {
    ...estimate,
    totalEstimate: estimate.totalEstimate + extraCost,
    breakdown: {
      ...estimate.breakdown,
      other: (estimate.breakdown.other ?? 0) + extraCost,
    },
    lineItems: [
      ...(estimate.lineItems ?? []),
      {
        category: "other",
        label: "Additional services",
        estimatedCost: extraCost,
        rationale:
          "User-specified scope additions applied on top of the planning baseline.",
        sourceStudy: null,
      },
    ],
  };
}

export async function GET(request: NextRequest) {
  try {
    const parsedQuery = parseGroundedCostEstimateQuery(request.nextUrl.searchParams);
    if (!parsedQuery.success) {
      return NextResponse.json(
        { success: false, error: parsedQuery.error },
        { status: 400 },
      );
    }

    const estimate = await buildGroundedCostEstimate({
      interventionType: parsedQuery.data.interventionType,
      solutionTitle: parsedQuery.data.solutionTitle,
      solutionDescription: parsedQuery.data.solutionDescription,
      rationale: parsedQuery.data.rationale,
      sourceStudy: parsedQuery.data.sourceStudy,
      area: parsedQuery.data.area,
      barangay: parsedQuery.data.location?.barangay,
      barangayId: parsedQuery.data.barangayId,
      locationName: parsedQuery.data.location?.name,
      metrics: parsedQuery.data.metrics,
    });

    const coherenceError = getCostEstimateCoherenceError(estimate);
    if (coherenceError) {
      return NextResponse.json(
        { success: false, error: coherenceError },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, data: estimate });
  } catch (error) {
    console.error("Error calculating grounded cost estimate:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate cost estimate" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsedBody = parseGroundedCostEstimateBody(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 },
      );
    }

    const estimate = await buildGroundedCostEstimate({
      interventionType: parsedBody.data.interventionType,
      solutionTitle: parsedBody.data.solutionTitle,
      solutionDescription: parsedBody.data.solutionDescription,
      rationale: parsedBody.data.rationale,
      sourceStudy: parsedBody.data.sourceStudy,
      area: parsedBody.data.area,
      barangay: parsedBody.data.location?.barangay,
      barangayId: parsedBody.data.barangayId,
      locationName: parsedBody.data.location?.name,
      metrics: parsedBody.data.metrics,
    });

    const result = applyAdditionalServices(
      estimate,
      parsedBody.data.customization?.additionalServices,
    );
    const coherenceError = getCostEstimateCoherenceError(result);
    if (coherenceError) {
      return NextResponse.json(
        { success: false, error: coherenceError },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error creating grounded cost estimate:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create cost estimate" },
      { status: 500 },
    );
  }
}