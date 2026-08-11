import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (origin && origin !== env.FRONTEND_URL) throw new ApiError(403, "Origen no permitido.", "UNTRUSTED_ORIGIN");
  next();
}
