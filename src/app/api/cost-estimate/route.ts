import { NextRequest, NextResponse } from "next/server";
import { estimateCost } from "@/lib/simulation/cost-model";

type AdditionalService = { cost?: number };
type CostEstimateRequest = {
  interventionType?: string;
  area?: number;
  barangayId?: string;
  lifecycleYears?: number;
  customization?: { additionalServices?: AdditionalService[] };
};

/**
 * Location multipliers — kept small (±20%) until we have ground-truth LGU
 * pricing data. Easy hook for a real table if one lands later.
 */
const LOCATION_MULTIPLIERS: Record<string, number> = {
  makati: 1.15,
  bgc: 1.2,
  "taguig-bgc": 1.2,
  quezon: 1.0,
  manila: 1.05,
  pasig: 1.05,
  caloocan: 0.95,
  navotas: 0.9,
};

function resolveLocationMultiplier(barangayId: string | null): number {
  if (!barangayId) return 1;
  const key = barangayId.toLowerCase().trim();
  if (LOCATION_MULTIPLIERS[key] !== undefined) return LOCATION_MULTIPLIERS[key];
  for (const [city, mult] of Object.entries(LOCATION_MULTIPLIERS)) {
    if (key.includes(city)) return mult;
  }
  return 1;
}

/**
 * GET /api/cost-estimate — Calculate a realistic cost estimate for a
 * greening intervention using the shared cost model (same numbers the
 * dashboard's Intervention Analysis table uses). Pricing is per-m² and is
 * cross-referenced against the simulation engine's coefficient bands.
 */
export async function GET(request: NextRequest) {
  try {
    const interventionType =
      request.nextUrl.searchParams?.get("interventionType");
    const area = request.nextUrl.searchParams?.get("area");
    const barangayId = request.nextUrl.searchParams?.get("barangayId");
    const lifecycleYearsParam =
      request.nextUrl.searchParams?.get("lifecycleYears");

    if (!interventionType) {
      return NextResponse.json(
        { success: false, error: "interventionType is required" },
        { status: 400 },
      );
    }

    const areaSqm =
      area !== null && area !== ""
        ? Number.isFinite(parseFloat(area))
          ? parseFloat(area)
          : null
        : null;
    const lifecycleYears =
      lifecycleYearsParam && Number.isFinite(parseInt(lifecycleYearsParam, 10))
        ? parseInt(lifecycleYearsParam, 10)
        : undefined;
    const locationMultiplier = resolveLocationMultiplier(barangayId);
    const estimate = estimateCost(
      interventionType,
      areaSqm,
      locationMultiplier,
      {
        lifecycleYears,
      },
    );

    return NextResponse.json({ success: true, data: estimate });
  } catch (error) {
    console.error("Error calculating cost estimate:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate cost estimate" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/cost-estimate — Same calculation, optionally augmented with
 * additional services (their raw PHP amounts get added to the total).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CostEstimateRequest;
    const {
      interventionType,
      area,
      barangayId,
      customization,
      lifecycleYears,
    } = body;

    if (!interventionType) {
      return NextResponse.json(
        { success: false, error: "interventionType is required" },
        { status: 400 },
      );
    }

    const areaSqm =
      typeof area === "number" && Number.isFinite(area) ? area : null;
    const locationMultiplier = resolveLocationMultiplier(barangayId ?? null);
    const base = estimateCost(interventionType, areaSqm, locationMultiplier, {
      lifecycleYears,
    });

    const extra =
      customization?.additionalServices?.reduce(
        (sum, s) => sum + (s.cost ?? 0),
        0,
      ) ?? 0;
    const extraRounded = Math.round(extra);

    // Preserve the brief's lifecycle breakdown (materials / labor /
    // maintenance) and slot any additional services into contingency so the
    // shares stay anchored to the cost-model formula.
    const augmented = {
      ...base,
      totalEstimate: base.totalEstimate + extraRounded,
      breakdown: {
        ...base.breakdown,
        contingency: base.breakdown.contingency + extraRounded,
      },
    };

    return NextResponse.json({ success: true, data: augmented });
  } catch (error) {
    console.error("Error creating cost estimate:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create cost estimate" },
      { status: 500 },
    );
  }
}
