import { DateTime } from "luxon";
import { ApiError } from "./api-error.js";

export function localDateRange(timezone: string, from?: string, to?: string) {
  if (!from && !to) return undefined;
  const start = from ? DateTime.fromISO(from, { zone: timezone }).startOf("day") : null;
  const end = to ? DateTime.fromISO(to, { zone: timezone }).plus({ days: 1 }).startOf("day") : null;
  if ((start && !start.isValid) || (end && !end.isValid) || (start && end && end <= start)) throw new ApiError(400, "El rango de fechas no es válido.", "INVALID_DATE_RANGE");
  return { ...(start ? { gte: start.toUTC().toJSDate() } : {}), ...(end ? { lt: end.toUTC().toJSDate() } : {}) };
}
