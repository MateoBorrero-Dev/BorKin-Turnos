import type { NextFunction, Request, Response } from "express";
import { getSessionUser } from "../services/permission.service.js";
import { ApiError } from "../utils/api-error.js";
import { verifyAccessToken } from "../utils/tokens.js";

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new ApiError(401, "Debes iniciar sesión.", "AUTH_REQUIRED");
  try {
    const payload = await verifyAccessToken(authorization.slice(7));
    req.auth = await getSessionUser(payload.sub, payload.businessId);
    next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "La sesión expiró o no es válida.", "INVALID_ACCESS_TOKEN");
  }
}

export function requirePermission(code: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw new ApiError(401, "Debes iniciar sesión.", "AUTH_REQUIRED");
    if (!req.auth.permissions.includes(code)) throw new ApiError(403, "No tenés permiso para realizar esta acción.", "FORBIDDEN");
    next();
  };
}
