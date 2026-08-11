import argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

const adminPassword = "Admin-Test-Password-2026";
const employeePassword = "Employee-Test-Password-2026";
let employeeRoleId: string;

beforeAll(async () => {
  await prisma.refreshSession.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.business.deleteMany();

  const business = await prisma.business.create({ data: { name: "BorKin Test" } });
  const usersPermission = await prisma.permission.create({ data: { code: "users.manage", name: "Administrar usuarios" } });
  const dashboardPermission = await prisma.permission.create({ data: { code: "dashboard.view", name: "Ver inicio" } });
  const adminRole = await prisma.role.create({ data: { businessId: business.id, code: "ADMIN", name: "Administrador", isSystem: true } });
  const employeeRole = await prisma.role.create({ data: { businessId: business.id, code: "EMPLEADO", name: "Empleado", isSystem: true } });
  employeeRoleId = employeeRole.id;
  await prisma.rolePermission.createMany({ data: [
    { roleId: adminRole.id, permissionId: usersPermission.id },
    { roleId: adminRole.id, permissionId: dashboardPermission.id },
    { roleId: employeeRole.id, permissionId: dashboardPermission.id },
  ] });
  await prisma.user.createMany({ data: [
    { businessId: business.id, roleId: adminRole.id, username: "admin", email: "admin@test.local", firstName: "Admin", lastName: "Test", passwordHash: await argon2.hash(adminPassword) },
    { businessId: business.id, roleId: employeeRole.id, username: "empleado", email: "empleado@test.local", firstName: "Empleado", lastName: "Test", passwordHash: await argon2.hash(employeePassword) },
  ] });
});

afterAll(async () => prisma.$disconnect());

describe("autenticación, sesiones y autorización", () => {
  const app = createApp();

  it("rechaza credenciales inválidas sin filtrar información", async () => {
    const response = await request(app).post("/api/auth/login").send({ identifier: "admin", password: "incorrecta" });
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, code: "INVALID_CREDENTIALS" });
  });

  it("inicia sesión y entrega access token más refresh cookie HttpOnly", async () => {
    const response = await request(app).post("/api/auth/login").set("User-Agent", "BorKin integration test").send({ identifier: "admin", password: adminPassword });
    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.user.permissions).toContain("users.manage");
    const cookies = response.headers["set-cookie"] as unknown as string[];
    expect(cookies[0]).toContain("borkin_refresh=");
    expect(cookies[0]).toContain("HttpOnly");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "LOGIN", userId: response.body.data.user.id }, orderBy: { createdAt: "desc" } });
    expect(audit.metadata).toEqual({ userAgent: "BorKin integration test" });
  });

  it("protege las rutas sin access token", async () => {
    const response = await request(app).get("/api/users");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_REQUIRED");
  });

  it("valida permisos en backend", async () => {
    const login = await request(app).post("/api/auth/login").send({ identifier: "empleado", password: employeePassword });
    const response = await request(app).get("/api/users").set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  it("permite al administrador consultar roles, permisos y usuarios", async () => {
    const login = await request(app).post("/api/auth/login").send({ identifier: "admin", password: adminPassword });
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };
    const [users, roles, permissions] = await Promise.all([
      request(app).get("/api/users").set(auth),
      request(app).get("/api/access/roles").set(auth),
      request(app).get("/api/access/permissions").set(auth),
    ]);
    expect(users.status).toBe(200);
    expect(roles.body.data).toHaveLength(2);
    expect(permissions.body.data.map((item: { code: string }) => item.code)).toContain("users.manage");
    expect(JSON.stringify(users.body)).not.toContain("passwordHash");
  });

  it("rota refresh tokens y detecta reutilización", async () => {
    const login = await request(app).post("/api/auth/login").send({ identifier: "admin", password: adminPassword });
    const oldCookie = (login.headers["set-cookie"] as unknown as string[])[0]!.split(";")[0]!;
    const rotated = await request(app).post("/api/auth/refresh").set("Origin", "http://localhost:5173").set("Cookie", oldCookie);
    expect(rotated.status).toBe(200);
    const newCookie = (rotated.headers["set-cookie"] as unknown as string[])[0]!.split(";")[0]!;
    expect(newCookie).not.toBe(oldCookie);
    const reused = await request(app).post("/api/auth/refresh").set("Origin", "http://localhost:5173").set("Cookie", oldCookie);
    expect(reused.status).toBe(401);
    expect(reused.body.code).toBe("REFRESH_REUSE_DETECTED");
    const familyRevoked = await request(app).post("/api/auth/refresh").set("Origin", "http://localhost:5173").set("Cookie", newCookie);
    expect(familyRevoked.status).toBe(401);
  });

  it("cierra sesión e invalida el refresh token", async () => {
    const agent = request.agent(app);
    expect((await agent.post("/api/auth/login").send({ identifier: "admin", password: adminPassword })).status).toBe(200);
    expect((await agent.post("/api/auth/logout").set("Origin", "http://localhost:5173")).status).toBe(204);
    expect((await agent.post("/api/auth/refresh").set("Origin", "http://localhost:5173")).status).toBe(401);
  });

  it("crea un usuario real y conserva los datos al recrear el backend", async () => {
    const login = await request(app).post("/api/auth/login").send({ identifier: "admin", password: adminPassword });
    const created = await request(app).post("/api/users").set("Authorization", `Bearer ${login.body.data.accessToken}`).send({
      username: "persistente", email: "persistente@test.local", firstName: "Usuario", lastName: "Persistente",
      password: "Persistent-Password-2026", roleId: employeeRoleId, permissionOverrides: [],
    });
    expect(created.status).toBe(201);
    expect(created.body.data.roleId).toBe(employeeRoleId);

    const restartedApp = createApp();
    const persistedLogin = await request(restartedApp).post("/api/auth/login").send({ identifier: "persistente", password: "Persistent-Password-2026" });
    expect(persistedLogin.status).toBe(200);
    expect(persistedLogin.body.data.user.username).toBe("persistente");
  });

  it("restablece contraseña y revoca sesiones existentes", async () => {
    const admin = await request(app).post("/api/auth/login").send({ identifier: "admin", password: adminPassword });
    const employee = await prisma.user.findFirstOrThrow({ where: { username: "empleado" } });
    const oldSession = request.agent(app);
    await oldSession.post("/api/auth/login").send({ identifier: "empleado", password: employeePassword });
    const reset = await request(app).post(`/api/users/${employee.id}/reset-password`).set("Authorization", `Bearer ${admin.body.data.accessToken}`).send({ password: "New-Employee-Password-2026" });
    expect(reset.status).toBe(204);
    expect((await oldSession.post("/api/auth/refresh").set("Origin", "http://localhost:5173")).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ identifier: "empleado", password: employeePassword })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ identifier: "empleado", password: "New-Employee-Password-2026" })).status).toBe(200);
  });
});
