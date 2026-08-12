import type { Request, Response } from "express";
import * as clients from "../services/client.service.js";
import { ApiError } from "../utils/api-error.js";
import { clientAppointmentsQuerySchema, clientIdSchema, clientListQuerySchema, clientOptionsQuerySchema } from "../validators/client.validators.js";

function actor(req: Request) { if (!req.auth) throw new ApiError(401, "Debes iniciar sesión."); return req.auth; }
function id(req: Request) { return clientIdSchema.parse(req.params.id); }

export async function list(req: Request, res: Response) { const result = await clients.listClients(actor(req).businessId, clientListQuerySchema.parse(req.query)); res.json({ success: true, data: { items: result.data, meta: result.meta } }); }
export async function options(req: Request, res: Response) { res.json({ success: true, data: await clients.clientOptions(actor(req).businessId, clientOptionsQuerySchema.parse(req.query)) }); }
export async function get(req: Request, res: Response) { res.json({ success: true, data: await clients.getClient(actor(req).businessId, id(req)) }); }
export async function appointments(req: Request, res: Response) { res.json({ success: true, data: await clients.clientAppointments(actor(req).businessId, id(req), clientAppointmentsQuerySchema.parse(req.query)) }); }
export async function create(req: Request, res: Response) { const auth = actor(req); res.status(201).json({ success: true, data: await clients.createClient(auth.businessId, auth.id, req.body) }); }
export async function update(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await clients.updateClient(auth.businessId, auth.id, id(req), req.body) }); }
export async function disable(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await clients.disableClient(auth.businessId, auth.id, id(req)) }); }
export async function reactivate(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await clients.reactivateClient(auth.businessId, auth.id, id(req)) }); }
