import { z } from "zod";
import { ApiClientError } from "../services/api/client";
import type { DuplicateClient } from "../types/api";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function validBirthDate(value: string) {
  if (!value) return true;
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day && value <= new Date().toISOString().slice(0, 10);
}

export const clientFormSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá el nombre.").max(100),
  lastName: z.string().trim().max(100),
  phone: z.string().trim().max(40).refine((value) => !value || /^[+0-9()\s.-]+$/.test(value), "Ingresá un teléfono válido."),
  email: z.string().trim().max(254).refine((value) => !value || z.email().safeParse(value).success, "Ingresá un email válido."),
  birthDate: z.string().refine(validBirthDate, "Ingresá una fecha válida que no sea futura."),
  notes: z.string().trim().max(2_000, "Las notas no pueden superar 2000 caracteres."),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export function clientPayload(values: ClientFormValues, forceDuplicate = false) {
  return {
    firstName: values.firstName.trim(), lastName: values.lastName.trim() || null, phone: values.phone.trim() || null,
    email: values.email.trim().toLowerCase() || null, birthDate: values.birthDate || null, notes: values.notes.trim() || null,
    ...(forceDuplicate ? { forceDuplicate: true } : {}),
  };
}

export function duplicateClients(error: unknown): DuplicateClient[] | null {
  if (!(error instanceof ApiClientError) || error.code !== "POSSIBLE_DUPLICATE" || !error.details || typeof error.details !== "object" || !("matches" in error.details) || !Array.isArray(error.details.matches)) return null;
  return error.details.matches as DuplicateClient[];
}

export function clientsPath(page: number, pageSize: number, search: string, status: "all" | "active" | "inactive") {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), status });
  if (search.trim()) params.set("search", search.trim());
  return `/clients?${params}`;
}
