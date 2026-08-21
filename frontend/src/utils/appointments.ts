import { ApiClientError } from "../services/api/client";
import type { AppointmentStatus } from "../types/api";
import type { Availability } from "../types/api";

export type CalendarView = "day" | "week" | "month";
const DAY = 86_400_000;
const parse = (date: string) => new Date(`${date}T00:00:00.000Z`);
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export const addDays = (date: string, amount: number) => dateKey(new Date(parse(date).getTime() + amount * DAY));
export function todayKeyInZone(timeZone: string, now: Date = new Date()) { return localDateKey(now.toISOString(), timeZone); }
export function startOfWeek(date: string) { const value = parse(date); const offset = (value.getUTCDay() + 6) % 7; return addDays(date, -offset); }
export function calendarRange(view: CalendarView, anchor: string) {
  if (view === "day") return { from: anchor, to: anchor, days: [anchor] };
  if (view === "week") { const from = startOfWeek(anchor); const days = Array.from({ length: 7 }, (_, index) => addDays(from, index)); return { from, to: days[6]!, days }; }
  const value = parse(anchor); const first = dateKey(new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))); const last = dateKey(new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)));
  const from = startOfWeek(first); const endOffset = (7 - parse(last).getUTCDay()) % 7; const to = addDays(last, endOffset); const count = Math.round((parse(to).getTime() - parse(from).getTime()) / DAY) + 1;
  return { from, to, days: Array.from({ length: count }, (_, index) => addDays(from, index)) };
}
export function navigateAnchor(view: CalendarView, anchor: string, direction: -1 | 1) { if (view === "day") return addDays(anchor, direction); if (view === "week") return addDays(anchor, 7 * direction); const value = parse(anchor); return dateKey(new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + direction, 1))); }
export function localDateKey(iso: string, timeZone: string) { const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso)); const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ""; return `${get("year")}-${get("month")}-${get("day")}`; }
export function intervalIntersectsLocalDay(startAt: string, endAt: string, day: string, timeZone: string) { const start = Date.parse(startAt); const end = Date.parse(endAt); if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false; const firstDay = localDateKey(new Date(start).toISOString(), timeZone); const lastDay = localDateKey(new Date(end - 1).toISOString(), timeZone); return firstDay <= day && day <= lastDay; }
export function statusActions(status: AppointmentStatus) { return status === "PENDIENTE" ? ["confirm", "start", "cancel", "no-show"] : status === "CONFIRMADO" ? ["start", "cancel", "no-show"] : []; }
export function appointmentError(error: unknown) { if (error instanceof ApiClientError && error.status === 409) return error.code === "SCHEDULE_BLOCK_CONFLICT" ? "Ese horario está bloqueado." : error.code === "OUTSIDE_WORKING_HOURS" ? "Ese horario queda fuera de la jornada laboral." : "El horario acaba de ocuparse. Elegí otro turno disponible."; return error instanceof Error ? error.message : "No se pudo completar la operación."; }
export function clearAfterServiceChange() { return { employeeId: "", time: "" }; }
export function clearAfterEmployeeOrDateChange() { return { time: "" }; }
export function availabilityTimes(value: Availability | undefined) { return value?.slots.map((slot) => slot.time) ?? []; }
export function selectableAvailabilitySlots(value: Availability | undefined, date: string, timeZone: string, now: Date = new Date()) {
  const slots = value?.slots ?? [];
  if (date !== todayKeyInZone(timeZone, now)) return slots;
  const current = now.getTime();
  return slots.filter((slot) => { const start = Date.parse(slot.startAt); return Number.isFinite(start) && start >= current; });
}
export function agendaPath(from: string, to: string, employeeId = "") { return `/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${employeeId ? `&employeeId=${encodeURIComponent(employeeId)}` : ""}`; }
export function clientOptionsPath(search: string, limit = 8) { return `/clients/options?search=${encodeURIComponent(search.trim())}&limit=${limit}`; }
