import assert from "node:assert/strict";
import pg from "pg";
import path from "node:path";
import { loadEnvironmentFile, parseArgs, run } from "./backup-utils.mjs";

const args = parseArgs(process.argv.slice(2));
await loadEnvironmentFile(args);
const databaseUrl = args["database-url"] ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL o --database-url es obligatorio.");

async function snapshot() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT b.id, b.name, b."logoUrl", b.timezone, b.currency,
             u.id AS "adminId", u.email, u."passwordHash", u."roleId", u.active, u."deletedAt",
             (SELECT count(*)::int FROM "Business") AS businesses,
             (SELECT count(*)::int FROM "User") AS users,
             (SELECT count(*)::int FROM "Role") AS roles,
             (SELECT count(*)::int FROM "Permission") AS permissions,
             (SELECT count(*)::int FROM "PaymentMethod") AS methods
      FROM "Business" b
      JOIN "AppSetting" s ON s."businessId" = b.id AND s.key = 'seed.initial'
      JOIN "User" u ON u."businessId" = b.id AND u.username = $1
      ORDER BY s."createdAt" LIMIT 1
    `, [(process.env.ADMIN_USERNAME ?? "").toLowerCase()]);
    if (!result.rows[0]) throw new Error("No se encontró el negocio/administrador del seed.");
    return result.rows[0];
  } finally { await client.end(); }
}

const before = await snapshot();
const npmCommand = process.platform === "win32" ? process.execPath : "npm";
const npmArguments = process.platform === "win32"
  ? [path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"), "run", "db:seed"]
  : ["run", "db:seed"];
const npmOptions = { cwd: process.cwd(), env: process.env };
await run(npmCommand, npmArguments, npmOptions);
await run(npmCommand, npmArguments, npmOptions);
const after = await snapshot();
assert.deepEqual(after, before, "El seed modificó o duplicó datos existentes.");
console.info("Seed idempotente verificado: negocio, administrador, contraseña y conteos permanecen sin cambios.");
