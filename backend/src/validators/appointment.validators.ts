import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá una fecha válida.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usá el formato HH:mm.");
const nullableNotes = z.string().trim().max(1000).nullable().optional();
const uuid = z.uuid("El identificador debe ser un UUID válido.");

export const appointmentIdSchema = uuid;
export const appointmentListQuerySchema = z.object({ from: date, to: date, employeeId: uuid.optional() }).strict();
export const appointmentOptionsQuerySchema = z.object({ serviceId: uuid.optional() }).strict();
export const appointmentAvailabilityQuerySchema = z.object({ serviceId: uuid, employeeId: uuid, date }).strict();

export const createAppointmentSchema = z.object({
  clientId: uuid, serviceId: uuid, employeeId: uuid, date, time, notes: nullableNotes,
});

export const updateAppointmentSchema = z.object({
  clientId: uuid.optional(), serviceId: uuid.optional(), employeeId: uuid.optional(),
  date: date.optional(), time: time.optional(), notes: nullableNotes,
}).refine((value) => Object.keys(value).length > 0, "No hay cambios para guardar.");

export const rescheduleAppointmentSchema = z.object({ employeeId: uuid.optional(), date, time });
export const reasonSchema = z.object({ reason: z.string().trim().min(2).max(500) });
