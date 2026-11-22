import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";

/**
 * GET /api/admin/id-verification
 * Fetch ID verifications. Admins only.
 *
 * Query params:
 *   - status: "pending", "approved", "rejected"
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const status = request.nextUrl.searchParams?.get("status") || "pending";

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
        submittedAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: verifications,
      count: verifications.length,
    });
  } catch (error) {
    console.error("Fetch ID verification error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch verifications" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/id-verification
 * Approve or reject an ID verification. Admins only.
 *
 * The acting admin is always the signed-in user; any admin ID sent in the
 * body is ignored.
 *
 * Body:
 * {
 *   verificationID: string,
 *   action: "approve" | "reject",
 *   rejectionReason?: string
 * }
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const admin = auth.user;

  try {
    const body = (await request.json().catch(() => null)) as {
      verificationID?: unknown;
      action?: unknown;
      rejectionReason?: unknown;
    } | null;
    const verificationID =
      typeof body?.verificationID === "string" ? body.verificationID : "";
    const action = typeof body?.action === "string" ? body.action : "";
    const rejectionReason =
      typeof body?.rejectionReason === "string"
        ? body.rejectionReason.trim().slice(0, 1000) || null
        : null;

    if (!verificationID || !action) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: verificationID, action",
        },
        { status: 400 },
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be "approve" or "reject"' },
        { status: 400 },
      );
    }

    // Find the verification
    const verification = await prisma.iDVerification.findUnique({
      where: { verificationID },
      include: { planner: true },
    });

    if (!verification) {
      return NextResponse.json(
        { success: false, error: "Verification not found" },
        { status: 404 },
      );
    }

    if (verification.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: "This verification has already been processed",
        },
        { status: 400 },
      );
    }

    // Update verification status
    const updatedVerification = await prisma.iDVerification.update({
      where: { verificationID },
      data: {
        status: action === "approve" ? "approved" : "rejected",
        verifiedBy: admin.id,
        verificationDate: new Date(),
        rejectionReason: action === "reject" ? rejectionReason : null,
      },
      include: {
        planner: {
          include: {
            // Never return the legacy password column.
            user: {
              select: { id: true, username: true, email: true, status: true },
            },
          },
        },
      },
    });

    // If approved, update user status to ACTIVE
    if (action === "approve") {
      await prisma.user.update({
        where: { id: verification.planner.userID },
        data: { status: "ACTIVE" },
      });
    }

    // SystemLog.userID references the legacy Prisma User table, so link it
    // only when the admin also has a row there. The Supabase ID is always
    // recorded in details.
    const legacyAdminUser = admin.email
      ? await prisma.user.findFirst({
          where: { email: { equals: admin.email, mode: "insensitive" } },
          select: { id: true },
        })
      : null;

    // Log the action
    await prisma.systemLog.create({
      data: {
        userID: legacyAdminUser?.id ?? null,
        action: `id_verification_${action}`,
        resource: "IDVerification",
        resourceID: verificationID,
        status: "success",
        details: {
          adminSupabaseUserId: admin.id,
          plannerID: verification.plannerID,
          idType: verification.idType,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedVerification,
      message: `ID verification ${action === "approve" ? "approved" : "rejected"}`,
    });
  } catch (error: unknown) {
    console.error("Update ID verification error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update verification",
      },
      { status: 500 },
    );
  }
}
