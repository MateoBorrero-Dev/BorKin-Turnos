import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { paginationMeta } from "../utils/pagination.js";

export type ClientInput = Partial<{
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  notes: string | null;
  forceDuplicate: boolean;
}>;
type ListQuery = { page: number; pageSize: number; search: string; status: "all" | "active" | "inactive" };
type OptionsQuery = { search: string; limit: number };
type AppointmentQuery = { page: number; pageSize: number };

export function normalizePhone(phone: string | null | undefined) {
  if (!phone) return null;
  return phone.replace(/\D/g, "") || null;
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

function birthDateValue(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function dateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

const clientSelect = {
  id: true, firstName: true, lastName: true, phone: true, phoneNormalized: true,
  email: true, birthDate: true, notes: true, active: true, createdAt: true, updatedAt: true,
} satisfies Prisma.ClientSelect;

function view<T extends { firstName: string; lastName: string | null; birthDate: Date | null }>(row: T) {
  return { ...row, fullName: [row.firstName, row.lastName].filter(Boolean).join(" "), birthDate: dateOnly(row.birthDate) };
}

function searchWhere(search: string): Prisma.ClientWhereInput {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return {};
  const digits = normalizePhone(normalized);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return {
    OR: [
      { AND: tokens.map((token) => ({ OR: [
        { firstName: { contains: token, mode: "insensitive" } },
        { lastName: { contains: token, mode: "insensitive" } },
      ] })) },
      { emailNormalized: { contains: normalized } },
      ...(digits ? [{ phoneNormalized: { contains: digits } } satisfies Prisma.ClientWhereInput] : []),
    ],
  };
}

export async function listClients(businessId: string, query: ListQuery) {
  const where: Prisma.ClientWhereInput = {
    businessId,
    deletedAt: null,
    ...(query.status === "all" ? {} : { active: query.status === "active" }),
    ...searchWhere(query.search),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.client.findMany({ where, select: clientSelect, orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.client.count({ where }),
  ]);
  return { data: rows.map(view), meta: paginationMeta(query.page, query.pageSize, total) };
}

export async function clientOptions(businessId: string, query: OptionsQuery) {
  const rows = await prisma.client.findMany({
    where: { businessId, active: true, deletedAt: null, ...searchWhere(query.search) },
    select: { id: true, firstName: true, lastName: true, phone: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: query.limit,
  });
  return rows.map((row) => ({ id: row.id, fullName: [row.firstName, row.lastName].filter(Boolean).join(" "), phone: row.phone }));
}

export async function getClient(businessId: string, id: string) {
  const row = await prisma.client.findFirst({ where: { id, businessId, deletedAt: null }, select: clientSelect });
  if (!row) throw new ApiError(404, "Cliente no encontrado.", "CLIENT_NOT_FOUND");
  return view(row);
}

export async function clientAppointments(businessId: string, clientId: string, query: AppointmentQuery) {
  const client = await prisma.client.findFirst({ where: { id: clientId, businessId, deletedAt: null }, select: { id: true } });
  if (!client) throw new ApiError(404, "Cliente no encontrado.", "CLIENT_NOT_FOUND");
  const now = new Date();
  const where: Prisma.AppointmentWhereInput = { businessId, clientId };
  const [items, total, completedCount, lastVisit, nextAppointment] = await prisma.$transaction([
    prisma.appointment.findMany({
      where,
      select: { id: true, startAt: true, endAt: true, serviceName: true, price: true, status: true, employee: { select: { id: true, firstName: true, lastName: true } }, payments: { where: { status: "REGISTRADO" }, select: { id: true, amount: true, paymentMethod: { select: { name: true, kind: true } } }, take: 1 } },
      orderBy: [{ startAt: "desc" }, { createdAt: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize,
    }),
    prisma.appointment.count({ where }),
    prisma.appointment.count({ where: { ...where, status: "COMPLETADO" } }),
    prisma.appointment.findFirst({ where: { ...where, status: "COMPLETADO", startAt: { lte: now } }, select: { id: true, startAt: true }, orderBy: { startAt: "desc" } }),
    prisma.appointment.findFirst({ where: { ...where, status: { in: ["PENDIENTE", "CONFIRMADO"] }, startAt: { gte: now } }, select: { id: true, startAt: true, serviceName: true }, orderBy: { startAt: "asc" } }),
  ]);
  return { items, meta: paginationMeta(query.page, query.pageSize, total), summary: { appointmentCount: total, completedCount, lastVisit, nextAppointment } };
}

async function possibleDuplicates(businessId: string, input: ClientInput, excludeId?: string) {
  const phoneNormalized = input.phone === undefined ? undefined : normalizePhone(input.phone);
  const emailNormalized = input.email === undefined ? undefined : normalizeEmail(input.email);
  const strong: Prisma.ClientWhereInput[] = [];
  if (phoneNormalized) strong.push({ phoneNormalized });
  if (emailNormalized) strong.push({ emailNormalized });
  if (!strong.length) return [];
  const matches = await prisma.client.findMany({
    where: { businessId, active: true, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}), OR: strong },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, phoneNormalized: true, emailNormalized: true },
    take: 5,
  });
  return matches.map((match) => ({
    id: match.id,
    fullName: [match.firstName, match.lastName].filter(Boolean).join(" "),
    phone: match.phone,
    email: match.email,
    reasons: [phoneNormalized && match.phoneNormalized === phoneNormalized ? "phone" : null, emailNormalized && match.emailNormalized === emailNormalized ? "email" : null].filter(Boolean),
  }));
}

function duplicateError(matches: Awaited<ReturnType<typeof possibleDuplicates>>) {
  throw new ApiError(409, matches.some((item) => item.reasons.includes("phone")) ? "Ya existe un cliente activo con este teléfono." : "Ya existe un cliente activo con este email.", "POSSIBLE_DUPLICATE", { matches });
}

function updateData(input: ClientInput): Prisma.ClientUncheckedUpdateInput {
  const data: Prisma.ClientUncheckedUpdateInput = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.phone !== undefined) { data.phone = input.phone; data.phoneNormalized = normalizePhone(input.phone); }
  if (input.email !== undefined) { data.email = input.email; data.emailNormalized = normalizeEmail(input.email); }
  if (input.birthDate !== undefined) data.birthDate = birthDateValue(input.birthDate);
  if (input.notes !== undefined) data.notes = input.notes;
  return data;
}

function createData(businessId: string, input: ClientInput & { firstName: string }): Prisma.ClientUncheckedCreateInput {
  const data: Prisma.ClientUncheckedCreateInput = { businessId, firstName: input.firstName };
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.phone !== undefined) { data.phone = input.phone; data.phoneNormalized = normalizePhone(input.phone); }
  if (input.email !== undefined) { data.email = input.email; data.emailNormalized = normalizeEmail(input.email); }
  if (input.birthDate !== undefined) data.birthDate = birthDateValue(input.birthDate);
  if (input.notes !== undefined) data.notes = input.notes;
  return data;
}

export async function createClient(businessId: string, userId: string, input: ClientInput & { firstName: string }) {
  const matches = await possibleDuplicates(businessId, input);
  if (matches.length && input.forceDuplicate !== true) duplicateError(matches);
  return prisma.$transaction(async (tx) => {
    const created = await tx.client.create({ data: createData(businessId, input), select: clientSelect });
    await tx.auditLog.create({ data: { businessId, userId, action: "CLIENT_CREATED", entity: "Client", entityId: created.id } });
    return view(created);
  });
}

export async function updateClient(businessId: string, userId: string, id: string, input: ClientInput) {
  const current = await prisma.client.findFirst({ where: { id, businessId, deletedAt: null }, select: { id: true, phoneNormalized: true, emailNormalized: true } });
  if (!current) throw new ApiError(404, "Cliente no encontrado.", "CLIENT_NOT_FOUND");
  const changedStrongData = (input.phone !== undefined && normalizePhone(input.phone) !== current.phoneNormalized) || (input.email !== undefined && normalizeEmail(input.email) !== current.emailNormalized);
  if (changedStrongData) {
    const matches = await possibleDuplicates(businessId, input, id);
    if (matches.length && input.forceDuplicate !== true) duplicateError(matches);
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.client.update({ where: { id }, data: updateData(input), select: clientSelect });
    await tx.auditLog.create({ data: { businessId, userId, action: "CLIENT_UPDATED", entity: "Client", entityId: id, metadata: { fields: Object.keys(input).filter((field) => field !== "forceDuplicate") } } });
    return view(updated);
  });
}

async function setActive(businessId: string, userId: string, id: string, active: boolean) {
  const current = await prisma.client.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!current) throw new ApiError(404, "Cliente no encontrado.", "CLIENT_NOT_FOUND");
  if (current.active === active) return getClient(businessId, id);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.client.update({ where: { id }, data: { active }, select: clientSelect });
    await tx.auditLog.create({ data: { businessId, userId, action: active ? "CLIENT_REACTIVATED" : "CLIENT_DISABLED", entity: "Client", entityId: id } });
    return view(updated);
  });
}

export const disableClient = (businessId: string, userId: string, id: string) => setActive(businessId, userId, id, false);
export const reactivateClient = (businessId: string, userId: string, id: string) => setActive(businessId, userId, id, true);
