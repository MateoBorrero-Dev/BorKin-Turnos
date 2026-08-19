import argon2 from "argon2";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { getSessionUser } from "./permission.service.js";
import { ApiError } from "../utils/api-error.js";
import { hashRefreshToken, newRefreshToken, signAccessToken } from "../utils/tokens.js";

export type RequestMetadata = { userAgent?: string; ipAddress?: string };

function sessionMetadata(metadata: RequestMetadata) {
  return {
    ...(metadata.userAgent ? { userAgent: metadata.userAgent.slice(0, 500) } : {}),
    ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress.slice(0, 100) } : {}),
  };
}

async function createSession(userId: string, metadata: RequestMetadata, familyId?: string) {
  const token = newRefreshToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000);
  await prisma.refreshSession.create({
    data: { userId, tokenHash: token.hash, familyId: familyId ?? token.familyId, expiresAt, ...sessionMetadata(metadata) },
  });
  const user = await getSessionUser(userId);
  return { accessToken: await signAccessToken({ sub: user.id, businessId: user.businessId }), refreshToken: token.raw, refreshExpiresAt: expiresAt, user };
}

export async function login(identifier: string, password: string, metadata: RequestMetadata) {
  const normalized = identifier.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { active: true, deletedAt: null, OR: [{ username: { equals: normalized, mode: "insensitive" } }, { email: { equals: normalized, mode: "insensitive" } }] },
  });
  if (!user || !(await argon2.verify(user.passwordHash, password))) {
    throw new ApiError(401, "Usuario o contraseña incorrectos.", "INVALID_CREDENTIALS");
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    prisma.auditLog.create({
      data: {
        businessId: user.businessId,
        userId: user.id,
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
        ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress.slice(0, 100) } : {}),
        ...(metadata.userAgent ? { metadata: { userAgent: metadata.userAgent.slice(0, 500) } } : {}),
      },
    }),
  ]);
  return createSession(user.id, metadata);
}

export async function refresh(rawToken: string | undefined, metadata: RequestMetadata) {
  if (!rawToken) throw new ApiError(401, "La sesión no es válida.", "INVALID_REFRESH_TOKEN");
  const tokenHash = hashRefreshToken(rawToken);
  const nextToken = newRefreshToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000);

  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "RefreshSession"
      WHERE "tokenHash" = ${tokenHash}
      FOR UPDATE
    `;
    if (!locked.length) return { kind: "invalid" } as const;
    const current = await tx.refreshSession.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!current) return { kind: "invalid" } as const;
    if (current.revokedAt) {
      await tx.refreshSession.updateMany({ where: { familyId: current.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      return { kind: "reused" } as const;
    }
    if (current.expiresAt <= new Date() || !current.user.active || current.user.deletedAt) {
      await tx.refreshSession.updateMany({ where: { familyId: current.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      return { kind: "expired" } as const;
    }
    await tx.refreshSession.update({ where: { id: current.id }, data: { revokedAt: new Date(), lastUsedAt: new Date() } });
    await tx.refreshSession.create({
      data: { userId: current.userId, tokenHash: nextToken.hash, familyId: current.familyId, expiresAt, ...sessionMetadata(metadata) },
    });
    return { kind: "rotated", userId: current.userId } as const;
  });

  if (result.kind === "invalid") throw new ApiError(401, "La sesión no es válida.", "INVALID_REFRESH_TOKEN");
  if (result.kind === "reused") throw new ApiError(401, "La sesión fue revocada por seguridad.", "REFRESH_REUSE_DETECTED");
  if (result.kind === "expired") throw new ApiError(401, "La sesión expiró.", "REFRESH_EXPIRED");
  const user = await getSessionUser(result.userId);
  return { accessToken: await signAccessToken({ sub: user.id, businessId: user.businessId }), refreshToken: nextToken.raw, refreshExpiresAt: expiresAt, user };
}

export async function logout(rawToken: string | undefined) {
  if (rawToken) await prisma.refreshSession.updateMany({ where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
}
