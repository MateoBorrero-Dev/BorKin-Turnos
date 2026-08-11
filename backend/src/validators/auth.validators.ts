import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(160),
  password: z.string().min(8).max(200),
});
