import { PrismaClient } from "@/prisma_app/generated/prisma";

const prisma = new PrismaClient();

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** True if this email or Supabase user id is already registered in Prisma (User or Profile). */
export async function registrantExists(
  email: string | undefined | null,
  supabaseUserId: string
): Promise<boolean> {
  if (!email) {
    const byId = await prisma.profile.findUnique({
      where: { supabaseUserId },
    });
    return !!byId;
  }

  const norm = normalizeEmail(email);

  const [user, profileByEmail, profileById] = await Promise.all([
    prisma.user.findFirst({
      where: { email: { equals: norm, mode: "insensitive" } },
    }),
    prisma.profile.findFirst({
      where: { email: { equals: norm, mode: "insensitive" } },
    }),
    prisma.profile.findUnique({
      where: { supabaseUserId },
    }),
  ]);

  return !!(user || profileByEmail || profileById);
}

/** True if email is taken in Prisma (blocks new email/password sign-up). */
export async function isEmailRegisteredInPrisma(email: string): Promise<boolean> {
  const norm = normalizeEmail(email);
  const [user, profile] = await Promise.all([
    prisma.user.findFirst({
      where: { email: { equals: norm, mode: "insensitive" } },
    }),
    prisma.profile.findFirst({
      where: { email: { equals: norm, mode: "insensitive" } },
    }),
  ]);
  return !!(user || profile);
}

/**
 * Creates or updates a minimal Profile after email sign-up, verification, or OAuth.
 * Email may be null for some providers (e.g. Facebook) until the user adds it in onboarding.
 */
export async function bootstrapProfileStub(
  supabaseUserId: string,
  email: string | null | undefined
) {
  const norm = email ? normalizeEmail(email) : null;
  await prisma.profile.upsert({
    where: { supabaseUserId },
    create: {
      supabaseUserId,
      email: norm,
      hasCompletedOnboarding: false,
    },
    update: {
      ...(norm ? { email: norm } : {}),
    },
  });
}

export async function getProfileCompletionState(supabaseUserId: string) {
  const profile = await prisma.profile.findUnique({
    where: { supabaseUserId },
  });
  return {
    profile,
    hasCompletedOnboarding: Boolean(profile?.hasCompletedOnboarding),
  };
}
