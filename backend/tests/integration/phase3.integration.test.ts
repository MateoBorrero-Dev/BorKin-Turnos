import argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

const app = createApp();
const password = "Phase3-Password-2026";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let managerA = ""; let managerB = ""; let readerA = ""; let noneA = "";
let businessA = ""; let businessB = ""; let minimalId = ""; let fullId = ""; let foreignId = "";

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
  const [view, manage] = await Promise.all([
    prisma.permission.create({ data: { code: "clients.view", name: "Ver clientes" } }),
    prisma.permission.create({ data: { code: "clients.manage", name: "Administrar clientes" } }),
  ]);
  for (const suffix of ["a", "b"] as const) {
    const business = await prisma.business.create({ data: { name: `Clientes ${suffix.toUpperCase()}` } });
    const role = await prisma.role.create({ data: { businessId: business.id, code: "MANAGER", name: "Manager" } });
    await prisma.rolePermission.createMany({ data: [{ roleId: role.id, permissionId: view.id }, { roleId: role.id, permissionId: manage.id }] });
    await prisma.user.create({ data: { businessId: business.id, roleId: role.id, username: `manager${suffix}`, email: `manager${suffix}@test.local`, firstName: "Manager", lastName: suffix, passwordHash: await argon2.hash(password) } });
    if (suffix === "a") businessA = business.id; else businessB = business.id;
  }
  const readerRole = await prisma.role.create({ data: { businessId: businessA, code: "READER", name: "Lectura" } });
  const noneRole = await prisma.role.create({ data: { businessId: businessA, code: "NONE", name: "Sin permisos" } });
  await prisma.rolePermission.create({ data: { roleId: readerRole.id, permissionId: view.id } });
  await prisma.user.createMany({ data: [
    { businessId: businessA, roleId: readerRole.id, username: "reader", email: "reader@test.local", firstName: "Reader", lastName: "A", passwordHash: await argon2.hash(password) },
    { businessId: businessA, roleId: noneRole.id, username: "none", email: "none@test.local", firstName: "None", lastName: "A", passwordHash: await argon2.hash(password) },
  ] });
  managerA = (await request(app).post("/api/auth/login").send({ identifier: "managera", password })).body.data.accessToken;
  managerB = (await request(app).post("/api/auth/login").send({ identifier: "managerb", password })).body.data.accessToken;
  readerA = (await request(app).post("/api/auth/login").send({ identifier: "reader", password })).body.data.accessToken;
  noneA = (await request(app).post("/api/auth/login").send({ identifier: "none", password })).body.data.accessToken;
});

afterAll(async () => prisma.$disconnect());

