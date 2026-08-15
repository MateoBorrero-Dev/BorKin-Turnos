import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type { AnalyticsQuery } from "../validators/analytics.validators.js";
import { moneyString, ZERO } from "../utils/money.js";
import { previousRange, reportRange, todayRange } from "../utils/report-range.js";

type DayRow = { day: Date; amount?: Prisma.Decimal; count?: bigint };
type RankRow = { id: string; name: string; amount: Prisma.Decimal; count: bigint };
type MethodRow = RankRow & { kind: string };

const asCount = (value: bigint | number) => Number(value);
const percentChange = (current: Prisma.Decimal, previous: Prisma.Decimal) => previous.isZero() ? null : current.minus(previous).div(previous).mul(100).toFixed(1);
const countChange = (current: number, previous: number) => previous === 0 ? null : new Prisma.Decimal(current - previous).div(previous).mul(100).toFixed(1);

function appointmentSql(query: AnalyticsQuery) {
  return Prisma.sql`${query.employeeId ? Prisma.sql`AND a."employeeId" = ${query.employeeId}::uuid` : Prisma.empty} ${query.serviceId ? Prisma.sql`AND a."serviceId" = ${query.serviceId}::uuid` : Prisma.empty}`;
}

async function periodMetrics(businessId: string, range: { start: Date; end: Date }, query: AnalyticsQuery) {
  const relationFilter = { appointment: { ...(query.employeeId ? { employeeId: query.employeeId } : {}), ...(query.serviceId ? { serviceId: query.serviceId } : {}) } };
  const appointmentWhere = { businessId, startAt: { gte: range.start, lt: range.end }, ...(query.employeeId ? { employeeId: query.employeeId } : {}), ...(query.serviceId ? { serviceId: query.serviceId } : {}) };
  const [payments, appointmentGroups, uniqueClients, newClients] = await Promise.all([
    prisma.payment.aggregate({ where: { businessId, status: "REGISTRADO", createdAt: { gte: range.start, lt: range.end }, ...relationFilter }, _sum: { amount: true }, _count: true }),
    prisma.appointment.groupBy({ by: ["status"], where: appointmentWhere, _count: true }),
    prisma.appointment.findMany({ where: { ...appointmentWhere, status: "COMPLETADO" }, distinct: ["clientId"], select: { clientId: true } }),
    prisma.client.count({ where: { businessId, deletedAt: null, createdAt: { gte: range.start, lt: range.end } } }),
  ]);
  const status = Object.fromEntries(appointmentGroups.map((item) => [item.status, item._count]));
  const appointmentCount = appointmentGroups.reduce((total, item) => total + item._count, 0);
  const sales = payments._sum.amount ?? ZERO;
  const paymentCount = payments._count;
  const cancelled = status.CANCELADO ?? 0;
  const absent = status.AUSENTE ?? 0;
  return {
    sales,
    paymentCount,
    averageTicket: paymentCount ? sales.div(paymentCount) : ZERO,
    appointmentCount,
    completedCount: status.COMPLETADO ?? 0,
    clientCount: uniqueClients.length,
    newClientCount: newClients,
    cancelledCount: cancelled,
    absentCount: absent,
    cancellationRate: appointmentCount ? new Prisma.Decimal(cancelled).div(appointmentCount).mul(100) : ZERO,
  };
}

