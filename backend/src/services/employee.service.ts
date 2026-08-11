import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { paginationMeta } from "../utils/pagination.js";
import { removeImage, saveImage } from "./storage.service.js";

type Page = { page: number; pageSize: number; search?: string | undefined; active: "true" | "false" | "all" };
type EmployeeInput = Partial<{ firstName: string; lastName: string; phone: string | null; email: string | null; color: string; active: boolean }>;
type Interval = { dayOfWeek: number; startTime: string; endTime: string };
const includeDetail = { services: { include: { service: true } }, schedules: { orderBy: [{ dayOfWeek: "asc" as const }, { startMinute: "asc" as const }] } };
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
function view<T extends { schedules?: Array<{ startMinute: number; endMinute: number }> }>(employee: T) { return { ...employee, ...(employee.schedules ? { schedules: employee.schedules.map((item) => ({ ...item, startTime: clock(item.startMinute), endTime: clock(item.endMinute) })) } : {}) }; }

async function ownEmployee(businessId: string, id: string) {
  const employee = await prisma.employee.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!employee) throw new ApiError(404, "Profesional no encontrado.", "EMPLOYEE_NOT_FOUND");
  return employee;
}

export async function listEmployees(businessId: string, query: Page) {
  const active = query.active === "all" ? undefined : query.active === "true";
  const where: Prisma.EmployeeWhereInput = { businessId, deletedAt: null, ...(active === undefined ? {} : { active }), ...(query.search ? { OR: [{ firstName: { contains: query.search, mode: "insensitive" } }, { lastName: { contains: query.search, mode: "insensitive" } }, { email: { contains: query.search, mode: "insensitive" } }] } : {}) };
  const [data, total] = await prisma.$transaction([prisma.employee.findMany({ where, orderBy: [{ active: "desc" }, { firstName: "asc" }, { lastName: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.employee.count({ where })]);
  return { data, meta: paginationMeta(query.page, query.pageSize, total) };
}

export async function getEmployee(businessId: string, id: string) {
  const employee = await prisma.employee.findFirst({ where: { id, businessId, deletedAt: null }, include: includeDetail });
  if (!employee) throw new ApiError(404, "Profesional no encontrado.", "EMPLOYEE_NOT_FOUND");
  return view(employee);
}

export async function createEmployee(businessId: string, userId: string, input: EmployeeInput & { firstName: string; lastName: string; color: string }) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({ data: { ...input, email: input.email?.toLowerCase() ?? null, businessId } });
    await tx.auditLog.create({ data: { businessId, userId, action: "EMPLOYEE_CREATED", entity: "Employee", entityId: created.id } });
    return created;
  });
}

export async function updateEmployee(businessId: string, userId: string, id: string, input: EmployeeInput) {
  const current = await ownEmployee(businessId, id);
  const action = input.active === false && current.active ? "EMPLOYEE_DISABLED" : "EMPLOYEE_UPDATED";
  return prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({ where: { id }, data: { ...input, ...(input.email === undefined ? {} : { email: input.email?.toLowerCase() ?? null }) } });
    await tx.auditLog.create({ data: { businessId, userId, action, entity: "Employee", entityId: id, metadata: { fields: Object.keys(input) } } });
    return updated;
  });
}

export async function replacePhoto(businessId: string, userId: string, id: string, buffer: Buffer) {
  const current = await ownEmployee(businessId, id);
  const photoUrl = await saveImage(buffer, "employees");
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({ where: { id }, data: { photoUrl } });
      await tx.auditLog.create({ data: { businessId, userId, action: "EMPLOYEE_PHOTO_UPDATED", entity: "Employee", entityId: id } });
      return employee;
    });
    await removeImage(current.photoUrl);
    return updated;
  } catch (error) { await removeImage(photoUrl); throw error; }
}

export async function deletePhoto(businessId: string, userId: string, id: string) {
  const current = await ownEmployee(businessId, id);
  const updated = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.update({ where: { id }, data: { photoUrl: null } });
    await tx.auditLog.create({ data: { businessId, userId, action: "EMPLOYEE_PHOTO_DELETED", entity: "Employee", entityId: id } });
    return employee;
  });
  await removeImage(current.photoUrl);
  return updated;
}

export async function updateServices(businessId: string, userId: string, id: string, serviceIds: string[]) {
  await ownEmployee(businessId, id);
  const count = await prisma.service.count({ where: { id: { in: serviceIds }, businessId, active: true, deletedAt: null } });
  if (count !== serviceIds.length) throw new ApiError(404, "Uno o más servicios no están disponibles.", "SERVICE_NOT_FOUND");
  return prisma.$transaction(async (tx) => {
    await tx.employeeService.deleteMany({ where: { employeeId: id } });
    if (serviceIds.length) await tx.employeeService.createMany({ data: serviceIds.map((serviceId) => ({ employeeId: id, serviceId })) });
    await tx.auditLog.create({ data: { businessId, userId, action: "EMPLOYEE_SERVICES_UPDATED", entity: "Employee", entityId: id, metadata: { serviceCount: serviceIds.length } } });
    return tx.employeeService.findMany({ where: { employeeId: id }, include: { service: true } });
  });
}

export async function getSchedules(businessId: string, id: string) { await ownEmployee(businessId, id); const rows = await prisma.employeeSchedule.findMany({ where: { employeeId: id }, orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] }); return rows.map((row) => ({ ...row, startTime: clock(row.startMinute), endTime: clock(row.endMinute) })); }

export async function updateSchedules(businessId: string, userId: string, id: string, intervals: Interval[]) {
  await ownEmployee(businessId, id);
  const normalized = intervals.map((item) => ({ dayOfWeek: item.dayOfWeek, startMinute: minutes(item.startTime), endMinute: minutes(item.endTime) })).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute);
  for (let index = 0; index < normalized.length; index += 1) {
    const item = normalized[index]!;
    if (item.startMinute >= item.endMinute) throw new ApiError(400, "La hora de inicio debe ser anterior a la hora de fin.", "INVALID_SCHEDULE");
    const previous = normalized[index - 1];
    if (previous && previous.dayOfWeek === item.dayOfWeek && previous.endMinute > item.startMinute) throw new ApiError(409, "El horario se superpone con otro intervalo laboral.", "SCHEDULE_OVERLAP");
  }
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.employeeSchedule.deleteMany({ where: { employeeId: id } });
      if (normalized.length) await tx.employeeSchedule.createMany({ data: normalized.map((item) => ({ employeeId: id, ...item })) });
      await tx.auditLog.create({ data: { businessId, userId, action: "EMPLOYEE_SCHEDULE_UPDATED", entity: "Employee", entityId: id, metadata: { intervalCount: normalized.length } } });
      const rows = await tx.employeeSchedule.findMany({ where: { employeeId: id }, orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] });
      return rows.map((row) => ({ ...row, startTime: clock(row.startMinute), endTime: clock(row.endMinute) }));
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && (error.code === "23P01" || error.code === "P2002")) throw new ApiError(409, "El horario se superpone con otro intervalo laboral.", "SCHEDULE_OVERLAP");
    throw error;
  }
}
