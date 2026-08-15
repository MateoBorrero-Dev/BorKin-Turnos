import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { DateTime } from "luxon";

const required = ["DATABASE_URL", "ADMIN_USERNAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"] as const;
for (const key of required) if (!process.env[key]) throw new Error(`Falta ${key} para ejecutar el seed.`);
if (process.env.ADMIN_PASSWORD!.length < 12) throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const permissions = [
  "dashboard.view", "appointments.view", "appointments.create", "appointments.edit", "appointments.cancel",
  "clients.view", "clients.manage", "services.manage", "employees.manage", "cash.view", "cash.manage", "cash.open", "cash.close", "cash.movements",
  "payments.charge", "payments.adjust_amount",
  "reports.view", "statistics.view", "audit.view", "settings.manage", "users.manage",
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
  const employeePermissionCodes = new Set(["dashboard.view", "appointments.view", "appointments.create", "appointments.edit", "appointments.cancel", "clients.view", "clients.manage", "cash.view", "cash.open", "cash.close", "payments.charge"]);
  await prisma.rolePermission.createMany({
    data: permissionRows.filter((item) => employeePermissionCodes.has(item.code)).map((permission) => ({ roleId: employeeRole.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

  const passwordHash = await argon2.hash(process.env.ADMIN_PASSWORD!, { type: argon2.argon2id });
  const admin = await prisma.user.upsert({
    where: { businessId_username: { businessId: business.id, username: process.env.ADMIN_USERNAME!.toLowerCase() } },
    update: { email: process.env.ADMIN_EMAIL!.toLowerCase(), passwordHash, roleId: adminRole.id, active: true, deletedAt: null },
    create: {
      businessId: business.id, roleId: adminRole.id, username: process.env.ADMIN_USERNAME!.toLowerCase(),
      email: process.env.ADMIN_EMAIL!.toLowerCase(), passwordHash, firstName: "Administrador", lastName: "BorKin",
    },
  });

  const methods = [
    ["EFECTIVO", "Efectivo", "CASH", 10], ["TRANSFERENCIA", "Transferencia", "TRANSFER", 20], ["DEBITO", "Débito", "DEBIT_CARD", 30],
    ["CREDITO", "Crédito", "CREDIT_CARD", 40], ["MERCADO_PAGO", "Mercado Pago", "OTHER", 50], ["OTRO", "Otro", "OTHER", 60],
  ] as const;
  for (const [code, name, kind, sortOrder] of methods) {
    await prisma.paymentMethod.upsert({
      where: { businessId_code: { businessId: business.id, code } },
      update: { name, kind, isCash: kind === "CASH", sortOrder, active: true },
      create: { businessId: business.id, code, name, kind, isCash: kind === "CASH", sortOrder },
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
  const employees = new Map<string, string>();
  for (const item of employeeData) {
    const employee = await prisma.employee.upsert({
      where: { businessId_email: { businessId: business.id, email: item.email } },
      update: { firstName: item.firstName, lastName: item.lastName, color: item.color, active: true, deletedAt: null },
      create: { businessId: business.id, firstName: item.firstName, lastName: item.lastName, email: item.email, color: item.color },
    });
    employees.set(item.firstName, employee.id);
    await prisma.employeeService.createMany({ data: item.serviceNames.map((name) => ({ employeeId: employee.id, serviceId: services.get(name)! })), skipDuplicates: true });
    const ranges = item.firstName === "Juan" ? [[540, 780], [900, 1200]] : [[600, 840], [900, 1140]];
    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek += 1) {
      for (const [startMinute, endMinute] of ranges) {
        const existingRange = await prisma.employeeSchedule.findFirst({ where: { employeeId: employee.id, dayOfWeek, startMinute: { lt: endMinute! }, endMinute: { gt: startMinute! } }, select: { id: true } });
        if (!existingRange) await prisma.employeeSchedule.create({ data: { employeeId: employee.id, dayOfWeek, startMinute: startMinute!, endMinute: endMinute! } });
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
  const clients = new Map<string, string>();
  for (const item of clientData) {
    const current = await prisma.client.findFirst({ where: { businessId: business.id, OR: [{ phoneNormalized: item.phoneNormalized }, ...(item.emailNormalized ? [{ emailNormalized: item.emailNormalized }] : [])] } });
    const saved = current ? await prisma.client.update({ where: { id: current.id }, data: { ...item, active: true, deletedAt: null } }) : await prisma.client.create({ data: { businessId: business.id, ...item } });
    clients.set(item.firstName, saved.id);
  }

  const zone = business.timezone;
  const today = DateTime.now().setZone(zone).startOf("day");
  const nextMonday = today.plus({ days: ((8 - today.weekday) % 7) || 7 });
  const appointmentSeed = [
    { key: "juan-corte", client: "Juan", employee: "Juan", service: "Corte", day: 0, time: "10:00", status: "PENDIENTE" as const },
    { key: "maria-masaje", client: "María", employee: "María", service: "Masaje 30 minutos", day: 1, time: "10:30", status: "CONFIRMADO" as const },
    { key: "carlos-barba", client: "Carlos", employee: "Juan", service: "Barba", day: 2, time: "16:00", status: "PENDIENTE" as const },
  ];
  for (const item of appointmentSeed) {
    const notes = `Seed Fase 4: ${item.key}`;
    const existing = await prisma.appointment.findFirst({ where: { businessId: business.id, notes } });
    if (existing) continue;
    const service = await prisma.service.findUniqueOrThrow({ where: { id: services.get(item.service)! } });
    const start = DateTime.fromISO(`${nextMonday.plus({ days: item.day }).toISODate()}T${item.time}`, { zone });
    const created = await prisma.appointment.create({ data: { businessId: business.id, clientId: clients.get(item.client)!, serviceId: service.id, employeeId: employees.get(item.employee)!, createdById: admin.id, startAt: start.toUTC().toJSDate(), endAt: start.plus({ minutes: service.durationMinutes }).toUTC().toJSDate(), durationMinutes: service.durationMinutes, serviceName: service.name, price: service.price, status: item.status, notes } });
    await prisma.appointmentStatusEvent.create({ data: { businessId: business.id, appointmentId: created.id, userId: admin.id, toStatus: item.status, reason: "Turno demo creado por seed" } });
  }
  const clientCount = await prisma.client.count({ where: { businessId: business.id } });
  console.info(`Seed aplicado para ${business.name}. Usuario administrador: ${process.env.ADMIN_USERNAME}. Clientes: ${clientCount}`);
}

main().finally(async () => prisma.$disconnect());
