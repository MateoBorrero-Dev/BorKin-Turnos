import type { Request, Response } from "express";
import * as userService from "../services/user.service.js";
import { ApiError } from "../utils/api-error.js";

function auth(req: Request) {
  if (!req.auth) throw new ApiError(401, "Debes iniciar sesión.");
  return req.auth;
}

function routeId(req: Request) {
  const value = req.params.id;
  if (typeof value !== "string") throw new ApiError(400, "Identificador inválido.", "INVALID_ID");
  return value;
}

export async function list(req: Request, res: Response) {
  res.json({ success: true, data: await userService.listUsers(auth(req).businessId) });
}

export async function create(req: Request, res: Response) {
  const actor = auth(req);
  res.status(201).json({ success: true, data: await userService.createUser(actor.businessId, actor.id, req.body) });
}

export async function update(req: Request, res: Response) {
  const actor = auth(req);
  res.json({ success: true, data: await userService.updateUser(actor.businessId, actor.id, routeId(req), req.body) });
}

export async function resetPassword(req: Request, res: Response) {
  const actor = auth(req);
  await userService.resetPassword(actor.businessId, actor.id, routeId(req), req.body.password);
  res.status(204).send();
}

export async function roles(req: Request, res: Response) {
  res.json({ success: true, data: await userService.listRoles(auth(req).businessId) });
}

export async function permissions(_req: Request, res: Response) {
  res.json({ success: true, data: await userService.listPermissions() });
}
