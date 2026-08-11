import type { Request, Response } from "express";
import { env } from "../config/env.js";
import * as authService from "../services/auth.service.js";

const REFRESH_COOKIE = "borkin_refresh";

function metadata(req: Request): authService.RequestMetadata {
  const userAgent = req.get("user-agent");
  return {
    ...(userAgent ? { userAgent } : {}),
    ...(req.ip ? { ipAddress: req.ip } : {}),
  };
}

function setRefreshCookie(res: Response, token: string, expires: Date) {
  res.cookie(REFRESH_COOKIE, token, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax", path: "/api/auth", expires });
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body.identifier, req.body.password, metadata(req));
  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } });
}

export async function refresh(req: Request, res: Response) {
  const result = await authService.refresh(req.cookies[REFRESH_COOKIE], metadata(req));
  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax", path: "/api/auth" });
  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  res.json({ success: true, data: req.auth });
}
