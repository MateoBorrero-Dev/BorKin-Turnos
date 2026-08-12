import { DateTime } from "luxon";
import { AppointmentStatus, Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/api-error.js";

const OCCUPYING: AppointmentStatus[] = ["PENDIENTE", "CONFIRMADO", "EN_CURSO", "COMPLETADO", "AUSENTE"];
const includeAppointment = {
  client: { select: { id: true, firstName: true, lastName: true, phone: true, phoneNormalized: true, whatsapp: true, active: true } },
  service: { select: { id: true, name: true, color: true, active: true } },
  employee: { select: { id: true, firstName: true, lastName: true, color: true, photoUrl: true, active: true } },
  statusEvents: { orderBy: { createdAt: "asc" as const }, select: { id: true, fromStatus: true, toStatus: true, reason: true, createdAt: true, user: { select: { firstName: true, lastName: true } } } },
};

type Tx = Prisma.TransactionClient;
type CreateInput = { clientId: string; serviceId: string; employeeId: string; date: string; time: string; notes?: string | null };
type UpdateInput = Partial<CreateInput>;

function localDateTime(date: string, time: string, zone: string) {
  const value = DateTime.fromISO(`${date}T${time}`, { zone, setZone: true });
  if (!value.isValid || value.toFormat("yyyy-MM-dd HH:mm") !== `${date} ${time}`) throw new ApiError(400, "La fecha u hora no existe en la zona horaria del negocio.", "INVALID_LOCAL_DATETIME");
  return value;
}

function localParts(value: Date, zone: string) {
  const dateTime = DateTime.fromJSDate(value, { zone });
  return { date: dateTime.toFormat("yyyy-MM-dd"), time: dateTime.toFormat("HH:mm") };
}

async function businessZone(tx: Tx, businessId: string) {
  const business = await tx.business.findUnique({ where: { id: businessId }, select: { timezone: true } });
  if (!business || !DateTime.local().setZone(business.timezone).isValid) throw new ApiError(400, "La zona horaria del negocio no es válida.", "INVALID_BUSINESS_TIMEZONE");
  return business.timezone;
}

async function relations(tx: Tx, businessId: string, input: Pick<CreateInput, "clientId" | "serviceId" | "employeeId">) {
  const client = await tx.client.findFirst({ where: { id: input.clientId, businessId, active: true, deletedAt: null } });
  const service = await tx.service.findFirst({ where: { id: input.serviceId, businessId, active: true, deletedAt: null } });
  const employee = await tx.employee.findFirst({ where: { id: input.employeeId, businessId, active: true, deletedAt: null } });
  const assignment = await tx.employeeService.findUnique({ where: { employeeId_serviceId: { employeeId: input.employeeId, serviceId: input.serviceId } } });
  if (!client) throw new ApiError(404, "El cliente no está disponible.", "CLIENT_NOT_AVAILABLE");
  if (!service) throw new ApiError(404, "El servicio no está disponible.", "SERVICE_NOT_AVAILABLE");
  if (!employee) throw new ApiError(404, "El profesional no está disponible.", "EMPLOYEE_NOT_AVAILABLE");
  if (!assignment) throw new ApiError(400, "El profesional no realiza el servicio seleccionado.", "EMPLOYEE_SERVICE_MISMATCH");
  return { client, service, employee };
}

async function lockEmployee(tx: Tx, businessId: string, employeeId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${businessId}:${employeeId}`}, 0))`;
}

async function validateRange(tx: Tx, businessId: string, employeeId: string, startAt: Date, endAt: Date, zone: string, excludingId?: string) {
  const localStart = DateTime.fromJSDate(startAt, { zone });
  const localEnd = DateTime.fromJSDate(endAt, { zone });
  if (localStart.toISODate() !== localEnd.toISODate()) throw new ApiError(400, "El turno debe comenzar y terminar el mismo día local.", "OUTSIDE_WORKING_HOURS");
  const startMinute = localStart.hour * 60 + localStart.minute;
  const endMinute = localEnd.hour * 60 + localEnd.minute;
  const dayOfWeek = localStart.weekday % 7;
  const schedule = await tx.employeeSchedule.findFirst({ where: { employeeId, dayOfWeek, startMinute: { lte: startMinute }, endMinute: { gte: endMinute } } });
  if (!schedule) throw new ApiError(409, "El turno queda fuera del horario laboral del profesional.", "OUTSIDE_WORKING_HOURS");
  const block = await tx.scheduleBlock.findFirst({ where: { businessId, active: true, deletedAt: null, OR: [{ employeeId }, { employeeId: null }], startAt: { lt: endAt }, endAt: { gt: startAt } } });
  if (block) throw new ApiError(409, "Ese horario está bloqueado para el profesional.", "SCHEDULE_BLOCK_CONFLICT");
  const overlap = await tx.appointment.findFirst({ where: { businessId, employeeId, status: { in: OCCUPYING }, startAt: { lt: endAt }, endAt: { gt: startAt }, ...(excludingId ? { id: { not: excludingId } } : {}) } });
  if (overlap) throw new ApiError(409, "El profesional ya tiene un turno en ese horario.", "APPOINTMENT_CONFLICT");
}

function overlapConstraint(error: unknown) {
  const value = error instanceof Error ? `${error.name} ${error.message}` : JSON.stringify(error);
  return value.includes("Appointment_no_employee_overlap") || value.includes("23P01");
}

function agendaRange(from: string, to: string, zone: string) {
  const start = DateTime.fromISO(from, { zone }).startOf("day");
  const end = DateTime.fromISO(to, { zone }).plus({ days: 1 }).startOf("day");
  if (!start.isValid || !end.isValid || end <= start || end.diff(start, "days").days > 93) throw new ApiError(400, "El rango de agenda debe ser válido y no superar 93 días.", "INVALID_AGENDA_RANGE");
  return { startAt: start.toUTC().toJSDate(), endAt: end.toUTC().toJSDate() };
}

export async function listAppointments(businessId: string, from: string, to: string, employeeId?: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { timezone: true } });
  if (!business) throw new ApiError(404, "Negocio no encontrado.");
  const range = agendaRange(from, to, business.timezone);
  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({ where: { businessId, startAt: { lt: range.endAt }, endAt: { gt: range.startAt }, ...(employeeId ? { employeeId } : {}) }, include: includeAppointment, orderBy: { startAt: "asc" } }),
    prisma.scheduleBlock.findMany({ where: { businessId, active: true, deletedAt: null, startAt: { lt: range.endAt }, endAt: { gt: range.startAt }, ...(employeeId ? { OR: [{ employeeId }, { employeeId: null }] } : {}) }, include: { employee: { select: { id: true, firstName: true, lastName: true, color: true } } }, orderBy: { startAt: "asc" } }),
  ]);
  return { appointments, blocks };
}

