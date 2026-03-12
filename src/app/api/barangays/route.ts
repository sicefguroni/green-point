import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/prisma_app/generated/prisma';

const prisma = new PrismaClient();

/**
 * GET /api/barangays - Fetch all barangays
 * GET /api/barangays?cityId=xxx - Fetch barangays by city
 * GET /api/barangays/[id] - Fetch barangay details with metrics
 */
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    const cityId = request.nextUrl.searchParams.get('cityId');

    if (id) {
      const barangay = await prisma.barangay.findUnique({
        where: { id },
        include: {
          metrics: true,
          greeneryIndex: true,
          hazardExposures: true,
          points: true,
        },
      });

      if (!barangay) {
        return NextResponse.json(
          { success: false, error: 'Barangay not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: barangay });
    }

    let barangays;

    if (cityId) {
      barangays = await prisma.barangay.findMany({
        where: { cityID: cityId },
        include: {
          metrics: true,
          greeneryIndex: true,
        },
      });
    } else {
      barangays = await prisma.barangay.findMany({
        include: {
          metrics: true,
          greeneryIndex: true,
        },
      });
    }

    return NextResponse.json({ success: true, data: barangays });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch barangays' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/barangays - Create a new barangay
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barangayID, cityID, barangayName, population, area, boundary, coordinates } = body;

    if (!barangayID || !cityID || !barangayName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const barangay = await prisma.barangay.create({
      data: {
        barangayID,
        cityID,
        barangayName,
        population,
        area,
        boundary,
        coordinates,
      },
    });

    return NextResponse.json(
      { success: true, data: barangay },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Barangay already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create barangay' },
      { status: 500 }
    );
  }
}
