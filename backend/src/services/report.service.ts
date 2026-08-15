import { DateTime } from "luxon";
import { Prisma, type AppointmentStatus, type CashMovementType } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { csv, csvFilename, type CsvValue } from "../utils/csv.js";
import { moneyString } from "../utils/money.js";
import { paginationMeta } from "../utils/pagination.js";
import { reportRange } from "../utils/report-range.js";
import type { ExportQuery, ReportQuery } from "../validators/analytics.validators.js";

const APPOINTMENT_STATUSES = ["PENDIENTE", "CONFIRMADO", "EN_CURSO", "COMPLETADO", "CANCELADO", "AUSENTE"] as const;
const MOVEMENT_TYPES = ["VENTA", "INGRESO_MANUAL", "EGRESO", "RETIRO"] as const;
const EXPORT_LIMIT = 20_000;

function appointmentStatus(value?: string): AppointmentStatus | undefined {
  if (!value) return undefined;
  if (!APPOINTMENT_STATUSES.includes(value as typeof APPOINTMENT_STATUSES[number])) throw new ApiError(400, "El estado de turno no es válido.", "INVALID_APPOINTMENT_STATUS");
  return value as AppointmentStatus;
}

function movementType(value?: string): CashMovementType | undefined {
  if (!value) return undefined;
  if (!MOVEMENT_TYPES.includes(value as typeof MOVEMENT_TYPES[number])) throw new ApiError(400, "El tipo de movimiento no es válido.", "INVALID_MOVEMENT_TYPE");
  return value as CashMovementType;
}

const name = (person: { firstName: string; lastName: string | null }) => `${person.firstName}${person.lastName ? ` ${person.lastName}` : ""}`;
const local = (date: Date, zone: string) => DateTime.fromJSDate(date, { zone }).toFormat("dd/MM/yyyy HH:mm");

async function context(businessId: string, query: ExportQuery) {
  const range = await reportRange(businessId, query.from, query.to);
  return { range, skip: "page" in query ? ((query as ReportQuery).page - 1) * (query as ReportQuery).pageSize : 0 };
}

function paymentWhere(businessId: string, query: ExportQuery, start: Date, end: Date) {
  return { businessId, status: "REGISTRADO" as const, createdAt: { gte: start, lt: end }, ...(query.paymentMethodId ? { paymentMethodId: query.paymentMethodId } : {}), appointment: { ...(query.employeeId ? { employeeId: query.employeeId } : {}), ...(query.serviceId ? { serviceId: query.serviceId } : {}) } };
}

export async function salesReport(businessId: string, query: ReportQuery) {
  const { range, skip } = await context(businessId, query);
  const where = paymentWhere(businessId, query, range.start, range.end);
  const [items, total] = await Promise.all([
    prisma.payment.findMany({ where, skip, take: query.pageSize, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, createdAt: true, amount: true, paymentMethod: { select: { id: true, name: true, kind: true } }, appointment: { select: { id: true, serviceName: true, price: true, client: { select: { firstName: true, lastName: true } }, employee: { select: { firstName: true, lastName: true } } } }, recordedBy: { select: { firstName: true, lastName: true } } } }),
    prisma.payment.count({ where }),
  ]);
  return { items: items.map((item) => ({ ...item, amount: moneyString(item.amount), originalPrice: moneyString(item.appointment.price), clientName: name(item.appointment.client), employeeName: name(item.appointment.employee), recordedByName: name(item.recordedBy) })), meta: paginationMeta(query.page, query.pageSize, total), timezone: range.timezone };
}

export async function appointmentsReport(businessId: string, query: ReportQuery) {
  const { range, skip } = await context(businessId, query);
  const status = appointmentStatus(query.status);
  const where = { businessId, startAt: { gte: range.start, lt: range.end }, ...(status ? { status } : {}), ...(query.employeeId ? { employeeId: query.employeeId } : {}), ...(query.serviceId ? { serviceId: query.serviceId } : {}) };
  const [items, total] = await Promise.all([
    prisma.appointment.findMany({ where, skip, take: query.pageSize, orderBy: [{ startAt: "desc" }, { id: "desc" }], select: { id: true, startAt: true, status: true, serviceName: true, price: true, client: { select: { firstName: true, lastName: true } }, employee: { select: { firstName: true, lastName: true } }, payments: { where: { status: "REGISTRADO" }, select: { amount: true } } } }),
    prisma.appointment.count({ where }),
  ]);
  return { items: items.map((item) => ({ ...item, price: moneyString(item.price), paidAmount: item.payments.length ? moneyString(item.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0))) : null, clientName: name(item.client), employeeName: name(item.employee) })), meta: paginationMeta(query.page, query.pageSize, total), timezone: range.timezone };
}

