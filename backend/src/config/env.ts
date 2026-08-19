import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().max(90).default(7),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  LOG_LEVEL: z.string().default("info"),
  UPLOAD_DIR: z.string().default("../.local/uploads"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().max(10_000_000).default(2_000_000),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && !value.COOKIE_SECURE) context.addIssue({ code: "custom", path: ["COOKIE_SECURE"], message: "debe ser true en producción" });
});

const result = schema.safeParse(process.env);
if (!result.success) {
  throw new Error(`Configuración inválida: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
}

export const env = result.data;
