import { NextRequest, NextResponse } from "next/server";

import { buildGroundedCostEstimate } from "@/lib/cost-grounding";
import type { CostEstimate } from "@/types/green_solutions";

function parseOptionalNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function applyAdditionalServices(
  estimate: CostEstimate,
  additionalServices: Array<{ label?: string; cost?: number }> | undefined,
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
    const params = request.nextUrl.searchParams;
    const interventionType = params.get("interventionType");

    if (!interventionType) {
      return NextResponse.json(
        { success: false, error: "interventionType is required" },
        { status: 400 },
      );
    }

    const estimate = await buildGroundedCostEstimate({
      interventionType,
      solutionTitle: params.get("solutionTitle") ?? interventionType,
      solutionDescription: params.get("solutionDescription") ?? undefined,
      rationale: params.get("rationale") ?? undefined,
      sourceStudy: params.get("sourceStudy"),
      area: parseOptionalNumber(params.get("area")),
      barangay: params.get("barangay"),
      barangayId: params.get("barangayId"),
      locationName: params.get("locationName"),
      metrics: {
        ndvi: parseOptionalNumber(params.get("ndvi")),
        lst: parseOptionalNumber(params.get("lst")),
        treeCanopy: parseOptionalNumber(params.get("treeCanopy")),
        greeneryIndex: parseOptionalNumber(params.get("greeneryIndex")),
        greeneryLevel: params.get("greeneryLevel") ?? undefined,
        floodHazard: parseOptionalNumber(params.get("floodHazard")),
        stormHazard: parseOptionalNumber(params.get("stormHazard")),
        aqi: parseOptionalNumber(params.get("aqi")),
      },
    });

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
    const body = await request.json();
    const interventionType = body?.interventionType as string | undefined;

    if (!interventionType) {
      return NextResponse.json(
        { success: false, error: "interventionType is required" },
        { status: 400 },
      );
    }

    const estimate = await buildGroundedCostEstimate({
      interventionType,
      solutionTitle: body.solutionTitle,
      solutionDescription: body.solutionDescription,
      rationale: body.rationale,
      sourceStudy: body.sourceStudy,
      area: typeof body.area === "number" ? body.area : undefined,
      barangay: body.location?.barangay,
      barangayId: body.barangayId,
      locationName: body.location?.name,
      metrics: body.metrics,
    });

    return NextResponse.json({
      success: true,
      data: applyAdditionalServices(
        estimate,
        body?.customization?.additionalServices,
      ),
    });
  } catch (error) {
    console.error("Error creating grounded cost estimate:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create cost estimate" },
      { status: 500 },
    );
  }
}