import { DateTime } from "luxon";
import { prisma } from "../config/prisma.js";
import type { ScheduleBlockReason } from "../generated/prisma/client.js";
import { ApiError } from "../utils/api-error.js";

type Input = { type: "INTERVAL"; employeeId: string; date: string; startTime: string; endTime: string; reason: ScheduleBlockReason; customReason?: string | null } | { type: "FULL_DAY"; employeeId: string; date: string; reason: ScheduleBlockReason; customReason?: string | null } | { type: "DATE_RANGE"; employeeId: string; startDate: string; endDate: string; reason: ScheduleBlockReason; customReason?: string | null };

async function context(businessId: string, employeeId: string) {
  const [business, employee] = await Promise.all([prisma.business.findUnique({ where: { id: businessId } }), prisma.employee.findFirst({ where: { id: employeeId, businessId, deletedAt: null } })]);
  if (!employee) throw new ApiError(404, "Profesional no encontrado.", "EMPLOYEE_NOT_FOUND");
  if (!business) throw new ApiError(404, "Negocio no encontrado.");
  return business.timezone;
}

function dates(input: Input, zone: string) {
  let start: DateTime; let end: DateTime; let allDay = false;
  if (input.type === "INTERVAL") { start = DateTime.fromISO(`${input.date}T${input.startTime}`, { zone }); end = DateTime.fromISO(`${input.date}T${input.endTime}`, { zone }); }
  else if (input.type === "FULL_DAY") { start = DateTime.fromISO(input.date, { zone }).startOf("day"); end = start.plus({ days: 1 }); allDay = true; }
  else { start = DateTime.fromISO(input.startDate, { zone }).startOf("day"); end = DateTime.fromISO(input.endDate, { zone }).startOf("day").plus({ days: 1 }); allDay = true; }
  if (!start.isValid || !end.isValid || start >= end) throw new ApiError(400, "El rango de fechas u horas no es válido.", "INVALID_BLOCK_RANGE");
  return { startAt: start.toJSDate(), endAt: end.toJSDate(), allDay };
}

export async function listBlocks(businessId: string, employeeId?: string) { if (employeeId) await context(businessId, employeeId); return prisma.scheduleBlock.findMany({ where: { businessId, deletedAt: null, active: true, ...(employeeId ? { employeeId } : {}) }, include: { employee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { startAt: "asc" } }); }

export async function createBlock(businessId: string, userId: string, input: Input) {
  const zone = await context(businessId, input.employeeId); const range = dates(input, zone);
  return prisma.$transaction(async (tx) => {
    const created = await tx.scheduleBlock.create({ data: { businessId, employeeId: input.employeeId, reason: input.reason, customReason: input.customReason ?? null, ...range } });
    await tx.auditLog.create({ data: { businessId, userId, action: "SCHEDULE_BLOCK_CREATED", entity: "ScheduleBlock", entityId: created.id, metadata: { type: input.type } } });
    return created;
  });
}

export async function updateBlock(businessId: string, userId: string, id: string, input: Input) {
  const current = await prisma.scheduleBlock.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!current) throw new ApiError(404, "Bloqueo no encontrado.", "BLOCK_NOT_FOUND");
  const zone = await context(businessId, input.employeeId); const range = dates(input, zone);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.scheduleBlock.update({ where: { id }, data: { employeeId: input.employeeId, reason: input.reason, customReason: input.customReason ?? null, ...range } });
    await tx.auditLog.create({ data: { businessId, userId, action: "SCHEDULE_BLOCK_UPDATED", entity: "ScheduleBlock", entityId: id, metadata: { type: input.type } } });
    return updated;
  });
}

export async function deleteBlock(businessId: string, userId: string, id: string) {
  const current = await prisma.scheduleBlock.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!current) throw new ApiError(404, "Bloqueo no encontrado.", "BLOCK_NOT_FOUND");
  await prisma.$transaction([prisma.scheduleBlock.update({ where: { id }, data: { active: false, deletedAt: new Date() } }), prisma.auditLog.create({ data: { businessId, userId, action: "SCHEDULE_BLOCK_DELETED", entity: "ScheduleBlock", entityId: id } })]);
}
