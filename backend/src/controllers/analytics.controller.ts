import type { Request, Response } from "express";
import * as analytics from "../services/analytics.service.js";
import * as reports from "../services/report.service.js";
import * as audit from "../services/audit.service.js";
import { ApiError } from "../utils/api-error.js";
import { analyticsQuerySchema, auditQuerySchema, exportQuerySchema, reportQuerySchema } from "../validators/analytics.validators.js";

function actor(req: Request) { if (!req.auth) throw new ApiError(401, "Debes iniciar sesión."); return req.auth; }

export async function dashboard(req: Request, res: Response) { const user = actor(req); res.json({ success: true, data: await analytics.dashboard(user.businessId, user.permissions.includes("statistics.view")) }); }
export async function overview(req: Request, res: Response) { res.json({ success: true, data: await analytics.overview(actor(req).businessId, analyticsQuerySchema.parse(req.query)) }); }
export async function timeseries(req: Request, res: Response) { res.json({ success: true, data: await analytics.timeseries(actor(req).businessId, analyticsQuerySchema.parse(req.query)) }); }
export async function rankings(req: Request, res: Response) { res.json({ success: true, data: await analytics.rankings(actor(req).businessId, analyticsQuerySchema.parse(req.query)) }); }
export async function options(req: Request, res: Response) { res.json({ success: true, data: await analytics.analyticsOptions(actor(req).businessId) }); }

const reportHandlers = { sales: reports.salesReport, appointments: reports.appointmentsReport, movements: reports.movementsReport, clients: reports.clientsReport, services: reports.servicesReport } as const;
export async function report(req: Request, res: Response) {
  const kind = String(req.params.kind) as keyof typeof reportHandlers;
  const handler = reportHandlers[kind];
  if (!handler) throw new ApiError(404, "Reporte no encontrado.", "REPORT_NOT_FOUND");
  res.json({ success: true, data: await handler(actor(req).businessId, reportQuerySchema.parse(req.query)) });
}
export async function exportCsv(req: Request, res: Response) {
  const result = await reports.exportReport(actor(req).businessId, String(req.params.kind ?? ""), exportQuerySchema.parse(req.query));
  res.status(200).set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${result.filename}"`, "Cache-Control": "private, no-store", "X-Report-Timezone": result.timezone }).send(result.content);
}
export async function auditList(req: Request, res: Response) { res.json({ success: true, data: await audit.auditLogs(actor(req).businessId, auditQuerySchema.parse(req.query)) }); }
export async function auditOptions(req: Request, res: Response) { res.json({ success: true, data: await audit.auditOptions(actor(req).businessId) }); }
