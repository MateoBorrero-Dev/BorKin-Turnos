import type { Request, Response } from "express";
import * as appointments from "../services/appointment.service.js";
import { ApiError } from "../utils/api-error.js";
import { appointmentAvailabilityQuerySchema, appointmentIdSchema, appointmentListQuerySchema, appointmentOptionsQuerySchema } from "../validators/appointment.validators.js";

function actor(req: Request) { if (!req.auth) throw new ApiError(401, "Debes iniciar sesión."); return req.auth; }
function id(req: Request) { return appointmentIdSchema.parse(req.params.id); }

export async function list(req: Request, res: Response) { const auth = actor(req); const query = appointmentListQuerySchema.parse(req.query); res.json({ success: true, data: await appointments.listAppointments(auth.businessId, query.from, query.to, query.employeeId) }); }
export async function get(req: Request, res: Response) { res.json({ success: true, data: await appointments.getAppointment(actor(req).businessId, id(req)) }); }
export async function options(req: Request, res: Response) { const query = appointmentOptionsQuerySchema.parse(req.query); res.json({ success: true, data: await appointments.appointmentOptions(actor(req).businessId, query.serviceId) }); }
export async function availability(req: Request, res: Response) { const query = appointmentAvailabilityQuerySchema.parse(req.query); res.json({ success: true, data: await appointments.availability(actor(req).businessId, query.serviceId, query.employeeId, query.date) }); }
export async function create(req: Request, res: Response) { const auth = actor(req); res.status(201).json({ success: true, data: await appointments.createAppointment(auth.businessId, auth.id, req.body) }); }
export async function update(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await appointments.updateAppointment(auth.businessId, auth.id, id(req), req.body) }); }
export async function reschedule(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await appointments.updateAppointment(auth.businessId, auth.id, id(req), req.body) }); }
export async function confirm(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await appointments.transitionAppointment(auth.businessId, auth.id, id(req), "CONFIRMADO") }); }
export async function start(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await appointments.transitionAppointment(auth.businessId, auth.id, id(req), "EN_CURSO") }); }
export async function complete(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await appointments.transitionAppointment(auth.businessId, auth.id, id(req), "COMPLETADO") }); }
export async function cancel(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await appointments.transitionAppointment(auth.businessId, auth.id, id(req), "CANCELADO", req.body.reason) }); }
export async function noShow(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await appointments.transitionAppointment(auth.businessId, auth.id, id(req), "AUSENTE", req.body.reason) }); }