describe("clientes: validación, CRUD lógico y aislamiento", () => {
  it("crea un cliente mínimo sólo con nombre", async () => {
    const response = await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: "Juan", lastName: null, phone: null, email: null, birthDate: null, notes: null });
    expect(response.status).toBe(201); minimalId = response.body.data.id;
    expect(response.body.data).toMatchObject({ firstName: "Juan", lastName: null, phone: null, email: null, active: true });
  });

  it("crea un cliente completo normalizando teléfono, email y DATE", async () => {
    const response = await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: "Ana", lastName: "López", phone: "+54 9 (351) 444-7788", email: "  ANA.Lopez@Example.COM ", birthDate: "1990-08-15", notes: "Prefiere la tarde." });
    expect(response.status).toBe(201); fullId = response.body.data.id;
    expect(response.body.data).toMatchObject({ fullName: "Ana López", phoneNormalized: "5493514447788", email: "ana.lopez@example.com", birthDate: "1990-08-15" });
  });

  it("rechaza email inválido, nacimiento futuro y campos arbitrarios", async () => {
    expect((await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: "Email", email: "incorrecto" })).status).toBe(400);
    expect((await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: "Futuro", birthDate: "2999-01-01" })).status).toBe(400);
    const massAssignment = await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: "Intruso", businessId: businessB, active: false });
    expect(massAssignment.status).toBe(400); expect(massAssignment.body.code).toBe("VALIDATION_ERROR");
  });

  it("edita sólo campos autorizados y audita sin datos sensibles", async () => {
    const response = await request(app).patch(`/api/clients/${minimalId}`).set(auth(managerA)).send({ lastName: "Pérez", notes: "Nota breve" });
    expect(response.status).toBe(200); expect(response.body.data.fullName).toBe("Juan Pérez");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "CLIENT_UPDATED", entityId: minimalId }, orderBy: { createdAt: "desc" } });
    expect(JSON.stringify(audit.metadata)).not.toContain("Nota breve");
  });

  it("desactiva y reactiva sin borrar físicamente", async () => {
    const disabled = await request(app).post(`/api/clients/${minimalId}/disable`).set(auth(managerA));
    expect(disabled.body.data.active).toBe(false);
    expect(await prisma.client.count({ where: { id: minimalId } })).toBe(1);
    const reactivated = await request(app).post(`/api/clients/${minimalId}/reactivate`).set(auth(managerA));
    expect(reactivated.body.data.active).toBe(true);
    expect(await prisma.auditLog.count({ where: { entityId: minimalId, action: { in: ["CLIENT_DISABLED", "CLIENT_REACTIVATED"] } } })).toBe(2);
  });

  it("devuelve 404 para cliente inexistente y valida UUID", async () => {
    expect((await request(app).get("/api/clients/00000000-0000-4000-8000-000000000000").set(auth(managerA))).status).toBe(404);
    expect((await request(app).get("/api/clients/no-es-uuid").set(auth(managerA))).status).toBe(400);
  });

  it("oculta clientes de otro negocio en lectura, edición y estado", async () => {
    const created = await request(app).post("/api/clients").set(auth(managerB)).send({ firstName: "Extranjera", phone: "+54 9 11 2222 3333" });
    foreignId = created.body.data.id;
    expect((await request(app).get(`/api/clients/${foreignId}`).set(auth(managerA))).status).toBe(404);
    expect((await request(app).patch(`/api/clients/${foreignId}`).set(auth(managerA)).send({ firstName: "Intrusión" })).status).toBe(404);
    expect((await request(app).post(`/api/clients/${foreignId}/disable`).set(auth(managerA))).status).toBe(404);
  });
});

describe("clientes: búsqueda, filtros y paginación", () => {
  beforeAll(async () => {
    const rows = [
      { firstName: "BúsquedaNombre", lastName: "Torres", phone: "+54 9 351 700 0001", email: "nombre@busqueda.test" },
      { firstName: "Valentina", lastName: "ApellidoUnico", phone: "+54 9 351 700 0002", email: "valentina@busqueda.test" },
    ];
    for (const row of rows) await request(app).post("/api/clients").set(auth(managerA)).send(row);
    for (let index = 0; index < 12; index += 1) await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: `Paginado${index.toString().padStart(2, "0")}` });
  });

  it.each([
    ["nombre", "BúsquedaNombre", "BúsquedaNombre"],
    ["apellido", "ApellidoUnico", "Valentina"],
    ["nombre completo parcial", "valen apellido", "Valentina"],
    ["teléfono normalizado parcial", "7000001", "BúsquedaNombre"],
    ["email parcial", "nombre@busqueda", "BúsquedaNombre"],
  ])("busca por %s en backend", async (_label, search, expected) => {
    const response = await request(app).get(`/api/clients?search=${encodeURIComponent(search)}&pageSize=20`).set(auth(managerA));
    expect(response.status).toBe(200); expect(response.body.data.items.map((item: { firstName: string }) => item.firstName)).toContain(expected);
  });

  it("pagina con page y pageSize reales", async () => {
    const first = await request(app).get("/api/clients?search=Paginado&page=1&pageSize=5").set(auth(managerA));
    const second = await request(app).get("/api/clients?search=Paginado&page=2&pageSize=5").set(auth(managerA));
    expect(first.body.data.items).toHaveLength(5); expect(first.body.data.meta).toMatchObject({ page: 1, pageSize: 5, total: 12, totalPages: 3 });
    expect(second.body.data.items).toHaveLength(5); expect(second.body.data.items[0].id).not.toBe(first.body.data.items[0].id);
  });

  it("rechaza pageSize superior a 100", async () => {
    const response = await request(app).get("/api/clients?pageSize=101").set(auth(managerA));
    expect(response.status).toBe(400); expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("filtra activos e inactivos", async () => {
    await request(app).post(`/api/clients/${fullId}/disable`).set(auth(managerA));
    const inactive = await request(app).get("/api/clients?status=inactive&pageSize=100").set(auth(managerA));
    const active = await request(app).get("/api/clients?status=active&pageSize=100").set(auth(managerA));
    expect(inactive.body.data.items.map((item: { id: string }) => item.id)).toContain(fullId);
    expect(active.body.data.items.map((item: { id: string }) => item.id)).not.toContain(fullId);
    await request(app).post(`/api/clients/${fullId}/reactivate`).set(auth(managerA));
  });
});

