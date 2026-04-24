import { prisma } from "@/lib/prisma";


export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function registrantExists(
  email: string | undefined | null,
  supabaseUserId: string,
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

export async function isEmailRegisteredInPrisma(
  email: string,
): Promise<boolean> {
  const norm = normalizeEmail(email);
  const profile = await prisma.profile.findFirst({
    where: { email: { equals: norm, mode: "insensitive" } },
  });

  return !!profile;
}

export async function bootstrapProfileStub(
  supabaseUserId: string,
  email: string | null | undefined,
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
