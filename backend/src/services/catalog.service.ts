import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { paginationMeta } from "../utils/pagination.js";

type Page = { page: number; pageSize: number; search?: string | undefined; active: "true" | "false" | "all" };
type CategoryInput = { name: string; description?: string | null; active?: boolean };
type ServiceInput = Partial<{ name: string; categoryId: string | null; description: string | null; price: string; durationMinutes: number; color: string; active: boolean }>;

function activeValue(active: Page["active"]) { return active === "all" ? undefined : active === "true"; }
function serviceView<T extends { price: Prisma.Decimal }>(service: T) { return { ...service, price: service.price.toFixed(2) }; }

export async function listCategories(businessId: string, query: Page) {
  const selectedActive = activeValue(query.active);
  const where: Prisma.ServiceCategoryWhereInput = { businessId, deletedAt: null, ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}), ...(selectedActive === undefined ? {} : { active: selectedActive }) };
  const [data, total] = await prisma.$transaction([
    prisma.serviceCategory.findMany({ where, orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.serviceCategory.count({ where }),
  ]);
  return { data, meta: paginationMeta(query.page, query.pageSize, total) };
}

export function categoryOptions(businessId: string) {
  return prisma.serviceCategory.findMany({ where: { businessId, active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function createCategory(businessId: string, userId: string, input: CategoryInput) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.serviceCategory.create({ data: { businessId, ...input } });
    await tx.auditLog.create({ data: { businessId, userId, action: "SERVICE_CATEGORY_CREATED", entity: "ServiceCategory", entityId: created.id } });
    return created;
  });
}

export async function updateCategory(businessId: string, userId: string, id: string, input: CategoryInput) {
  const current = await prisma.serviceCategory.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!current) throw new ApiError(404, "Categoría no encontrada.", "CATEGORY_NOT_FOUND");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.serviceCategory.update({ where: { id }, data: input });
    await tx.auditLog.create({ data: { businessId, userId, action: "SERVICE_CATEGORY_UPDATED", entity: "ServiceCategory", entityId: id, metadata: { fields: Object.keys(input) } } });
    return updated;
  });
}

async function validCategory(businessId: string, categoryId: string | null | undefined) {
  if (!categoryId) return;
  if (!await prisma.serviceCategory.findFirst({ where: { id: categoryId, businessId, active: true, deletedAt: null } })) throw new ApiError(400, "La categoría seleccionada no está disponible.", "INVALID_CATEGORY");
}

export async function listServices(businessId: string, query: Page) {
  const selectedActive = activeValue(query.active);
  const where: Prisma.ServiceWhereInput = { businessId, deletedAt: null, ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}), ...(selectedActive === undefined ? {} : { active: selectedActive }) };
  const [rows, total] = await prisma.$transaction([
    prisma.service.findMany({ where, include: { category: { select: { id: true, name: true, active: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.service.count({ where }),
  ]);
  return { data: rows.map(serviceView), meta: paginationMeta(query.page, query.pageSize, total) };
}

export async function serviceOptions(businessId: string) {
  const rows = await prisma.service.findMany({ where: { businessId, active: true, deletedAt: null, OR: [{ categoryId: null }, { category: { active: true, deletedAt: null } }] }, select: { id: true, name: true, price: true, durationMinutes: true }, orderBy: { name: "asc" } });
  return rows.map(serviceView);
}

export async function getService(businessId: string, id: string) {
  const row = await prisma.service.findFirst({ where: { id, businessId, deletedAt: null }, include: { category: true } });
  if (!row) throw new ApiError(404, "Servicio no encontrado.", "SERVICE_NOT_FOUND");
  return serviceView(row);
}

export async function createService(businessId: string, userId: string, input: ServiceInput & { name: string; price: string; durationMinutes: number; color: string }) {
  await validCategory(businessId, input.categoryId);
  return prisma.$transaction(async (tx) => {
    const created = await tx.service.create({ data: { ...input, price: new Prisma.Decimal(input.price), businessId } });
    await tx.auditLog.create({ data: { businessId, userId, action: "SERVICE_CREATED", entity: "Service", entityId: created.id } });
    return serviceView(created);
  });
}

export async function updateService(businessId: string, userId: string, id: string, input: ServiceInput) {
  const current = await prisma.service.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!current) throw new ApiError(404, "Servicio no encontrado.", "SERVICE_NOT_FOUND");
  await validCategory(businessId, input.categoryId);
  const action = input.active === false && current.active ? "SERVICE_DISABLED" : "SERVICE_UPDATED";
  return prisma.$transaction(async (tx) => {
    const updated = await tx.service.update({ where: { id }, data: { ...input, ...(input.price === undefined ? {} : { price: new Prisma.Decimal(input.price) }) } });
    await tx.auditLog.create({ data: { businessId, userId, action, entity: "Service", entityId: id, metadata: { fields: Object.keys(input) } } });
    return serviceView(updated);
  });
}