export async function dashboard(businessId: string, includeFinancial: boolean) {
  const range = await todayRange(businessId);
  const [statusGroups, appointments, nextAppointment, uniqueClients, payments] = await Promise.all([
    prisma.appointment.groupBy({ by: ["status"], where: { businessId, startAt: { gte: range.start, lt: range.end } }, _count: true }),
    prisma.appointment.findMany({ where: { businessId, startAt: { gte: range.start, lt: range.end } }, orderBy: { startAt: "asc" }, take: 20, select: { id: true, startAt: true, endAt: true, status: true, serviceName: true, client: { select: { firstName: true, lastName: true } }, employee: { select: { firstName: true, lastName: true, color: true } } } }),
    prisma.appointment.findFirst({ where: { businessId, startAt: { gte: new Date() }, status: { in: ["PENDIENTE", "CONFIRMADO"] } }, orderBy: { startAt: "asc" }, select: { id: true, startAt: true, status: true, serviceName: true, client: { select: { firstName: true, lastName: true } }, employee: { select: { firstName: true, lastName: true } } } }),
    prisma.appointment.findMany({ where: { businessId, status: "COMPLETADO", startAt: { gte: range.start, lt: range.end } }, distinct: ["clientId"], select: { clientId: true } }),
    includeFinancial ? prisma.payment.aggregate({ where: { businessId, status: "REGISTRADO", createdAt: { gte: range.start, lt: range.end } }, _sum: { amount: true }, _count: true }) : Promise.resolve(null),
  ]);
  const statuses = Object.fromEntries(statusGroups.map((item) => [item.status, item._count]));
  const total = statusGroups.reduce((sum, item) => sum + item._count, 0);
  return {
    date: range.date, timezone: range.timezone, appointments, nextAppointment,
    kpis: { total, pending: statuses.PENDIENTE ?? 0, confirmed: statuses.CONFIRMADO ?? 0, inProgress: statuses.EN_CURSO ?? 0, completed: statuses.COMPLETADO ?? 0, cancelled: statuses.CANCELADO ?? 0, absent: statuses.AUSENTE ?? 0, clientsAttended: uniqueClients.length },
    ...(payments ? { financial: { sales: moneyString(payments._sum.amount ?? ZERO), paymentCount: payments._count, averageTicket: payments._count ? moneyString((payments._sum.amount ?? ZERO).div(payments._count)) : "0.00" } } : {}),
  };
}

export async function overview(businessId: string, query: AnalyticsQuery) {
  const range = await reportRange(businessId, query.from, query.to);
  const previous = previousRange(range);
  const [current, prior] = await Promise.all([periodMetrics(businessId, range, query), periodMetrics(businessId, previous, query)]);
  return {
    period: { from: range.from, to: range.to, timezone: range.timezone, previousFrom: previous.from, previousTo: previous.to },
    current: { sales: moneyString(current.sales), paymentCount: current.paymentCount, averageTicket: moneyString(current.averageTicket), appointmentCount: current.appointmentCount, completedCount: current.completedCount, clientCount: current.clientCount, newClientCount: current.newClientCount, cancelledCount: current.cancelledCount, absentCount: current.absentCount, cancellationRate: current.cancellationRate.toFixed(1) },
    previous: { sales: moneyString(prior.sales), appointmentCount: prior.appointmentCount, clientCount: prior.clientCount },
    comparison: { sales: percentChange(current.sales, prior.sales), appointments: countChange(current.appointmentCount, prior.appointmentCount), clients: countChange(current.clientCount, prior.clientCount) },
  };
}

