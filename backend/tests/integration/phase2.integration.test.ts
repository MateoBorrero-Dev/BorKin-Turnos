import argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

const app = createApp();
const password = "Phase2-Admin-Password-2026";
let tokenA = ""; let tokenB = ""; let tokenLimited = "";
let categoryA = ""; let categoryB = ""; let inactiveCategoryA = ""; let serviceA = ""; let serviceB = ""; let employeeA = ""; let employeeB = "";
let uploadedLogoUrl = "";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function resetDatabase() {
  await prisma.cashMovement.deleteMany(); await prisma.payment.deleteMany(); await prisma.cashRegister.deleteMany();
  await prisma.appointmentStatusEvent.deleteMany(); await prisma.appointment.deleteMany(); await prisma.scheduleBlock.deleteMany();
  await prisma.employeeSchedule.deleteMany(); await prisma.employeeService.deleteMany(); await prisma.service.deleteMany();
  await prisma.serviceCategory.deleteMany(); await prisma.employee.deleteMany(); await prisma.client.deleteMany();
  await prisma.refreshSession.deleteMany(); await prisma.auditLog.deleteMany(); await prisma.userPermission.deleteMany();
  await prisma.rolePermission.deleteMany(); await prisma.user.deleteMany(); await prisma.role.deleteMany();
  await prisma.permission.deleteMany(); await prisma.paymentMethod.deleteMany(); await prisma.appSetting.deleteMany(); await prisma.business.deleteMany();
}

beforeAll(async () => {
  await resetDatabase();
  const permissions = await Promise.all(["settings.manage", "services.manage", "employees.manage"].map((code) => prisma.permission.create({ data: { code, name: code } })));
  for (const suffix of ["a", "b"] as const) {
    const business = await prisma.business.create({ data: { name: `Negocio ${suffix.toUpperCase()}` } });
    const role = await prisma.role.create({ data: { businessId: business.id, code: "ADMIN", name: "Administrador" } });
    await prisma.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })) });
    await prisma.user.create({ data: { businessId: business.id, roleId: role.id, username: `admin${suffix}`, email: `admin${suffix}@test.local`, firstName: "Admin", lastName: suffix.toUpperCase(), passwordHash: await argon2.hash(password) } });
    const category = await prisma.serviceCategory.create({ data: { businessId: business.id, name: `Categoría ${suffix.toUpperCase()}` } });
    const service = await prisma.service.create({ data: { businessId: business.id, categoryId: category.id, name: `Servicio ${suffix.toUpperCase()}`, price: "10.50", durationMinutes: 30 } });
    const employee = await prisma.employee.create({ data: { businessId: business.id, firstName: "Profesional", lastName: suffix.toUpperCase(), email: `pro${suffix}@test.local` } });
    if (suffix === "a") { categoryA = category.id; serviceA = service.id; employeeA = employee.id; }
    else { categoryB = category.id; serviceB = service.id; employeeB = employee.id; }
  }
  const businessA = await prisma.business.findFirstOrThrow({ where: { name: "Negocio A" } });
  inactiveCategoryA = (await prisma.serviceCategory.create({ data: { businessId: businessA.id, name: "Categoría inactiva A", active: false } })).id;
  const limitedRole = await prisma.role.create({ data: { businessId: businessA.id, code: "LIMITED", name: "Limitado" } });
  await prisma.user.create({ data: { businessId: businessA.id, roleId: limitedRole.id, username: "limited", email: "limited@test.local", firstName: "Sin", lastName: "Permisos", passwordHash: await argon2.hash(password) } });
  tokenA = (await request(app).post("/api/auth/login").send({ identifier: "admina", password })).body.data.accessToken;
  tokenB = (await request(app).post("/api/auth/login").send({ identifier: "adminb", password })).body.data.accessToken;
  tokenLimited = (await request(app).post("/api/auth/login").send({ identifier: "limited", password })).body.data.accessToken;
});

afterAll(async () => prisma.$disconnect());

