import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá una fecha válida.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usá el formato HH:mm.");

export const scheduleBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("INTERVAL"), employeeId: z.uuid(), date, startTime: time, endTime: time, reason: z.enum(["DESCANSO", "ALMUERZO", "VACACIONES", "CAPACITACION", "AUSENCIA", "PERSONALIZADO"]), customReason: z.string().trim().max(300).nullable().optional() }),
  z.object({ type: z.literal("FULL_DAY"), employeeId: z.uuid(), date, reason: z.enum(["DESCANSO", "ALMUERZO", "VACACIONES", "CAPACITACION", "AUSENCIA", "PERSONALIZADO"]), customReason: z.string().trim().max(300).nullable().optional() }),
  z.object({ type: z.literal("DATE_RANGE"), employeeId: z.uuid(), startDate: date, endDate: date, reason: z.enum(["DESCANSO", "ALMUERZO", "VACACIONES", "CAPACITACION", "AUSENCIA", "PERSONALIZADO"]), customReason: z.string().trim().max(300).nullable().optional() }),
]).refine((value) => value.reason !== "PERSONALIZADO" || Boolean(value.customReason), { message: "Ingresá el motivo personalizado.", path: ["customReason"] });
