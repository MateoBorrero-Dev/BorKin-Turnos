import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá una fecha válida.");
const uuid = z.string().uuid();
const optionalUuid = z.preprocess((value) => value === "" ? undefined : value, uuid.optional());

export const analyticsQuerySchema = z.object({
  from: date,
  to: date,
  employeeId: optionalUuid,
  serviceId: optionalUuid,
});

export const reportQuerySchema = analyticsQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().trim().max(30).optional(),
  paymentMethodId: optionalUuid,
  type: z.string().trim().max(30).optional(),
});

export const exportQuerySchema = reportQuerySchema.omit({ page: true, pageSize: true });

export const auditQuerySchema = z.object({
  from: date,
  to: date,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: optionalUuid,
  action: z.string().trim().max(80).optional(),
  entity: z.string().trim().max(80).optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;