describe("configuración del negocio", () => {
  it("lee sólo la configuración de la sesión", async () => { const response = await request(app).get("/api/settings/business").set(auth(tokenA)); expect(response.status).toBe(200); expect(response.body.data.name).toBe("Negocio A"); });
  it("modifica y audita configuración", async () => { const response = await request(app).patch("/api/settings/business").set(auth(tokenA)).send({ name: "Negocio A actualizado", primaryColor: "#123ABC", locale: "es-AR", timezone: "America/Argentina/Cordoba" }); expect(response.status).toBe(200); expect(response.body.data.primaryColor).toBe("#123ABC"); expect(await prisma.auditLog.count({ where: { action: "BUSINESS_SETTINGS_UPDATED" } })).toBe(1); });
  it("rechaza valores inválidos", async () => { expect((await request(app).patch("/api/settings/business").set(auth(tokenA)).send({ timezone: "Zona/Inexistente" })).status).toBe(400); expect((await request(app).patch("/api/settings/business").set(auth(tokenA)).send({ primaryColor: "blue" })).status).toBe(400); });
  it("exige permiso backend", async () => { expect((await request(app).get("/api/settings/business").set(auth(tokenLimited))).status).toBe(403); });
  it("valida la firma real de una imagen", async () => { const response = await request(app).put("/api/settings/business/logo").set(auth(tokenA)).attach("logo", Buffer.from("no es png"), { filename: "fraude.png", contentType: "image/png" }); expect(response.status).toBe(400); expect(response.body.code).toBe("INVALID_IMAGE"); });
  it("sube un logo PNG válido y lo persiste", async () => { const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]); const response = await request(app).put("/api/settings/business/logo").set(auth(tokenA)).attach("logo", png, { filename: "logo.png", contentType: "image/png" }); expect(response.status).toBe(200); expect(response.body.data.logoUrl).toMatch(/^\/uploads\/business\/[0-9a-f-]+\.png$/); uploadedLogoUrl = response.body.data.logoUrl; expect((await prisma.business.findUniqueOrThrow({ where: { id: response.body.data.id } })).logoUrl).toBe(response.body.data.logoUrl); });
  it("sirve uploads con Content-Type y CORP compatibles con el frontend", async () => { const response = await request(app).get(uploadedLogoUrl); expect(response.status).toBe(200); expect(response.headers["content-type"]).toMatch(/^image\/png/); expect(response.headers["cross-origin-resource-policy"]).toBe("cross-origin"); expect(response.headers["cross-origin-resource-policy"]).not.toBe("same-origin"); const apiResponse = await request(app).get("/api/health"); expect(apiResponse.headers["cross-origin-resource-policy"]).toBe("same-origin"); });
  it("rechaza una imagen mayor a 2 MB", async () => { const oversized = Buffer.alloc(2_000_001, 0); oversized.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]); const response = await request(app).put("/api/settings/business/logo").set(auth(tokenA)).attach("logo", oversized, { filename: "grande.png", contentType: "image/png" }); expect(response.status).toBe(413); expect(response.body.code).toBe("FILE_TOO_LARGE"); });
});