describe("clientes: duplicados con intención explícita", () => {
  let baseId = ""; let otherId = "";
  beforeAll(async () => {
    const base = await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: "Duplicado Base", phone: "+54 9 351 888-0000", email: "duplicado@borkin.test" });
    baseId = base.body.data.id;
    const other = await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: "Otro Cliente", phone: "+54 9 351 888-9999", email: "otro@borkin.test" });
    otherId = other.body.data.id;
  });

  it("detecta teléfono duplicado con respuesta estructurada", async () => {
    const response = await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: "Posible Familiar", phone: "5493518880000" });
    expect(response.status).toBe(409); expect(response.body.code).toBe("POSSIBLE_DUPLICATE");
    expect(response.body.details.matches[0]).toMatchObject({ id: baseId, reasons: ["phone"] });
  });

  it("detecta email duplicado normalizado", async () => {
    const response = await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: "Email Repetido", email: "DUPLICADO@BORKIN.TEST" });
    expect(response.status).toBe(409); expect(response.body.details.matches[0].reasons).toContain("email");
  });

  it("permite el mismo dato en otro negocio sin revelar coincidencias", async () => {
    const response = await request(app).post("/api/clients").set(auth(managerB)).send({ firstName: "Permitido B", phone: "5493518880000", email: "duplicado@borkin.test" });
    expect(response.status).toBe(201); expect((await prisma.client.findUniqueOrThrow({ where: { id: response.body.data.id } })).businessId).toBe(businessB);
  });

  it("permite crear duplicado sólo con forceDuplicate true", async () => {
    const response = await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: "Familiar Confirmado", phone: "5493518880000", forceDuplicate: true });
    expect(response.status).toBe(201);
  });

  it("la edición no se detecta a sí misma", async () => {
    const response = await request(app).patch(`/api/clients/${baseId}`).set(auth(managerA)).send({ firstName: "Duplicado Base Editado", phone: "+54 9 351 888-0000" });
    expect(response.status).toBe(200);
  });

  it("advierte al editar hacia datos fuertes de otro cliente", async () => {
    const response = await request(app).patch(`/api/clients/${otherId}`).set(auth(managerA)).send({ phone: "+54 9 351 888-0000" });
    expect(response.status).toBe(409); expect(response.body.code).toBe("POSSIBLE_DUPLICATE");
  });
});

describe("clientes: permisos y options", () => {
  it("clients.view permite leer pero no administrar", async () => {
    expect((await request(app).get("/api/clients").set(auth(readerA))).status).toBe(200);
    expect((await request(app).post("/api/clients").set(auth(readerA)).send({ firstName: "No permitido" })).status).toBe(403);
  });

  it("clients.manage permite administrar cuando también posee view", async () => {
    expect((await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: "Gestionado" })).status).toBe(201);
  });

  it("usuario sin permiso es rechazado", async () => {
    expect((await request(app).get("/api/clients").set(auth(noneA))).status).toBe(403);
    expect((await request(app).post("/api/clients").set(auth(noneA)).send({ firstName: "No" })).status).toBe(403);
  });

  it("options devuelve sólo activos del negocio y respeta el límite", async () => {
    const inactive = await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: "OptionInactivo" });
    await request(app).post(`/api/clients/${inactive.body.data.id}/disable`).set(auth(managerA));
    await request(app).post("/api/clients").set(auth(managerB)).send({ firstName: "OptionAjeno" });
    for (let index = 0; index < 4; index += 1) await request(app).post("/api/clients").set(auth(managerA)).send({ firstName: `OptionActivo${index}` });
    const response = await request(app).get("/api/clients/options?search=Option&limit=3").set(auth(managerA));
    expect(response.status).toBe(200); expect(response.body.data).toHaveLength(3);
    expect(response.body.data.every((item: { fullName: string }) => item.fullName.startsWith("OptionActivo"))).toBe(true);
    expect(response.body.data[0]).toEqual(expect.objectContaining({ id: expect.any(String), fullName: expect.any(String), phone: null }));
    expect(Object.keys(response.body.data[0]).sort()).toEqual(["fullName", "id", "phone"]);
  });
});
