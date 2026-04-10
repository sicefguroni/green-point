import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

type SignupResponse = {
  success: boolean;
  data: {
    user: {
      id: string;
      username: string;
      email: string;
      role: string;
      status: string;
    };
    planner?: unknown;
    resident?: unknown;
    idVerification?: {
      verificationID: string;
      status: string;
      submittedAt: Date;
      message: string;
    };
  };
};

type PrismaKnownError = { code?: string; meta?: { target?: string[] } };


/**
 * POST /api/auth/signup
 * 
 * Body:
 * {
 *   username: string,
 *   email: string,
 *   password: string,
 *   role: "RESIDENT" | "CITY_PLANNER" | "ADMIN",
 *   // For planners:
 *   department?: string,
 *   city?: string,
 *   idNumber?: string,
 *   idType?: string,
 *   documentPath?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      username,
      email,
      password,
      role = 'RESIDENT',
      department,
      city,
      idNumber,
      idType,
      documentPath,
    } = body;

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: username, email, password' },
        { status: 400 }
      );
    }

    if (role === 'CITY_PLANNER' && (!idNumber || !idType)) {
      return NextResponse.json(
        { success: false, error: 'City planners must provide idNumber and idType' },
        { status: 400 }
      );
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password, // Note: Hash password in production!
        role,
        status: 'REGISTERED',
      },
    });

    const response: SignupResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
    };

    // If role is CITY_PLANNER, create planner record and ID verification
    if (role === 'CITY_PLANNER') {
      try {
        const plannerID = uuidv4();
        const verificationID = uuidv4();

        const cityPlanner = await prisma.cityPlanner.create({
          data: {
            plannerID,
            userID: user.id,
            department,
            city,
          },
        });

        // Create ID verification record (status: pending)
        const idVerification = await prisma.iDVerification.create({
          data: {
            verificationID,
            plannerID: cityPlanner.id,
            idNumber,
            idType,
            documentPath,
            documentFileName: documentPath ? documentPath.split('/').pop() : null,
            status: 'pending',
          },
        });

        response.data = {
          ...response.data,
          planner: cityPlanner,
          idVerification: {
            verificationID: idVerification.verificationID,
            status: idVerification.status,
            submittedAt: idVerification.submittedAt,
            message: 'ID verification pending. An administrator will review your submission.',
          },
        };
      } catch (error) {
        // Rollback user creation if planner setup fails
        await prisma.user.delete({ where: { id: user.id } });
        throw error;
      }
    }

    // If role is RESIDENT, create resident record
    if (role === 'RESIDENT') {
      try {
        const residentID = uuidv4();
        const resident = await prisma.resident.create({
          data: {
            residentID,
            userID: user.id,
            city,
          },
        });

        response.data = {
          ...response.data,
          resident,
        };
      } catch (error) {
        await prisma.user.delete({ where: { id: user.id } });
        throw error;
      }
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    console.error('Signup error:', error);
    const prismaError = error as PrismaKnownError;

    if (prismaError.code === 'P2002') {
      const field = prismaError.meta?.target?.[0] || 'user';
      return NextResponse.json(
        { success: false, error: `${field} already exists` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Signup failed' },
      { status: 500 }
    );
  }
}