describe("categorías y servicios", () => {
  it("crea, edita y desactiva una categoría", async () => { const created = await request(app).post("/api/service-categories").set(auth(tokenA)).send({ name: "Coloración", description: "Tintes" }); expect(created.status).toBe(201); const edited = await request(app).patch(`/api/service-categories/${created.body.data.id}`).set(auth(tokenA)).send({ description: "Tintes profesionales" }); expect(edited.body.data.description).toBe("Tintes profesionales"); const disabled = await request(app).patch(`/api/service-categories/${created.body.data.id}`).set(auth(tokenA)).send({ active: false }); expect(disabled.body.data.active).toBe(false); });
  it("no permite editar categorías ajenas", async () => { expect((await request(app).patch(`/api/service-categories/${categoryB}`).set(auth(tokenA)).send({ name: "Intrusión" })).status).toBe(404); });
  it("crea un servicio preservando Decimal", async () => { const response = await request(app).post("/api/services").set(auth(tokenA)).send({ name: "Servicio decimal", categoryId: categoryA, price: "1234.56", durationMinutes: 45, color: "#112233" }); expect(response.status).toBe(201); expect(response.body.data.price).toBe("1234.56"); serviceA = response.body.data.id; expect((await prisma.service.findUniqueOrThrow({ where: { id: serviceA } })).price.toFixed(2)).toBe("1234.56"); });
  it("edita y desactiva un servicio", async () => { expect((await request(app).patch(`/api/services/${serviceA}`).set(auth(tokenA)).send({ durationMinutes: 60 })).body.data.durationMinutes).toBe(60); expect((await request(app).patch(`/api/services/${serviceA}`).set(auth(tokenA)).send({ active: false })).body.data.active).toBe(false); });
  it("rechaza duración inválida y categoría ajena", async () => { expect((await request(app).post("/api/services").set(auth(tokenA)).send({ name: "Inválido", price: "1.00", durationMinutes: 0, color: "#112233" })).status).toBe(400); expect((await request(app).post("/api/services").set(auth(tokenA)).send({ name: "Ajeno", categoryId: categoryB, price: "1.00", durationMinutes: 10, color: "#112233" })).status).toBe(400); });
  it("rechaza crear un servicio con una categoría inactiva", async () => { const response = await request(app).post("/api/services").set(auth(tokenA)).send({ name: "Categoría inactiva al crear", categoryId: inactiveCategoryA, price: "100.00", durationMinutes: 30, color: "#112233" }); expect(response.status).toBe(400); expect(response.body.code).toBe("INVALID_CATEGORY"); });
  it("rechaza asignar una categoría inactiva al editar un servicio", async () => { const response = await request(app).patch(`/api/services/${serviceA}`).set(auth(tokenA)).send({ categoryId: inactiveCategoryA }); expect(response.status).toBe(400); expect(response.body.code).toBe("INVALID_CATEGORY"); });
  it("oculta servicios de otro negocio", async () => { expect((await request(app).get(`/api/services/${serviceB}`).set(auth(tokenA))).status).toBe(404); });
});

describe("profesionales y asignaciones", () => {
  it("sube una foto PNG válida para un profesional", async () => { const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]); const response = await request(app).put(`/api/employees/${employeeA}/photo`).set(auth(tokenA)).attach("photo", png, { filename: "foto.png", contentType: "image/png" }); expect(response.status).toBe(200); expect(response.body.data.photoUrl).toMatch(/^\/uploads\/employees\/[0-9a-f-]+\.png$/); expect((await prisma.employee.findUniqueOrThrow({ where: { id: employeeA } })).photoUrl).toBe(response.body.data.photoUrl); });
  it("crea, edita y desactiva profesional", async () => { const created = await request(app).post("/api/employees").set(auth(tokenA)).send({ firstName: "Julia", lastName: "Test", email: "julia@test.local", color: "#445566" }); expect(created.status).toBe(201); employeeA = created.body.data.id; expect((await request(app).patch(`/api/employees/${employeeA}`).set(auth(tokenA)).send({ phone: "123" })).body.data.phone).toBe("123"); expect((await request(app).patch(`/api/employees/${employeeA}`).set(auth(tokenA)).send({ active: false })).body.data.active).toBe(false); });
  it("no lee ni modifica profesional ajeno", async () => { expect((await request(app).get(`/api/employees/${employeeB}`).set(auth(tokenA))).status).toBe(404); expect((await request(app).patch(`/api/employees/${employeeB}`).set(auth(tokenA)).send({ active: false })).status).toBe(404); });
  it("asigna servicios propios", async () => { const ownService = await prisma.service.findFirstOrThrow({ where: { business: { name: "Negocio A actualizado" }, active: true, deletedAt: null } }); const response = await request(app).put(`/api/employees/${employeeA}/services`).set(auth(tokenA)).send({ serviceIds: [ownService.id] }); expect(response.status).toBe(200); expect(response.body.data).toHaveLength(1); });
  it("rechaza servicio y profesional ajenos", async () => { expect((await request(app).put(`/api/employees/${employeeA}/services`).set(auth(tokenA)).send({ serviceIds: [serviceB] })).status).toBe(404); expect((await request(app).put(`/api/employees/${employeeB}/services`).set(auth(tokenA)).send({ serviceIds: [] })).status).toBe(404); });
  it("rechaza asignar un servicio inactivo", async () => { const response = await request(app).put(`/api/employees/${employeeA}/services`).set(auth(tokenA)).send({ serviceIds: [serviceA] }); expect(response.status).toBe(404); expect(response.body.code).toBe("SERVICE_NOT_FOUND"); });
});

