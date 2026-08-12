import type { Request, Response } from "express";
import * as cash from "../services/cash.service.js";
import * as payments from "../services/payment.service.js";
import { ApiError } from "../utils/api-error.js";
import { cashHistoryQuerySchema, cashIdSchema, cashMovementQuerySchema } from "../validators/cash.validators.js";

function actor(req: Request) { if (!req.auth) throw new ApiError(401, "Debes iniciar sesión."); return req.auth; }
const context = (req: Request) => ({ userId: actor(req).id, ipAddress: req.ip });

export async function current(req: Request, res: Response) { res.json({ success: true, data: await cash.currentCash(actor(req).businessId) }); }
export async function open(req: Request, res: Response) { res.status(201).json({ success: true, data: await cash.openCash(actor(req).businessId, context(req), req.body) }); }
export async function close(req: Request, res: Response) { res.json({ success: true, data: await cash.closeCash(actor(req).businessId, context(req), req.body) }); }
export async function income(req: Request, res: Response) { res.status(201).json({ success: true, data: await cash.addMovement(actor(req).businessId, context(req), "INGRESO_MANUAL", req.body) }); }
export async function expense(req: Request, res: Response) { res.status(201).json({ success: true, data: await cash.addMovement(actor(req).businessId, context(req), "EGRESO", req.body) }); }
export async function withdrawal(req: Request, res: Response) { res.status(201).json({ success: true, data: await cash.addMovement(actor(req).businessId, context(req), "RETIRO", req.body) }); }
export async function history(req: Request, res: Response) { const query = cashHistoryQuerySchema.parse(req.query); res.json({ success: true, data: await cash.cashHistory(actor(req).businessId, query) }); }
export async function detail(req: Request, res: Response) { const id = cashIdSchema.parse(req.params.id); res.json({ success: true, data: await cash.cashDetail(actor(req).businessId, id) }); }
export async function movements(req: Request, res: Response) { const id = cashIdSchema.parse(req.params.id); const query = cashMovementQuerySchema.parse(req.query); res.json({ success: true, data: await cash.cashMovements(actor(req).businessId, id, query) }); }
export async function paymentMethods(req: Request, res: Response) { res.json({ success: true, data: await payments.paymentMethodOptions(actor(req).businessId) }); }