export async function getAppointment(businessId: string, id: string) {
  const item = await prisma.appointment.findFirst({ where: { id, businessId }, include: includeAppointment });
  if (!item) throw new ApiError(404, "Turno no encontrado.", "APPOINTMENT_NOT_FOUND");
  return item;
}

export async function appointmentOptions(businessId: string, serviceId?: string) {
  const [services, employees] = await Promise.all([
    prisma.service.findMany({ where: { businessId, active: true, deletedAt: null }, select: { id: true, name: true, durationMinutes: true, price: true, color: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { businessId, active: true, deletedAt: null, ...(serviceId ? { services: { some: { serviceId, service: { active: true, deletedAt: null } } } } : {}) }, select: { id: true, firstName: true, lastName: true, color: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
  ]);
  return { services, employees };
}

export async function availability(businessId: string, serviceId: string, employeeId: string, date: string) {
  return prisma.$transaction(async (tx) => {
    const zone = await businessZone(tx, businessId);
    const service = await tx.service.findFirst({ where: { id: serviceId, businessId, active: true, deletedAt: null } });
    const employee = await tx.employee.findFirst({ where: { id: employeeId, businessId, active: true, deletedAt: null } });
    const assignment = await tx.employeeService.findUnique({ where: { employeeId_serviceId: { employeeId, serviceId } } });
    if (!service) throw new ApiError(404, "El servicio no está disponible.", "SERVICE_NOT_AVAILABLE");
    if (!employee) throw new ApiError(404, "El profesional no está disponible.", "EMPLOYEE_NOT_AVAILABLE");
    if (!assignment) throw new ApiError(400, "El profesional no realiza el servicio seleccionado.", "EMPLOYEE_SERVICE_MISMATCH");
    const day = DateTime.fromISO(date, { zone }).startOf("day");
    if (!day.isValid || day.toFormat("yyyy-MM-dd") !== date) throw new ApiError(400, "Ingresá una fecha válida.", "INVALID_DATE");
    const schedules = await tx.employeeSchedule.findMany({ where: { employeeId, dayOfWeek: day.weekday % 7 }, orderBy: { startMinute: "asc" } });
    const dayEnd = day.plus({ days: 1 });
    const appointments = await tx.appointment.findMany({ where: { businessId, employeeId, status: { in: OCCUPYING }, startAt: { lt: dayEnd.toJSDate() }, endAt: { gt: day.toJSDate() } }, select: { startAt: true, endAt: true } });
    const blocks = await tx.scheduleBlock.findMany({ where: { businessId, active: true, deletedAt: null, OR: [{ employeeId }, { employeeId: null }], startAt: { lt: dayEnd.toJSDate() }, endAt: { gt: day.toJSDate() } }, select: { startAt: true, endAt: true } });
    const busy = [...appointments, ...blocks];
    const slots: Array<{ date: string; time: string; startAt: string; endAt: string; durationMinutes: number }> = [];
    for (const schedule of schedules) for (let minute = schedule.startMinute; minute + service.durationMinutes <= schedule.endMinute; minute += 15) {
      const clock = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      const start = localDateTime(date, clock, zone); const end = start.plus({ minutes: service.durationMinutes });
      if (!busy.some((item) => item.startAt < end.toJSDate() && item.endAt > start.toJSDate())) slots.push({ date, time: clock, startAt: start.toUTC().toISO()!, endAt: end.toUTC().toISO()!, durationMinutes: service.durationMinutes });
    }
    return { date, timezone: zone, durationMinutes: service.durationMinutes, slotMinutes: 15, slots };
  });
}

export async function createAppointment(businessId: string, userId: string, input: CreateInput) {
  try {
    const id = await prisma.$transaction(async (tx) => {
      await lockEmployee(tx, businessId, input.employeeId);
      const zone = await businessZone(tx, businessId);
      const { service } = await relations(tx, businessId, input);
      const start = localDateTime(input.date, input.time, zone); const end = start.plus({ minutes: service.durationMinutes });
      await validateRange(tx, businessId, input.employeeId, start.toJSDate(), end.toJSDate(), zone);
      const created = await tx.appointment.create({ data: { businessId, createdById: userId, clientId: input.clientId, serviceId: input.serviceId, employeeId: input.employeeId, startAt: start.toUTC().toJSDate(), endAt: end.toUTC().toJSDate(), durationMinutes: service.durationMinutes, serviceName: service.name, price: service.price, notes: input.notes ?? null } });
      await tx.appointmentStatusEvent.create({ data: { businessId, appointmentId: created.id, userId, toStatus: "PENDIENTE", reason: "Turno creado" } });
      await tx.auditLog.create({ data: { businessId, userId, action: "APPOINTMENT_CREATED", entity: "Appointment", entityId: created.id, metadata: { employeeId: input.employeeId, startAt: created.startAt.toISOString() } } });
      return created.id;
    });
    return getAppointment(businessId, id);
  } catch (error) { if (overlapConstraint(error)) throw new ApiError(409, "El profesional acaba de recibir otro turno en ese horario.", "APPOINTMENT_CONFLICT"); throw error; }
}

async function currentEditable(tx: Tx, businessId: string, id: string) {
  const item = await tx.appointment.findFirst({ where: { id, businessId } });
  if (!item) throw new ApiError(404, "Turno no encontrado.", "APPOINTMENT_NOT_FOUND");
  if (["COMPLETADO", "CANCELADO", "AUSENTE"].includes(item.status)) throw new ApiError(409, "El turno es histórico y no admite cambios normales.", "APPOINTMENT_IMMUTABLE");
  return item;
}

export async function updateAppointment(businessId: string, userId: string, id: string, input: UpdateInput) {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await currentEditable(tx, businessId, id);
      const structural = input.clientId !== undefined || input.serviceId !== undefined || input.employeeId !== undefined || input.date !== undefined || input.time !== undefined;
      if (structural && current.status === "EN_CURSO") throw new ApiError(409, "Un turno en curso sólo permite actualizar sus notas.", "APPOINTMENT_IN_PROGRESS");
      if (!structural) {
        await tx.appointment.update({ where: { id }, data: { notes: input.notes ?? null, version: { increment: 1 } } });
        await tx.auditLog.create({ data: { businessId, userId, action: "APPOINTMENT_UPDATED", entity: "Appointment", entityId: id, metadata: { fields: ["notes"] } } });
        return;
      }
      const zone = await businessZone(tx, businessId); const local = localParts(current.startAt, zone);
      const merged: CreateInput = { clientId: input.clientId ?? current.clientId, serviceId: input.serviceId ?? current.serviceId, employeeId: input.employeeId ?? current.employeeId, date: input.date ?? local.date, time: input.time ?? local.time, notes: input.notes === undefined ? current.notes : input.notes };
      await lockEmployee(tx, businessId, merged.employeeId);
      const { service } = await relations(tx, businessId, merged);
      const serviceChanged = merged.serviceId !== current.serviceId;
      const durationMinutes = serviceChanged ? service.durationMinutes : current.durationMinutes;
      const start = localDateTime(merged.date, merged.time, zone); const end = start.plus({ minutes: durationMinutes });
      if (structural) await validateRange(tx, businessId, merged.employeeId, start.toJSDate(), end.toJSDate(), zone, id);
      const updated = await tx.appointment.update({ where: { id }, data: { clientId: merged.clientId, serviceId: merged.serviceId, employeeId: merged.employeeId, startAt: start.toUTC().toJSDate(), endAt: end.toUTC().toJSDate(), durationMinutes, ...(serviceChanged ? { serviceName: service.name, price: service.price } : {}), notes: merged.notes ?? null, version: { increment: 1 } } });
      const rescheduled = current.startAt.getTime() !== updated.startAt.getTime() || current.employeeId !== updated.employeeId;
      await tx.auditLog.create({ data: { businessId, userId, action: rescheduled ? "APPOINTMENT_RESCHEDULED" : "APPOINTMENT_UPDATED", entity: "Appointment", entityId: id, metadata: { previousStartAt: current.startAt.toISOString(), startAt: updated.startAt.toISOString(), fields: Object.keys(input) } } });
    });
    return getAppointment(businessId, id);
  } catch (error) { if (overlapConstraint(error)) throw new ApiError(409, "El profesional acaba de recibir otro turno en ese horario.", "APPOINTMENT_CONFLICT"); throw error; }
}

const transitions: Record<AppointmentStatus, AppointmentStatus[]> = { PENDIENTE: ["CONFIRMADO", "EN_CURSO", "CANCELADO", "AUSENTE"], CONFIRMADO: ["EN_CURSO", "CANCELADO", "AUSENTE"], EN_CURSO: ["COMPLETADO"], COMPLETADO: [], CANCELADO: [], AUSENTE: [] };

export async function transitionAppointment(businessId: string, userId: string, id: string, toStatus: AppointmentStatus, reason?: string) {
  await prisma.$transaction(async (tx) => {
    const current = await tx.appointment.findFirst({ where: { id, businessId } });
    if (!current) throw new ApiError(404, "Turno no encontrado.", "APPOINTMENT_NOT_FOUND");
    if (!transitions[current.status].includes(toStatus)) throw new ApiError(409, `No se puede pasar de ${current.status} a ${toStatus}.`, "INVALID_STATUS_TRANSITION");
    if (toStatus === "CANCELADO" && !reason) throw new ApiError(400, "Indicá el motivo de cancelación.", "CANCELLATION_REASON_REQUIRED");
    const now = new Date();
    await tx.appointment.update({ where: { id }, data: { status: toStatus, completedAt: toStatus === "COMPLETADO" ? now : current.completedAt, cancelledAt: toStatus === "CANCELADO" ? now : current.cancelledAt, version: { increment: 1 } } });
    await tx.appointmentStatusEvent.create({ data: { businessId, appointmentId: id, userId, fromStatus: current.status, toStatus, reason: reason ?? null } });
    await tx.auditLog.create({ data: { businessId, userId, action: `APPOINTMENT_${toStatus}`, entity: "Appointment", entityId: id, ...(reason ? { metadata: { reason } } : {}) } });
  });
  return getAppointment(businessId, id);
}
