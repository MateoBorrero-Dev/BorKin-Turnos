import argon2 from "argon2";
import { prisma } from "../config/prisma.js";
import type { PermissionEffect } from "../generated/prisma/client.js";
import { ApiError } from "../utils/api-error.js";

const userInclude = {
  role: true,
  permissions: { include: { permission: true } },
} as const;

export async function listUsers(businessId: string) {
  return prisma.user.findMany({
    where: { businessId, deletedAt: null },
    include: userInclude,
    orderBy: [{ active: "desc" }, { firstName: "asc" }, { lastName: "asc" }],
  }).then((users) => users.map(({ passwordHash: _passwordHash, ...user }) => user));
}

type CreateInput = {
  username: string; email: string; firstName: string; lastName: string; password: string; roleId: string;
  permissionOverrides: Array<{ permissionId: string; effect: PermissionEffect }>;
};

export async function createUser(businessId: string, actorId: string, input: CreateInput) {
  const role = await prisma.role.findFirst({ where: { id: input.roleId, businessId } });
  if (!role) throw new ApiError(400, "El rol seleccionado no es válido.", "INVALID_ROLE");
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        businessId, roleId: input.roleId, username: input.username.toLowerCase(), email: input.email.toLowerCase(),
        firstName: input.firstName, lastName: input.lastName, passwordHash,
        permissions: { create: input.permissionOverrides },
      },
      include: userInclude,
    });
    await tx.auditLog.create({ data: { businessId, userId: actorId, action: "USER_CREATED", entity: "User", entityId: created.id } });
    return created;
  });
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

type UpdateInput = {
  email?: string; firstName?: string; lastName?: string; roleId?: string; active?: boolean;
  permissionOverrides?: Array<{ permissionId: string; effect: PermissionEffect }>;
};

export async function updateUser(businessId: string, actorId: string, targetId: string, input: UpdateInput) {
  const target = await prisma.user.findFirst({ where: { id: targetId, businessId, deletedAt: null } });
  if (!target) throw new ApiError(404, "Usuario no encontrado.", "USER_NOT_FOUND");
  if (actorId === targetId && input.active === false) throw new ApiError(400, "No podés desactivar tu propio usuario.", "SELF_DEACTIVATION");
  if (input.roleId && !(await prisma.role.findFirst({ where: { id: input.roleId, businessId } }))) {
    throw new ApiError(400, "El rol seleccionado no es válido.", "INVALID_ROLE");
  }
  const user = await prisma.$transaction(async (tx) => {
    if (input.permissionOverrides) {
      await tx.userPermission.deleteMany({ where: { userId: targetId } });
      if (input.permissionOverrides.length) await tx.userPermission.createMany({ data: input.permissionOverrides.map((item) => ({ userId: targetId, ...item })) });
    }
    const updated = await tx.user.update({
      where: { id: targetId },
      data: {
        ...(input.email ? { email: input.email.toLowerCase() } : {}),
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.lastName ? { lastName: input.lastName } : {}),
        ...(input.roleId ? { roleId: input.roleId } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      include: userInclude,
    });
    await tx.auditLog.create({ data: { businessId, userId: actorId, action: "USER_UPDATED", entity: "User", entityId: targetId, metadata: { fields: Object.keys(input) } } });
    return updated;
  });
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export async function resetPassword(businessId: string, actorId: string, targetId: string, password: string) {
  const target = await prisma.user.findFirst({ where: { id: targetId, businessId, deletedAt: null } });
  if (!target) throw new ApiError(404, "Usuario no encontrado.", "USER_NOT_FOUND");
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.$transaction([
    prisma.user.update({ where: { id: targetId }, data: { passwordHash } }),
    prisma.refreshSession.updateMany({ where: { userId: targetId, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.auditLog.create({ data: { businessId, userId: actorId, action: "USER_PASSWORD_RESET", entity: "User", entityId: targetId } }),
  ]);
}

export async function listRoles(businessId: string) {
  return prisma.role.findMany({
    where: { businessId },
    include: { permissions: { include: { permission: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listPermissions() {
  return prisma.permission.findMany({ orderBy: { code: "asc" } });
}
