import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

const accessKey = new TextEncoder().encode(env.JWT_SECRET);

export type AccessPayload = { sub: string; businessId: string };

export async function signAccessToken(payload: AccessPayload): Promise<string> {
  return new SignJWT({ businessId: payload.businessId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(accessKey);
}

export async function verifyAccessToken(token: string): Promise<AccessPayload> {
  const { payload } = await jwtVerify(token, accessKey, { algorithms: ["HS256"] });
  if (!payload.sub || typeof payload.businessId !== "string") throw new Error("Invalid access token");
  return { sub: payload.sub, businessId: payload.businessId };
}

export function newRefreshToken(): { raw: string; hash: string; familyId: string } {
  const raw = randomBytes(48).toString("base64url");
  return { raw, hash: hashRefreshToken(raw), familyId: randomUUID() };
}

export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(`${raw}.${env.JWT_REFRESH_SECRET}`).digest("hex");
}
