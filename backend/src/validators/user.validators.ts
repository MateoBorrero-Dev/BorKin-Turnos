import { z } from "zod";

export const createUserSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  email: z.email().max(160),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  password: z.string().min(12).max(200),
  roleId: z.uuid(),
  permissionOverrides: z.array(z.object({ permissionId: z.uuid(), effect: z.enum(["ALLOW", "DENY"]) })).default([]),
});

export const updateUserSchema = z.object({
  email: z.email().max(160).optional(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  roleId: z.uuid().optional(),
  active: z.boolean().optional(),
  permissionOverrides: z.array(z.object({ permissionId: z.uuid(), effect: z.enum(["ALLOW", "DENY"]) })).optional(),
}).refine((value) => Object.keys(value).length > 0, "No hay cambios para guardar.");

export const resetPasswordSchema = z.object({ password: z.string().min(12).max(200) });
