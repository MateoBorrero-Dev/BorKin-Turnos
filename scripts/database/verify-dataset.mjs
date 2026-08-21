import pg from "pg";
import { loadEnvironmentFile, parseArgs } from "./backup-utils.mjs";

const args = parseArgs(process.argv.slice(2));
await loadEnvironmentFile(args);
const databaseUrl = args["database-url"] ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL o --database-url es obligatorio.");

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const result = await client.query(`
    SELECT
      (SELECT count(*)::int FROM "Client") AS clients,
      (SELECT count(*)::int FROM "Employee") AS employees,
      (SELECT count(*)::int FROM "Employee" WHERE "photoUrl" IS NOT NULL) AS employee_photos,
      (SELECT count(*)::int FROM "Appointment") AS appointments,
      (SELECT count(*)::int FROM "CashRegister") AS cash_registers,
      (SELECT count(*)::int FROM "CashMovement") AS cash_movements,
      (SELECT count(*)::int FROM "Payment") AS payments,
      (SELECT count(*)::int FROM "Business" WHERE "logoUrl" IS NOT NULL) AS business_logos
  `);
  const counts = result.rows[0];
  console.info(JSON.stringify(counts));
  if (args.require) {
    for (const [key, value] of Object.entries(counts)) {
      if (value < 1) throw new Error(`El dataset no contiene ${key}; no sirve para QA comercial completo.`);
    }
  }
} finally {
  await client.end();
}
