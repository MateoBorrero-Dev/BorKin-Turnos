import { prisma } from "../config/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { paginationMeta } from "../utils/pagination.js";
import { reportRange } from "../utils/report-range.js";
import type { AuditQuery } from "../validators/analytics.validators.js";

const SENSITIVE_KEY = /(password|token|secret|authorization|cookie|hash|credential|jwt)/i;

export function sanitizeAuditMetadata(value: Prisma.JsonValue): Prisma.JsonValue {
  if (Array.isArray(value)) return value.map(sanitizeAuditMetadata);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? "[PROTEGIDO]" : item === undefined ? null : sanitizeAuditMetadata(item)]));
  return value;
}

export async function auditLogs(businessId: string, query: AuditQuery) {
  const range = await reportRange(businessId, query.from, query.to);
  const where = { businessId, createdAt: { gte: range.start, lt: range.end }, ...(query.userId ? { userId: query.userId } : {}), ...(query.action ? { action: query.action } : {}), ...(query.entity ? { entity: query.entity } : {}) };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  return { items: items.map((item) => ({ ...item, metadata: item.metadata === null ? null : sanitizeAuditMetadata(item.metadata) })), meta: paginationMeta(query.page, query.pageSize, total), timezone: range.timezone };
}

export async function auditOptions(businessId: string) {
  const [users, actions, entities] = await Promise.all([
    prisma.user.findMany({ where: { businessId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, username: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    prisma.auditLog.findMany({ where: { businessId }, distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({ where: { businessId }, distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);
  return { users, actions: actions.map((item) => item.action), entities: entities.map((item) => item.entity) };
}