export async function movementsReport(businessId: string, query: ReportQuery) {
  const { range, skip } = await context(businessId, query);
  const type = movementType(query.type);
  const where = { businessId, occurredAt: { gte: range.start, lt: range.end }, ...(type ? { type } : {}), ...(query.paymentMethodId ? { paymentMethodId: query.paymentMethodId } : {}) };
  const [items, total] = await Promise.all([
    prisma.cashMovement.findMany({ where, skip, take: query.pageSize, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], select: { id: true, occurredAt: true, type: true, concept: true, amount: true, paymentMethod: { select: { name: true, kind: true } }, createdBy: { select: { firstName: true, lastName: true } }, cashRegister: { select: { id: true, openedAt: true } } } }),
    prisma.cashMovement.count({ where }),
  ]);
  return { items: items.map((item) => ({ ...item, amount: moneyString(item.amount), createdByName: name(item.createdBy) })), meta: paginationMeta(query.page, query.pageSize, total), timezone: range.timezone };
}

export async function clientsReport(businessId: string, query: ReportQuery) {
  const { range, skip } = await context(businessId, query);
  const where = { businessId, deletedAt: null, createdAt: { gte: range.start, lt: range.end } };
  const [items, total] = await Promise.all([
    prisma.client.findMany({ where, skip, take: query.pageSize, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, firstName: true, lastName: true, phone: true, email: true, createdAt: true, active: true, _count: { select: { appointments: true } }, appointments: { where: { status: "COMPLETADO" }, orderBy: { startAt: "desc" }, take: 1, select: { startAt: true } } } }),
    prisma.client.count({ where }),
  ]);
  return { items: items.map((item) => ({ ...item, clientName: name(item), appointmentCount: item._count.appointments, lastVisit: item.appointments[0]?.startAt ?? null })), meta: paginationMeta(query.page, query.pageSize, total), timezone: range.timezone };
}

