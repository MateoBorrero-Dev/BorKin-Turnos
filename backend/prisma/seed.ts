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
  let business = await prisma.business.findFirst({ where: { settings: { some: { key: "seed.initial" } } } });
  business ??= await prisma.business.findFirst({ where: { name: businessName } });
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
  const employeePermissionCodes = new Set(["dashboard.view", "clients.view", "clients.manage"]);
  await prisma.rolePermission.createMany({
    data: permissionRows.filter((item) => employeePermissionCodes.has(item.code)).map((permission) => ({ roleId: employeeRole.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

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

  const categoryData = [
    { name: "Cabello", description: "Cortes y tratamientos capilares", sortOrder: 10 },
    { name: "Barba", description: "Perfilado y cuidado de barba", sortOrder: 20 },
    { name: "Bienestar", description: "Servicios de relajación y bienestar", sortOrder: 30 },
  ];
  const categories = new Map<string, string>();
  for (const item of categoryData) {
    const category = await prisma.serviceCategory.upsert({
      where: { businessId_name: { businessId: business.id, name: item.name } },
      update: { description: item.description, sortOrder: item.sortOrder, active: true, deletedAt: null },
      create: { businessId: business.id, ...item },
    });
    categories.set(item.name, category.id);
  }

  const serviceData = [
    { name: "Corte", category: "Cabello", price: "15000.00", durationMinutes: 45, color: "#2563EB" },
    { name: "Barba", category: "Barba", price: "9000.00", durationMinutes: 30, color: "#0F766E" },
    { name: "Corte + Barba", category: "Cabello", price: "21000.00", durationMinutes: 75, color: "#7C3AED" },
    { name: "Masaje 30 minutos", category: "Bienestar", price: "18000.00", durationMinutes: 30, color: "#C2410C" },
  ];
  const services = new Map<string, string>();
  for (const item of serviceData) {
    const service = await prisma.service.upsert({
      where: { businessId_name: { businessId: business.id, name: item.name } },
      update: { categoryId: categories.get(item.category)!, price: item.price, durationMinutes: item.durationMinutes, color: item.color, active: true, deletedAt: null },
      create: { businessId: business.id, categoryId: categories.get(item.category)!, name: item.name, price: item.price, durationMinutes: item.durationMinutes, color: item.color },
    });
    services.set(item.name, service.id);
  }

  const employeeData = [
    { firstName: "Juan", lastName: "Pérez", email: "juan.demo@borkin.local", color: "#0F766E", serviceNames: ["Corte", "Barba", "Corte + Barba"] },
    { firstName: "María", lastName: "Gómez", email: "maria.demo@borkin.local", color: "#C2410C", serviceNames: ["Masaje 30 minutos"] },
  ];
  for (const item of employeeData) {
    const employee = await prisma.employee.upsert({
      where: { businessId_email: { businessId: business.id, email: item.email } },
      update: { firstName: item.firstName, lastName: item.lastName, color: item.color, active: true, deletedAt: null },
      create: { businessId: business.id, firstName: item.firstName, lastName: item.lastName, email: item.email, color: item.color },
    });
    await prisma.employeeService.createMany({ data: item.serviceNames.map((name) => ({ employeeId: employee.id, serviceId: services.get(name)! })), skipDuplicates: true });
    const ranges = item.firstName === "Juan" ? [[540, 780], [900, 1200]] : [[600, 840], [900, 1140]];
    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek += 1) {
      for (const [startMinute, endMinute] of ranges) {
        await prisma.employeeSchedule.upsert({
          where: { employeeId_dayOfWeek_startMinute_endMinute: { employeeId: employee.id, dayOfWeek, startMinute: startMinute!, endMinute: endMinute! } },
          update: {}, create: { employeeId: employee.id, dayOfWeek, startMinute: startMinute!, endMinute: endMinute! },
        });
      }
    }
  }

  // Clientes demo identificados por email o teléfono normalizado. No existe una
  // restricción unique porque V1 permite confirmar duplicados familiares.
  const clientData = [
    { firstName: "Juan", lastName: "Pérez", phone: "+54 9 351 555 0101", phoneNormalized: "5493515550101", email: "juan.perez@demo.local", emailNormalized: "juan.perez@demo.local", notes: "Prefiere turnos por la tarde." },
    { firstName: "María", lastName: "González", phone: "+54 9 351 555 0102", phoneNormalized: "5493515550102", email: "maria.gonzalez@demo.local", emailNormalized: "maria.gonzalez@demo.local", birthDate: new Date("1992-05-18T00:00:00.000Z") },
    { firstName: "Carlos", lastName: "Fernández", phone: "+54 9 351 555 0103", phoneNormalized: "5493515550103", email: null, emailNormalized: null },
  ];
  for (const item of clientData) {
    const current = await prisma.client.findFirst({ where: { businessId: business.id, OR: [{ phoneNormalized: item.phoneNormalized }, ...(item.emailNormalized ? [{ emailNormalized: item.emailNormalized }] : [])] } });
    if (current) await prisma.client.update({ where: { id: current.id }, data: { ...item, active: true, deletedAt: null } });
    else await prisma.client.create({ data: { businessId: business.id, ...item } });
  }
  const clientCount = await prisma.client.count({ where: { businessId: business.id } });
  console.info(`Seed aplicado para ${business.name}. Usuario administrador: ${process.env.ADMIN_USERNAME}. Clientes: ${clientCount}`);
}

main().finally(async () => prisma.$disconnect());
