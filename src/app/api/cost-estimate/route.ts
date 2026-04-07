import { NextRequest, NextResponse } from "next/server";
import {
  estimateInterventionCost,
  type CostEstimationScope,
} from "@/lib/cost-estimation";

function parseNumber(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseScope(value: string | null): CostEstimationScope | null {
  if (value === "project" || value === "site" || value === "barangay") {
    return value;
  }
  return null;
}

/**
 * GET /api/cost-estimate - Calculate cost estimate for a greening intervention.
 * Query parameters:
 *   - interventionType: required, any supported or aliased intervention label
 *   - solutionTitle: optional human-readable recommendation title
 *   - solutionDescription: optional short description used for model inference
 *   - area: optional site area in square meters
 *   - scope: optional project/site/barangay scope hint
 *   - greeneryIndex: optional 0-1 site greenness signal
 *   - floodHazard: optional 0-3 hazard level
 *   - stormHazard: optional 0-3 hazard level
 *   - lifecycleYears: optional planning horizon
 */
export async function GET(request: NextRequest) {
  try {
    const interventionType = request.nextUrl.searchParams.get('interventionType');
    const solutionTitle = request.nextUrl.searchParams.get('solutionTitle');
    const solutionDescription = request.nextUrl.searchParams.get('solutionDescription');
    const area = parseNumber(request.nextUrl.searchParams.get('area'));
    const barangayId = request.nextUrl.searchParams.get('barangayId');
    const scope = parseScope(request.nextUrl.searchParams.get('scope'));
    const greeneryIndex = parseNumber(request.nextUrl.searchParams.get('greeneryIndex'));
    const floodHazard = parseNumber(request.nextUrl.searchParams.get('floodHazard'));
    const stormHazard = parseNumber(request.nextUrl.searchParams.get('stormHazard'));
    const lifecycleYears = parseNumber(request.nextUrl.searchParams.get('lifecycleYears'));

    if (!interventionType) {
      return NextResponse.json(
        { success: false, error: 'interventionType is required' },
        { status: 400 }
      );
    }

    const estimate = estimateInterventionCost({
      interventionType,
      solutionTitle,
      solutionDescription,
      areaSqm: area,
      barangayId,
      scope,
      greeneryIndex,
      floodHazard,
      stormHazard,
      lifecycleYears,
    });

    return NextResponse.json({
      success: true,
      data: estimate,
    });
  } catch (error: any) {
    console.error('Error calculating cost estimate:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate cost estimate' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cost-estimate - Create a detailed cost estimate with custom parameters
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      interventionType,
      solutionTitle,
      solutionDescription,
      area,
      barangayId,
      scope,
      greeneryIndex,
      floodHazard,
      stormHazard,
      lifecycleYears,
      customization,
    } = body;

    if (!interventionType) {
      return NextResponse.json(
        { success: false, error: 'interventionType is required' },
        { status: 400 }
      );
    }

    const result = {
      success: true,
      data: estimateInterventionCost({
        interventionType,
        solutionTitle: typeof solutionTitle === "string" ? solutionTitle : null,
        solutionDescription: typeof solutionDescription === "string" ? solutionDescription : null,
        areaSqm: typeof area === "number" ? area : parseNumber(area?.toString() ?? null),
        barangayId,
        scope: parseScope(typeof scope === "string" ? scope : null),
        greeneryIndex: typeof greeneryIndex === "number" ? greeneryIndex : parseNumber(greeneryIndex?.toString() ?? null),
        floodHazard: typeof floodHazard === "number" ? floodHazard : parseNumber(floodHazard?.toString() ?? null),
        stormHazard: typeof stormHazard === "number" ? stormHazard : parseNumber(stormHazard?.toString() ?? null),
        lifecycleYears: typeof lifecycleYears === "number" ? lifecycleYears : parseNumber(lifecycleYears?.toString() ?? null),
      }),
    };

    // Apply customization multiplier if provided
    if (customization?.additionalServices) {
      const additionalCost = customization.additionalServices.reduce(
        (sum: number, service: any) => sum + (service.cost || 0),
        0
      );
      result.data.totalEstimate += additionalCost;
      result.data.breakdown.contingency += additionalCost;
      result.data.assumptions.push("Additional services were added on top of the base lifecycle estimate.");
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error creating cost estimate:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create cost estimate' },
      { status: 500 }
    );
  }
}