function dateKey(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export async function timeseries(businessId: string, query: AnalyticsQuery) {
  const range = await reportRange(businessId, query.from, query.to);
  const filter = appointmentSql(query);
  const [salesRows, appointmentRows] = await Promise.all([
    prisma.$queryRaw<DayRow[]>(Prisma.sql`SELECT (p."createdAt" AT TIME ZONE ${range.timezone})::date AS day, COALESCE(SUM(p.amount), 0)::decimal AS amount, COUNT(*)::bigint AS count FROM "Payment" p JOIN "Appointment" a ON a.id = p."appointmentId" WHERE p."businessId" = ${businessId}::uuid AND p.status = 'REGISTRADO' AND p."createdAt" >= ${range.start} AND p."createdAt" < ${range.end} ${filter} GROUP BY day ORDER BY day`),
    prisma.$queryRaw<DayRow[]>(Prisma.sql`SELECT (a."startAt" AT TIME ZONE ${range.timezone})::date AS day, COUNT(*)::bigint AS count FROM "Appointment" a WHERE a."businessId" = ${businessId}::uuid AND a."startAt" >= ${range.start} AND a."startAt" < ${range.end} ${filter} GROUP BY day ORDER BY day`),
  ]);
  const sales = new Map(salesRows.map((row) => [dateKey(row.day, "UTC"), row.amount ?? ZERO]));
  const appointments = new Map(appointmentRows.map((row) => [dateKey(row.day, "UTC"), asCount(row.count ?? 0)]));
  return { timezone: range.timezone, points: range.days.map((date) => ({ date, sales: moneyString(sales.get(date) ?? ZERO), appointments: appointments.get(date) ?? 0 })) };
}

export async function rankings(businessId: string, query: AnalyticsQuery) {
  const range = await reportRange(businessId, query.from, query.to);
  const filter = appointmentSql(query);
  const where = Prisma.sql`WHERE p."businessId" = ${businessId}::uuid AND p.status = 'REGISTRADO' AND p."createdAt" >= ${range.start} AND p."createdAt" < ${range.end} ${filter}`;
  const [services, employees, methods, paymentTotal] = await Promise.all([
    prisma.$queryRaw<RankRow[]>(Prisma.sql`SELECT a."serviceId" AS id, COALESCE(MAX(s.name), MIN(a."serviceName")) AS name, SUM(p.amount)::decimal AS amount, COUNT(*)::bigint AS count FROM "Payment" p JOIN "Appointment" a ON a.id = p."appointmentId" LEFT JOIN "Service" s ON s.id = a."serviceId" ${where} GROUP BY a."serviceId" ORDER BY amount DESC LIMIT 10`),
    prisma.$queryRaw<RankRow[]>(Prisma.sql`SELECT a."employeeId" AS id, CONCAT(e."firstName", ' ', e."lastName") AS name, SUM(p.amount)::decimal AS amount, COUNT(*)::bigint AS count FROM "Payment" p JOIN "Appointment" a ON a.id = p."appointmentId" JOIN "Employee" e ON e.id = a."employeeId" ${where} GROUP BY a."employeeId", e."firstName", e."lastName" ORDER BY amount DESC LIMIT 10`),
    prisma.$queryRaw<MethodRow[]>(Prisma.sql`SELECT pm.id, pm.name, pm.kind::text AS kind, SUM(p.amount)::decimal AS amount, COUNT(*)::bigint AS count FROM "Payment" p JOIN "Appointment" a ON a.id = p."appointmentId" JOIN "PaymentMethod" pm ON pm.id = p."paymentMethodId" ${where} GROUP BY pm.id, pm.name, pm.kind ORDER BY amount DESC`),
    prisma.payment.aggregate({ where: { businessId, status: "REGISTRADO", createdAt: { gte: range.start, lt: range.end }, appointment: { ...(query.employeeId ? { employeeId: query.employeeId } : {}), ...(query.serviceId ? { serviceId: query.serviceId } : {}) } }, _sum: { amount: true } }),
  ]);
  const total = paymentTotal._sum.amount ?? ZERO;
  const rank = (row: RankRow) => ({ id: row.id, name: row.name, sales: moneyString(row.amount), count: asCount(row.count) });
  return { services: services.map(rank), employees: employees.map(rank), paymentMethods: methods.map((row) => ({ ...rank(row), kind: row.kind, percentage: total.isZero() ? "0.0" : row.amount.div(total).mul(100).toFixed(1) })) };
}

export async function analyticsOptions(businessId: string) {
  const [employees, services, paymentMethods] = await Promise.all([
    prisma.employee.findMany({ where: { businessId, active: true, deletedAt: null }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    prisma.service.findMany({ where: { businessId, active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ where: { businessId, active: true }, select: { id: true, name: true, kind: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  return { employees, services, paymentMethods };
}
