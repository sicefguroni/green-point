import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/prisma_app/generated/prisma';

const prisma = new PrismaClient();

/**
 * GET /api/admin/id-verification
 * Fetch all pending ID verifications
 * 
 * Query params:
 *   - status: "pending", "approved", "rejected"
 */
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status') || 'pending';

    const verifications = await prisma.iDVerification.findMany({
      where: { status },
      include: {
        planner: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: verifications,
      count: verifications.length,
    });
  } catch (error) {
    console.error('Fetch ID verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch verifications' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/id-verification
 * Approve or reject an ID verification
 * 
 * Body:
 * {
 *   verificationID: string,
 *   action: "approve" | "reject",
 *   adminUserID: string,
 *   rejectionReason?: string
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { verificationID, action, adminUserID, rejectionReason } = body;

    if (!verificationID || !action || !adminUserID) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: verificationID, action, adminUserID' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Find the verification
    const verification = await prisma.iDVerification.findUnique({
      where: { verificationID },
      include: {
        planner: {
          include: { user: true },
        },
      },
    });

    if (!verification) {
      return NextResponse.json(
        { success: false, error: 'Verification not found' },
        { status: 404 }
      );
    }

    if (verification.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'This verification has already been processed' },
        { status: 400 }
      );
    }

    // Update verification status
    const updatedVerification = await prisma.iDVerification.update({
      where: { verificationID },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        verifiedBy: adminUserID,
        verificationDate: new Date(),
        rejectionReason: action === 'reject' ? rejectionReason : null,
      },
      include: {
        planner: {
          include: {
            user: true,
          },
        },
      },
    });

    // If approved, update user status to ACTIVE
    if (action === 'approve') {
      await prisma.user.update({
        where: { id: verification.planner.userID },
        data: { status: 'ACTIVE' },
      });
    }

    // Log the action
    await prisma.systemLog.create({
      data: {
        userID: adminUserID,
        action: `id_verification_${action}`,
        resource: 'IDVerification',
        resourceID: verificationID,
        status: 'success',
        details: {
          plannerID: verification.plannerID,
          idType: verification.idType,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedVerification,
      message: `ID verification ${action === 'approve' ? 'approved' : 'rejected'}`,
    });
  } catch (error: any) {
    console.error('Update ID verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update verification' },
      { status: 500 }
    );
  }
}
