import { z } from "zod";

const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Ingresá un color hexadecimal válido.");

export const updateBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  whatsapp: z.string().trim().max(40).nullable().optional(),
  email: z.email().max(160).nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
  instagram: z.string().trim().max(100).nullable().optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, "La moneda debe usar un código ISO de tres letras.").optional(),
  locale: z.string().trim().min(2).max(35).optional(),
  timezone: z.string().trim().min(3).max(80).optional(),
  primaryColor: color.optional(),
}).refine((value) => Object.keys(value).length > 0, "No hay cambios para guardar.");

export const hexColorSchema = color;