type ServiceRow = { id: string; name: string; count: bigint; amount: Prisma.Decimal; average: Prisma.Decimal };
export async function servicesReport(businessId: string, query: ReportQuery) {
  const { range, skip } = await context(businessId, query);
  const employeeFilter = query.employeeId ? Prisma.sql`AND a."employeeId" = ${query.employeeId}::uuid` : Prisma.empty;
  const serviceFilter = query.serviceId ? Prisma.sql`AND a."serviceId" = ${query.serviceId}::uuid` : Prisma.empty;
  const base = Prisma.sql`FROM "Payment" p JOIN "Appointment" a ON a.id = p."appointmentId" WHERE p."businessId" = ${businessId}::uuid AND p.status = 'REGISTRADO' AND p."createdAt" >= ${range.start} AND p."createdAt" < ${range.end} ${employeeFilter} ${serviceFilter}`;
  const [items, countRows] = await Promise.all([
    prisma.$queryRaw<ServiceRow[]>(Prisma.sql`SELECT a."serviceId" AS id, COALESCE(MAX(s.name), MIN(a."serviceName")) AS name, COUNT(*)::bigint AS count, SUM(p.amount)::decimal AS amount, AVG(p.amount)::decimal AS average FROM "Payment" p JOIN "Appointment" a ON a.id = p."appointmentId" LEFT JOIN "Service" s ON s.id = a."serviceId" WHERE p."businessId" = ${businessId}::uuid AND p.status = 'REGISTRADO' AND p."createdAt" >= ${range.start} AND p."createdAt" < ${range.end} ${employeeFilter} ${serviceFilter} GROUP BY a."serviceId" ORDER BY amount DESC LIMIT ${query.pageSize} OFFSET ${skip}`),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM (SELECT a."serviceId" ${base} GROUP BY a."serviceId") grouped`),
  ]);
  const total = asNumber(countRows[0]?.count ?? 0n);
  return { items: items.map((item) => ({ id: item.id, name: item.name, count: asNumber(item.count), amount: moneyString(item.amount), average: moneyString(item.average) })), meta: paginationMeta(query.page, query.pageSize, total), timezone: range.timezone };
}

const asNumber = (value: bigint | number) => Number(value);

async function exportRows(businessId: string, kind: string, query: ExportQuery): Promise<{ headers: string[]; rows: CsvValue[][]; timezone: string }> {
  const range = await reportRange(businessId, query.from, query.to);
  if (kind === "sales") {
    const items = await prisma.payment.findMany({ where: paymentWhere(businessId, query, range.start, range.end), take: EXPORT_LIMIT + 1, orderBy: { createdAt: "asc" }, select: { createdAt: true, amount: true, paymentMethod: { select: { name: true } }, appointment: { select: { serviceName: true, price: true, client: { select: { firstName: true, lastName: true } }, employee: { select: { firstName: true, lastName: true } } } }, recordedBy: { select: { firstName: true, lastName: true } } } });
    ensureExportLimit(items.length); return { headers: ["Fecha", "Cliente", "Servicio", "Profesional", "Método", "Precio original", "Monto cobrado", "Usuario"], rows: items.map((item) => [local(item.createdAt, range.timezone), name(item.appointment.client), item.appointment.serviceName, name(item.appointment.employee), item.paymentMethod.name, { numeric: moneyString(item.appointment.price) }, { numeric: moneyString(item.amount) }, name(item.recordedBy)]), timezone: range.timezone };
  }
  if (kind === "appointments") {
    const status = appointmentStatus(query.status);
    const items = await prisma.appointment.findMany({ where: { businessId, startAt: { gte: range.start, lt: range.end }, ...(status ? { status } : {}), ...(query.employeeId ? { employeeId: query.employeeId } : {}), ...(query.serviceId ? { serviceId: query.serviceId } : {}) }, take: EXPORT_LIMIT + 1, orderBy: { startAt: "asc" }, select: { startAt: true, status: true, serviceName: true, price: true, client: { select: { firstName: true, lastName: true } }, employee: { select: { firstName: true, lastName: true } }, payments: { where: { status: "REGISTRADO" }, select: { amount: true } } } });
    ensureExportLimit(items.length); return { headers: ["Fecha", "Cliente", "Servicio", "Profesional", "Estado", "Precio histórico", "Monto cobrado"], rows: items.map((item) => [local(item.startAt, range.timezone), name(item.client), item.serviceName, name(item.employee), item.status, { numeric: moneyString(item.price) }, item.payments.length ? { numeric: moneyString(item.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0))) } : "Sin Payment"]), timezone: range.timezone };
  }
  if (kind === "movements") {
    const type = movementType(query.type);
    const items = await prisma.cashMovement.findMany({ where: { businessId, occurredAt: { gte: range.start, lt: range.end }, ...(type ? { type } : {}), ...(query.paymentMethodId ? { paymentMethodId: query.paymentMethodId } : {}) }, take: EXPORT_LIMIT + 1, orderBy: { occurredAt: "asc" }, select: { occurredAt: true, type: true, concept: true, amount: true, paymentMethod: { select: { name: true } }, createdBy: { select: { firstName: true, lastName: true } }, cashRegister: { select: { openedAt: true } } } });
    ensureExportLimit(items.length); return { headers: ["Fecha", "Tipo", "Concepto", "Método", "Usuario", "Caja abierta", "Importe"], rows: items.map((item) => [local(item.occurredAt, range.timezone), item.type, item.concept, item.paymentMethod?.name ?? "—", name(item.createdBy), local(item.cashRegister.openedAt, range.timezone), { numeric: moneyString(item.amount) }]), timezone: range.timezone };
  }
  if (kind === "clients") {
    const items = await prisma.client.findMany({ where: { businessId, deletedAt: null, createdAt: { gte: range.start, lt: range.end } }, take: EXPORT_LIMIT + 1, orderBy: { createdAt: "asc" }, select: { createdAt: true, firstName: true, lastName: true, phone: true, email: true, active: true, _count: { select: { appointments: true } }, appointments: { where: { status: "COMPLETADO" }, orderBy: { startAt: "desc" }, take: 1, select: { startAt: true } } } });
    ensureExportLimit(items.length); return { headers: ["Alta", "Cliente", "Teléfono", "Email", "Turnos", "Última visita", "Estado"], rows: items.map((item) => [local(item.createdAt, range.timezone), name(item), item.phone, item.email, item._count.appointments, item.appointments[0] ? local(item.appointments[0].startAt, range.timezone) : "—", item.active ? "Activo" : "Inactivo"]), timezone: range.timezone };
  }
  if (kind === "services") {
    const serviceFilter = query.serviceId ? Prisma.sql`AND a."serviceId" = ${query.serviceId}::uuid` : Prisma.empty;
    const employeeFilter = query.employeeId ? Prisma.sql`AND a."employeeId" = ${query.employeeId}::uuid` : Prisma.empty;
    const items = await prisma.$queryRaw<ServiceRow[]>(Prisma.sql`SELECT a."serviceId" AS id, COALESCE(MAX(s.name), MIN(a."serviceName")) AS name, COUNT(*)::bigint AS count, SUM(p.amount)::decimal AS amount, AVG(p.amount)::decimal AS average FROM "Payment" p JOIN "Appointment" a ON a.id = p."appointmentId" LEFT JOIN "Service" s ON s.id = a."serviceId" WHERE p."businessId" = ${businessId}::uuid AND p.status = 'REGISTRADO' AND p."createdAt" >= ${range.start} AND p."createdAt" < ${range.end} ${serviceFilter} ${employeeFilter} GROUP BY a."serviceId" ORDER BY amount DESC LIMIT ${EXPORT_LIMIT + 1}`);
    ensureExportLimit(items.length); return { headers: ["Servicio", "Cobros", "Ventas", "Ticket promedio"], rows: items.map((item) => [item.name, asNumber(item.count), { numeric: moneyString(item.amount) }, { numeric: moneyString(item.average) }]), timezone: range.timezone };
  }
  throw new ApiError(404, "Reporte no encontrado.", "REPORT_NOT_FOUND");
}

function ensureExportLimit(length: number) {
  if (length > EXPORT_LIMIT) throw new ApiError(413, `La exportación supera el límite de ${EXPORT_LIMIT} filas. Acotá el rango o los filtros.`, "EXPORT_TOO_LARGE");
}

export async function exportReport(businessId: string, kind: string, query: ExportQuery) {
  const data = await exportRows(businessId, kind, query);
  return { content: csv(data.headers, data.rows), filename: csvFilename(kind, query.from, query.to), timezone: data.timezone };
}
