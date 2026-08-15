import { DateTime } from "luxon";
import { prisma } from "../config/prisma.js";
import { ApiError } from "./api-error.js";

export type ReportRange = {
  timezone: string;
  locale: string;
  currency: string;
  from: string;
  to: string;
  start: Date;
  end: Date;
  days: string[];
};

export async function reportRange(businessId: string, from: string, to: string): Promise<ReportRange> {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { timezone: true, locale: true, currency: true } });
  if (!business) throw new ApiError(404, "Negocio no encontrado.", "BUSINESS_NOT_FOUND");
  const first = DateTime.fromISO(from, { zone: business.timezone }).startOf("day");
  const last = DateTime.fromISO(to, { zone: business.timezone }).startOf("day");
  if (!first.isValid || !last.isValid || first.toFormat("yyyy-MM-dd") !== from || last.toFormat("yyyy-MM-dd") !== to || last < first) {
    throw new ApiError(400, "El rango de fechas no es válido.", "INVALID_DATE_RANGE");
  }
  const count = Math.round(last.diff(first, "days").days) + 1;
  if (count > 366) throw new ApiError(400, "El rango no puede superar 366 días.", "DATE_RANGE_TOO_LARGE");
  const days = Array.from({ length: count }, (_, index) => first.plus({ days: index }).toFormat("yyyy-MM-dd"));
  return { ...business, from, to, start: first.toUTC().toJSDate(), end: last.plus({ days: 1 }).toUTC().toJSDate(), days };
}

export function previousRange(range: ReportRange) {
  const start = DateTime.fromJSDate(range.start, { zone: range.timezone }).minus({ days: range.days.length });
  const end = DateTime.fromJSDate(range.start, { zone: range.timezone });
  return { start: start.toUTC().toJSDate(), end: end.toUTC().toJSDate(), from: start.toFormat("yyyy-MM-dd"), to: end.minus({ days: 1 }).toFormat("yyyy-MM-dd") };
}

export async function todayRange(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { timezone: true, locale: true, currency: true } });
  if (!business) throw new ApiError(404, "Negocio no encontrado.");
  const today = DateTime.now().setZone(business.timezone).startOf("day");
  return { ...business, date: today.toFormat("yyyy-MM-dd"), start: today.toUTC().toJSDate(), end: today.plus({ days: 1 }).toUTC().toJSDate() };
}