describe("horarios laborales", () => {
  const put = (intervals: unknown[]) => request(app).put(`/api/employees/${employeeA}/schedules`).set(auth(tokenA)).send({ intervals });
  it("acepta un intervalo válido", async () => expect((await put([{ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" }])).status).toBe(200));
  it("acepta varios intervalos separados", async () => expect((await put([{ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" }, { dayOfWeek: 1, startTime: "15:00", endTime: "20:00" }])).body.data).toHaveLength(2));
  it("rechaza inicio posterior o igual", async () => { expect((await put([{ dayOfWeek: 1, startTime: "14:00", endTime: "13:00" }])).status).toBe(400); expect((await put([{ dayOfWeek: 1, startTime: "13:00", endTime: "13:00" }])).status).toBe(400); });
  it("rechaza solapamiento parcial y total", async () => { expect((await put([{ dayOfWeek: 1, startTime: "09:00", endTime: "14:00" }, { dayOfWeek: 1, startTime: "13:00", endTime: "18:00" }])).status).toBe(409); expect((await put([{ dayOfWeek: 1, startTime: "09:00", endTime: "18:00" }, { dayOfWeek: 1, startTime: "10:00", endTime: "12:00" }])).status).toBe(409); });
  it("permite adyacencia y otro día", async () => { const response = await put([{ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" }, { dayOfWeek: 1, startTime: "13:00", endTime: "18:00" }, { dayOfWeek: 2, startTime: "10:00", endTime: "12:00" }]); expect(response.status).toBe(200); expect(response.body.data).toHaveLength(3); });
  it("permite el mismo horario para otro profesional", async () => expect((await request(app).put(`/api/employees/${employeeB}/schedules`).set(auth(tokenB)).send({ intervals: [{ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" }] })).status).toBe(200));
  it("rechaza modificar horarios de profesional ajeno", async () => expect((await request(app).put(`/api/employees/${employeeB}/schedules`).set(auth(tokenA)).send({ intervals: [] })).status).toBe(404));
});

describe("bloqueos de agenda", () => {
  it("crea intervalo, día completo y rango", async () => { const inputs = [{ type: "INTERVAL", employeeId: employeeA, date: "2026-08-11", startTime: "13:00", endTime: "15:00", reason: "ALMUERZO" }, { type: "FULL_DAY", employeeId: employeeA, date: "2026-08-15", reason: "AUSENCIA" }, { type: "DATE_RANGE", employeeId: employeeA, startDate: "2026-08-20", endDate: "2026-08-30", reason: "VACACIONES" }]; for (const input of inputs) expect((await request(app).post("/api/schedule-blocks").set(auth(tokenA)).send(input)).status).toBe(201); expect((await request(app).get(`/api/schedule-blocks?employeeId=${employeeA}`).set(auth(tokenA))).body.data).toHaveLength(3); });
  it("rechaza fechas u horas inválidas", async () => { expect((await request(app).post("/api/schedule-blocks").set(auth(tokenA)).send({ type: "INTERVAL", employeeId: employeeA, date: "2026-08-11", startTime: "15:00", endTime: "13:00", reason: "DESCANSO" })).status).toBe(400); expect((await request(app).post("/api/schedule-blocks").set(auth(tokenA)).send({ type: "FULL_DAY", employeeId: employeeA, date: "2026-99-99", reason: "DESCANSO" })).status).toBe(400); });
  it("rechaza profesional ajeno sin revelar su existencia", async () => expect((await request(app).post("/api/schedule-blocks").set(auth(tokenA)).send({ type: "FULL_DAY", employeeId: employeeB, date: "2026-08-15", reason: "AUSENCIA" })).status).toBe(404));
});
