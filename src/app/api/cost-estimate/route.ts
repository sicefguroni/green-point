import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/cost-estimate - Calculate cost estimate for a greening intervention
 * Query parameters:
 *   - interventionType: Type of intervention (e.g., "Urban canopy enhancement", "Rain garden installation")
 *   - area: Area in square meters (optional)
 *   - barangayId: Barangay ID for location-based pricing (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const interventionType = request.nextUrl.searchParams.get('interventionType');
    const area = request.nextUrl.searchParams.get('area');
    const barangayId = request.nextUrl.searchParams.get('barangayId');

    if (!interventionType) {
      return NextResponse.json(
        { success: false, error: 'interventionType is required' },
        { status: 400 }
      );
    }

    // Cost estimation based on intervention type
    const costEstimates: Record<string, { basePrice: number; unit: string; perUnit: string }> = {
      'urban canopy enhancement': {
        basePrice: 5000,
        unit: 'PHP',
        perUnit: 'per tree'
      },
      'rain garden installation': {
        basePrice: 15000,
        unit: 'PHP',
        perUnit: 'per installation'
      },
      'green corridor development': {
        basePrice: 50000,
        unit: 'PHP',
        perUnit: 'per 100m corridor'
      },
      'rooftop garden installation': {
        basePrice: 3000,
        unit: 'PHP',
        perUnit: 'per square meter'
      },
      'permeable pavement': {
        basePrice: 2500,
        unit: 'PHP',
        perUnit: 'per square meter'
      },
      'green wall installation': {
        basePrice: 8000,
        unit: 'PHP',
        perUnit: 'per square meter'
      },
      'wetland restoration': {
        basePrice: 20000,
        unit: 'PHP',
        perUnit: 'per hectare'
      },
    };

    // Get base estimate
    const interventionKey = interventionType.toLowerCase();
    const estimate = costEstimates[interventionKey] || {
      basePrice: 10000,
      unit: 'PHP',
      perUnit: 'per project'
    };

    // Calculate total cost if area is provided
    let totalCost = estimate.basePrice;
    if (area) {
      const areaValue = parseFloat(area);
      if (!isNaN(areaValue)) {
        totalCost = estimate.basePrice * areaValue;
      }
    }

    // Location-based multiplier (could be enhanced with actual barangay data)
    let locationMultiplier = 1;
    if (barangayId) {
      // Example multipliers - could be fetched from database
      const locationMultipliers: Record<string, number> = {
        'barangay1': 0.9, // 10% cheaper in some areas
        'barangay2': 1.1, // 10% more expensive in others
      };
      locationMultiplier = locationMultipliers[barangayId] || 1;
    }

    totalCost = totalCost * locationMultiplier;

    return NextResponse.json({
      success: true,
      data: {
        interventionType,
        basePrice: estimate.basePrice,
        totalEstimate: Math.round(totalCost),
        currencyUnit: estimate.unit,
        perUnit: estimate.perUnit,
        area: area ? parseFloat(area) : null,
        locationMultiplier,
        breakdown: {
          materials: Math.round(totalCost * 0.5),
          labor: Math.round(totalCost * 0.35),
          contingency: Math.round(totalCost * 0.15),
        }
      }
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
      area,
      barangayId,
      customization,
    } = body;

    if (!interventionType) {
      return NextResponse.json(
        { success: false, error: 'interventionType is required' },
        { status: 400 }
      );
    }

    // Use GET logic to calculate base estimate
    const params = new URLSearchParams({
      interventionType,
      ...(area && { area: area.toString() }),
      ...(barangayId && { barangayId }),
    });

    const getRequest = new NextRequest(
      `${request.nextUrl.origin}/api/cost-estimate?${params}`,
      { method: 'GET' }
    );

    const response = await GET(getRequest);
    const result = await response.json();

    if (!result.success) {
      return response;
    }

    // Apply customization multiplier if provided
    if (customization?.additionalServices) {
      const additionalCost = customization.additionalServices.reduce(
        (sum: number, service: any) => sum + (service.cost || 0),
        0
      );
      result.data.totalEstimate += additionalCost;
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
