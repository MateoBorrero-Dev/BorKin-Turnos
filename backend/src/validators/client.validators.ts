import { z } from "zod";

const optionalText = (max: number) => z.union([z.string().trim().max(max).transform((value) => value || null), z.null()]).optional();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validPastOrPresentDate(value: string) {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) return false;
  return value <= new Date().toISOString().slice(0, 10);
}

const clientFields = {
  firstName: z.string().trim().min(1, "Ingresá el nombre.").max(100),
  lastName: optionalText(100),
  phone: optionalText(40).refine((value) => value === undefined || value === null || /^[+0-9()\s.-]+$/.test(value), "Ingresá un teléfono válido."),
  email: z.union([z.string().trim().max(254).refine((value) => value === "" || z.email().safeParse(value).success, "Ingresá un email válido.").transform((value) => value.toLowerCase() || null), z.null()]).optional(),
  birthDate: z.union([z.literal(""), z.string().refine(validPastOrPresentDate, "Ingresá una fecha válida que no sea futura."), z.null()]).transform((value) => value || null).optional(),
  notes: optionalText(2_000),
  forceDuplicate: z.boolean().optional(),
};

export const createClientSchema = z.object(clientFields).strict();
export const updateClientSchema = z.object(clientFields).partial().strict().refine((value) => Object.keys(value).length > 0, "Enviá al menos un campo para modificar.");

export const clientListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(""),
  status: z.enum(["all", "active", "inactive"]).default("all"),
}).strict();

export const clientOptionsQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(20).default(10),
}).strict();

export const clientIdSchema = z.uuid();
