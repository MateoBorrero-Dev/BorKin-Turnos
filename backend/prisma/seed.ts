import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const required = ["DATABASE_URL", "ADMIN_USERNAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"] as const;
for (const key of required) if (!process.env[key]) throw new Error(`Falta ${key} para ejecutar el seed.`);
if (process.env.ADMIN_PASSWORD!.length < 12) throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const permissions = [
  "dashboard.view", "appointments.view", "appointments.create", "appointments.edit", "appointments.cancel",
  "clients.view", "clients.manage", "services.manage", "employees.manage", "cash.view", "cash.manage",
  "reports.view", "statistics.view", "settings.manage", "users.manage",
] as const;

async function main() {
  const businessName = process.env.BUSINESS_NAME ?? "BorKin Demo";
  let business = await prisma.business.findFirst({ where: { name: businessName } });
  business ??= await prisma.business.create({ data: { name: businessName } });

  const permissionRows = await Promise.all(permissions.map((code) => prisma.permission.upsert({
    where: { code }, update: { name: code }, create: { code, name: code },
  })));

  const adminRole = await prisma.role.upsert({
    where: { businessId_code: { businessId: business.id, code: "ADMIN" } },
    update: { name: "Administrador", isSystem: true },
    create: { businessId: business.id, code: "ADMIN", name: "Administrador", isSystem: true },
  });
  const employeeRole = await prisma.role.upsert({
    where: { businessId_code: { businessId: business.id, code: "EMPLEADO" } },
    update: { name: "Empleado", isSystem: true },
    create: { businessId: business.id, code: "EMPLEADO", name: "Empleado", isSystem: true },
  });

  await prisma.rolePermission.createMany({ data: permissionRows.map((permission) => ({ roleId: adminRole.id, permissionId: permission.id })), skipDuplicates: true });
  const dashboardPermission = permissionRows.find((item) => item.code === "dashboard.view")!;
  await prisma.rolePermission.createMany({ data: [{ roleId: employeeRole.id, permissionId: dashboardPermission.id }], skipDuplicates: true });

  const passwordHash = await argon2.hash(process.env.ADMIN_PASSWORD!, { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { businessId_username: { businessId: business.id, username: process.env.ADMIN_USERNAME!.toLowerCase() } },
    update: { email: process.env.ADMIN_EMAIL!.toLowerCase(), passwordHash, roleId: adminRole.id, active: true, deletedAt: null },
    create: {
      businessId: business.id, roleId: adminRole.id, username: process.env.ADMIN_USERNAME!.toLowerCase(),
      email: process.env.ADMIN_EMAIL!.toLowerCase(), passwordHash, firstName: "Administrador", lastName: "BorKin",
    },
  });

  const methods = [
    ["EFECTIVO", "Efectivo", true], ["TRANSFERENCIA", "Transferencia", false], ["DEBITO", "Débito", false],
    ["CREDITO", "Crédito", false], ["MERCADO_PAGO", "Mercado Pago", false], ["OTRO", "Otro", false],
  ] as const;
  for (const [code, name, isCash] of methods) {
    await prisma.paymentMethod.upsert({
      where: { businessId_code: { businessId: business.id, code } },
      update: { name, isCash, active: true },
      create: { businessId: business.id, code, name, isCash },
    });
  }
  await prisma.appSetting.upsert({
    where: { businessId_key: { businessId: business.id, key: "seed.initial" } },
    update: { value: { applied: true } }, create: { businessId: business.id, key: "seed.initial", value: { applied: true } },
  });
  console.info(`Seed aplicado para ${business.name}. Usuario administrador: ${process.env.ADMIN_USERNAME}`);
}

main().finally(async () => prisma.$disconnect());
