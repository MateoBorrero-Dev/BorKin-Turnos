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
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "production") return;
  if (value.TRUST_PROXY_HOPS < 1) context.addIssue({ code: "custom", path: ["TRUST_PROXY_HOPS"], message: "debe declarar al menos un proxy confiable en producción" });
  if (!value.COOKIE_SECURE) context.addIssue({ code: "custom", path: ["COOKIE_SECURE"], message: "debe ser true en producción" });
  if (new URL(value.FRONTEND_URL).protocol !== "https:") context.addIssue({ code: "custom", path: ["FRONTEND_URL"], message: "debe usar HTTPS en producción" });
  if (value.JWT_SECRET === value.JWT_REFRESH_SECRET) context.addIssue({ code: "custom", path: ["JWT_REFRESH_SECRET"], message: "debe ser distinto de JWT_SECRET" });
  const placeholder = /change[_ -]?me|replace[_ -]?me|example/i;
  if (placeholder.test(value.JWT_SECRET)) context.addIssue({ code: "custom", path: ["JWT_SECRET"], message: "no puede conservar un valor de ejemplo" });
  if (placeholder.test(value.JWT_REFRESH_SECRET)) context.addIssue({ code: "custom", path: ["JWT_REFRESH_SECRET"], message: "no puede conservar un valor de ejemplo" });
});

export function parseEnvironment(input: NodeJS.ProcessEnv) {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(`Configuración inválida: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  return result.data;
}

export const env = parseEnvironment(process.env);
