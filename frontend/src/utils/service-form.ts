import { z } from "zod";

export const serviceFormSchema = z.object({
  name: z.string().trim().min(2, "Ingresá al menos 2 caracteres."),
  categoryId: z.string(),
  description: z.string(),
  price: z.string().regex(/^\d{1,12}([.,]\d{1,2})?$/, "Ingresá un importe válido."),
  durationMinutes: z.number().int().min(1, "La duración debe ser mayor a cero.").max(1440),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido."),
});

export type ServiceValues = z.infer<typeof serviceFormSchema>;
