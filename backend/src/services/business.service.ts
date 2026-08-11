import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { removeImage, saveImage } from "./storage.service.js";

type BusinessInput = Partial<{ name: string; phone: string | null; whatsapp: string | null; email: string | null; address: string | null; instagram: string | null; currency: string; locale: string; timezone: string; primaryColor: string }>;

export async function getBusiness(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new ApiError(404, "Negocio no encontrado.", "BUSINESS_NOT_FOUND");
  return business;
}

export async function updateBusiness(businessId: string, userId: string, input: BusinessInput) {
  if (input.locale) {
    try { new Intl.NumberFormat(input.locale); } catch { throw new ApiError(400, "El locale ingresado no es válido.", "INVALID_LOCALE"); }
  }
  if (input.timezone) {
    try { new Intl.DateTimeFormat("es", { timeZone: input.timezone }); } catch { throw new ApiError(400, "La zona horaria ingresada no es válida.", "INVALID_TIMEZONE"); }
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.business.update({ where: { id: businessId }, data: input });
    await tx.auditLog.create({ data: { businessId, userId, action: "BUSINESS_SETTINGS_UPDATED", entity: "Business", entityId: businessId, metadata: { fields: Object.keys(input) } } });
    return updated;
  });
}

export async function replaceLogo(businessId: string, userId: string, buffer: Buffer) {
  const current = await getBusiness(businessId);
  const logoUrl = await saveImage(buffer, "business");
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const business = await tx.business.update({ where: { id: businessId }, data: { logoUrl } });
      await tx.auditLog.create({ data: { businessId, userId, action: "BUSINESS_LOGO_UPDATED", entity: "Business", entityId: businessId } });
      return business;
    });
    await removeImage(current.logoUrl);
    return updated;
  } catch (error) {
    await removeImage(logoUrl);
    throw error;
  }
}

export async function deleteLogo(businessId: string, userId: string) {
  const current = await getBusiness(businessId);
  const updated = await prisma.$transaction(async (tx) => {
    const business = await tx.business.update({ where: { id: businessId }, data: { logoUrl: null } });
    await tx.auditLog.create({ data: { businessId, userId, action: "BUSINESS_LOGO_DELETED", entity: "Business", entityId: businessId } });
    return business;
  });
  await removeImage(current.logoUrl);
  return updated;
}
