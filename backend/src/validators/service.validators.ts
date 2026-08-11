import { z } from "zod";
import { hexColorSchema } from "./business.validators.js";

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional(),
});

const money = z.union([z.string(), z.number()]).transform((value, context) => {
  const raw = typeof value === "number" ? value.toString() : value.trim().replace(",", ".");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(raw)) {
    context.addIssue({ code: "custom", message: "Ingresá un precio válido con hasta dos decimales." });
    return z.NEVER;
  }
  return raw;
});

export const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  categoryId: z.uuid().nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  price: money,
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  color: hexColorSchema,
  active: z.boolean().optional(),
});

export const updateServiceSchema = createServiceSchema.partial().refine((value) => Object.keys(value).length > 0, "No hay cambios para guardar.");
