import { z } from "zod";
import { hexColorSchema } from "./business.validators.js";

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.email().max(160).nullable().optional(),
  color: hexColorSchema,
  active: z.boolean().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().refine((value) => Object.keys(value).length > 0, "No hay cambios para guardar.");

export const employeeServicesSchema = z.object({ serviceIds: z.array(z.uuid()).max(200).transform((ids) => [...new Set(ids)]) });

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usá el formato HH:mm.");
export const employeeSchedulesSchema = z.object({
  intervals: z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), startTime: time, endTime: time })).max(50),
});
