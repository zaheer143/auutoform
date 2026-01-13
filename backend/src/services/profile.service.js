import { prisma } from "../db/prisma.js";

export async function ensureDemoUser(userId) {
  // For v0 we create a demo user row. In v1 auth creates real users.
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (existing) return existing;

  return prisma.user.create({
    data: { id: userId }
  });
}

export async function getOrCreateDefaultProfile(userId) {
  await ensureDemoUser(userId);

  const existing = await prisma.profile.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" }
  });

  if (existing) return existing;

  return prisma.profile.create({
    data: {
      userId,
      label: "Default"
    }
  });
}

export async function updateDefaultProfile(userId, patch) {
  const profile = await getOrCreateDefaultProfile(userId);

  return prisma.profile.update({
    where: { id: profile.id },
    data: patch
  });
}
