import { prisma } from "../config/prisma.js";
import type { SessionUser } from "../types/auth.js";
import { ApiError } from "../utils/api-error.js";

export async function getSessionUser(userId: string, expectedBusinessId?: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      business: true,
      role: { include: { permissions: { include: { permission: true } } } },
      permissions: { include: { permission: true } },
    },
  });
  if (!user || !user.active || user.deletedAt || (expectedBusinessId && user.businessId !== expectedBusinessId)) {
    throw new ApiError(401, "La sesión no es válida.", "INVALID_SESSION");
  }

  const effective = new Set(user.role.permissions.map((entry) => entry.permission.code));
  for (const entry of user.permissions) {
    if (entry.effect === "ALLOW") effective.add(entry.permission.code);
    else effective.delete(entry.permission.code);
  }

  return {
    id: user.id,
    businessId: user.businessId,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: { id: user.role.id, code: user.role.code, name: user.role.name },
    permissions: [...effective].sort(),
    business: {
      id: user.business.id,
      name: user.business.name,
      locale: user.business.locale,
      currency: user.business.currency,
      timezone: user.business.timezone,
      primaryColor: user.business.primaryColor,
    },
  };
}
