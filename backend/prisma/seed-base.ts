import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const required = ["DATABASE_URL", "ADMIN_USERNAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"] as const;
const forbiddenSecret = /change[_ -]?me|replace[_ -]?me|example[_ -]?password/i;

for (const key of required) {
  if (!process.env[key]) throw new Error(`Falta ${key} para ejecutar el seed.`);
}
if (process.env.ADMIN_PASSWORD!.length < 12) throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
if (forbiddenSecret.test(process.env.ADMIN_PASSWORD!)) {
  throw new Error("ADMIN_PASSWORD conserva un valor de ejemplo. Definí una contraseña única antes de ejecutar el seed.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const seedPrisma = new PrismaClient({ adapter });

const permissions = [
  "dashboard.view", "appointments.view", "appointments.create", "appointments.edit", "appointments.cancel",
  "clients.view", "clients.manage", "services.manage", "employees.manage", "cash.view", "cash.manage", "cash.open", "cash.close", "cash.movements",
  "payments.charge", "payments.adjust_amount", "reports.view", "statistics.view", "audit.view", "settings.manage", "users.manage",
] as const;

const paymentMethods = [
  ["EFECTIVO", "Efectivo", "CASH", 10], ["TRANSFERENCIA", "Transferencia", "TRANSFER", 20],
  ["DEBITO", "Débito", "DEBIT_CARD", 30], ["CREDITO", "Crédito", "CREDIT_CARD", 40],
  ["MERCADO_PAGO", "Mercado Pago", "OTHER", 50], ["OTRO", "Otro", "OTHER", 60],
] as const;

export async function runProductionSeed() {
  const businessName = process.env.BUSINESS_NAME?.trim() || "BorKin Turnos";
  let business = await seedPrisma.business.findFirst({ where: { settings: { some: { key: "seed.initial" } } } });
  business ??= await seedPrisma.business.findFirst({ where: { name: businessName } });
  business ??= await seedPrisma.business.create({ data: { name: businessName } });

  const permissionRows = [];
  for (const code of permissions) {
    let permission = await seedPrisma.permission.findUnique({ where: { code } });
    permission ??= await seedPrisma.permission.create({ data: { code, name: code } });
    permissionRows.push(permission);
  }

  let adminRole = await seedPrisma.role.findUnique({ where: { businessId_code: { businessId: business.id, code: "ADMIN" } } });
  adminRole ??= await seedPrisma.role.create({ data: { businessId: business.id, code: "ADMIN", name: "Administrador", isSystem: true } });
  let employeeRole = await seedPrisma.role.findUnique({ where: { businessId_code: { businessId: business.id, code: "EMPLEADO" } } });
  employeeRole ??= await seedPrisma.role.create({ data: { businessId: business.id, code: "EMPLEADO", name: "Empleado", isSystem: true } });

  await seedPrisma.rolePermission.createMany({ data: permissionRows.map((permission) => ({ roleId: adminRole.id, permissionId: permission.id })), skipDuplicates: true });
  const employeePermissionCodes = new Set([
    "dashboard.view", "appointments.view", "appointments.create", "appointments.edit", "appointments.cancel",
    "clients.view", "clients.manage", "cash.view", "cash.open", "cash.close", "payments.charge",
  ]);
  await seedPrisma.rolePermission.createMany({
    data: permissionRows.filter((item) => employeePermissionCodes.has(item.code)).map((permission) => ({ roleId: employeeRole.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

  const username = process.env.ADMIN_USERNAME!.trim().toLowerCase();
  const email = process.env.ADMIN_EMAIL!.trim().toLowerCase();
  let admin = await seedPrisma.user.findUnique({ where: { businessId_username: { businessId: business.id, username } } });
  if (!admin) {
    const emailOwner = await seedPrisma.user.findUnique({ where: { businessId_email: { businessId: business.id, email } } });
    if (emailOwner) throw new Error("ADMIN_EMAIL ya pertenece a otro usuario del negocio.");
    const passwordHash = await argon2.hash(process.env.ADMIN_PASSWORD!, { type: argon2.argon2id });
    admin = await seedPrisma.user.create({
      data: { businessId: business.id, roleId: adminRole.id, username, email, passwordHash, firstName: "Administrador", lastName: "BorKin" },
    });
  }

  for (const [code, name, kind, sortOrder] of paymentMethods) {
    const current = await seedPrisma.paymentMethod.findUnique({ where: { businessId_code: { businessId: business.id, code } } });
    if (!current) {
      await seedPrisma.paymentMethod.create({ data: { businessId: business.id, code, name, kind, isCash: kind === "CASH", sortOrder } });
    }
  }

  const marker = await seedPrisma.appSetting.findUnique({ where: { businessId_key: { businessId: business.id, key: "seed.initial" } } });
  if (!marker) {
    await seedPrisma.appSetting.create({ data: { businessId: business.id, key: "seed.initial", value: { applied: true, version: "0.1.0" } } });
  }

  console.info(`Seed base aplicado para ${business.name}. Administrador: ${admin.username}.`);
  return { business, admin };
}

export async function disconnectSeedClient() { await seedPrisma.$disconnect(); }
