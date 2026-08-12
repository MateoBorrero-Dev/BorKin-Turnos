import argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

const app = createApp(); const password = "Phase5-Password-2026"; const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let token = ""; let foreignToken = ""; let employeeToken = ""; let limitedToken = ""; let businessId = ""; let foreignBusinessId = ""; let adminId = ""; let clientId = ""; let foreignClientId = ""; let serviceId = ""; let employeeId = ""; let cashMethodId = ""; let transferMethodId = ""; let debitMethodId = ""; let inactiveMethodId = "";

async function resetAll() {
  await prisma.cashMovement.deleteMany(); await prisma.payment.deleteMany(); await prisma.cashRegister.deleteMany(); await prisma.appointmentStatusEvent.deleteMany(); await prisma.appointment.deleteMany(); await prisma.scheduleBlock.deleteMany(); await prisma.employeeSchedule.deleteMany(); await prisma.employeeService.deleteMany(); await prisma.service.deleteMany(); await prisma.serviceCategory.deleteMany(); await prisma.employee.deleteMany(); await prisma.client.deleteMany(); await prisma.refreshSession.deleteMany(); await prisma.auditLog.deleteMany(); await prisma.userPermission.deleteMany(); await prisma.rolePermission.deleteMany(); await prisma.user.deleteMany(); await prisma.role.deleteMany(); await prisma.permission.deleteMany(); await prisma.paymentMethod.deleteMany(); await prisma.appSetting.deleteMany(); await prisma.business.deleteMany();
}

async function resetFinancial() {
  await prisma.cashMovement.deleteMany(); await prisma.payment.deleteMany(); await prisma.cashRegister.deleteMany(); await prisma.appointmentStatusEvent.deleteMany(); await prisma.appointment.deleteMany(); await prisma.auditLog.deleteMany();
}

async function appointment(status: "EN_CURSO" | "CANCELADO" | "AUSENTE" | "COMPLETADO" = "EN_CURSO", amount = "5000.00", foreign = false) {
  const targetBusiness = foreign ? foreignBusinessId : businessId; const targetClient = foreign ? foreignClientId : clientId;
  const fixtureService = foreign ? await prisma.service.findFirstOrThrow({ where: { businessId: foreignBusinessId } }) : await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
  const fixtureEmployee = foreign ? await prisma.employee.findFirstOrThrow({ where: { businessId: foreignBusinessId } }) : await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
  const fixtureUser = foreign ? await prisma.user.findFirstOrThrow({ where: { businessId: foreignBusinessId } }) : await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
  const created = await prisma.appointment.create({ data: { businessId: targetBusiness, clientId: targetClient, serviceId: fixtureService.id, employeeId: fixtureEmployee.id, createdById: fixtureUser.id, startAt: new Date(`2026-09-${String(10 + await prisma.appointment.count()).padStart(2, "0")}T12:00:00Z`), endAt: new Date(`2026-09-${String(10 + await prisma.appointment.count()).padStart(2, "0")}T12:30:00Z`), durationMinutes: 30, serviceName: fixtureService.name, price: amount, status, completedAt: status === "COMPLETADO" ? new Date() : null } });
  await prisma.appointmentStatusEvent.create({ data: { businessId: targetBusiness, appointmentId: created.id, userId: fixtureUser.id, toStatus: status, reason: "Fixture Fase 5" } });
  return created;
}

async function open(amount = "10000.00", useToken = token) { return request(app).post("/api/cash/open").set(auth(useToken)).send({ openingAmount: amount, notes: "Apertura test" }); }
async function charge(id: string, methodId = cashMethodId, amount = "5000.00", useToken = token, adjustmentReason?: string) { return request(app).post(`/api/appointments/${id}/charge`).set(auth(useToken)).send({ paymentMethodId: methodId, amount, ...(adjustmentReason ? { adjustmentReason } : {}) }); }
async function movement(kind: "income" | "expense" | "withdrawal", amount: string, reason = "Movimiento test") { return request(app).post(`/api/cash/${kind}`).set(auth(token)).send({ amount, reason }); }

beforeAll(async () => {
  await resetAll();
  const permissionCodes = ["cash.view", "cash.open", "cash.close", "cash.movements", "payments.charge", "payments.adjust_amount", "appointments.view", "appointments.edit", "clients.view"];
  const permissions = await Promise.all(permissionCodes.map((code) => prisma.permission.create({ data: { code, name: code } })));
  for (const suffix of ["A", "B"] as const) {
    const business = await prisma.business.create({ data: { name: `Caja ${suffix}`, timezone: "America/Argentina/Cordoba" } });
    const role = await prisma.role.create({ data: { businessId: business.id, code: "ADMIN", name: "Admin" } });
    await prisma.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })) });
    const user = await prisma.user.create({ data: { businessId: business.id, roleId: role.id, username: `caja${suffix.toLowerCase()}`, email: `caja${suffix.toLowerCase()}@test.local`, firstName: "Caja", lastName: suffix, passwordHash: await argon2.hash(password) } });
    const client = await prisma.client.create({ data: { businessId: business.id, firstName: `Cliente ${suffix}` } });
    const category = await prisma.serviceCategory.create({ data: { businessId: business.id, name: `Categoría ${suffix}` } });
    const service = await prisma.service.create({ data: { businessId: business.id, categoryId: category.id, name: `Servicio ${suffix}`, price: "5000.00", durationMinutes: 30 } });
    const employee = await prisma.employee.create({ data: { businessId: business.id, firstName: "Profesional", lastName: suffix } });
    await prisma.employeeService.create({ data: { employeeId: employee.id, serviceId: service.id } });
    if (suffix === "A") { businessId = business.id; adminId = user.id; clientId = client.id; serviceId = service.id; employeeId = employee.id; }
    else { foreignBusinessId = business.id; foreignClientId = client.id; }
    const methodData = suffix === "A" ? [
      { code: "CASH_TEST", name: "Caja física", kind: "CASH" as const, isCash: true, active: true },
      { code: "TRANSFER_TEST", name: "Efectivo falso", kind: "TRANSFER" as const, isCash: false, active: true },
      { code: "DEBIT_TEST", name: "Débito", kind: "DEBIT_CARD" as const, isCash: false, active: true },
      { code: "INACTIVE", name: "Inactivo", kind: "CREDIT_CARD" as const, isCash: false, active: false },
    ] : [{ code: "FOREIGN", name: "Ajeno", kind: "CASH" as const, isCash: true, active: true }];
    const methods = await Promise.all(methodData.map((data) => prisma.paymentMethod.create({ data: { businessId: business.id, ...data } })));
    if (suffix === "A") { cashMethodId = methods[0]!.id; transferMethodId = methods[1]!.id; debitMethodId = methods[2]!.id; inactiveMethodId = methods[3]!.id; }
  }
  const employeePermissions = permissions.filter((item) => ["cash.view", "payments.charge", "appointments.view", "appointments.edit"].includes(item.code));
  const employeeRole = await prisma.role.create({ data: { businessId, code: "EMPLOYEE", name: "Empleado" } }); await prisma.rolePermission.createMany({ data: employeePermissions.map((permission) => ({ roleId: employeeRole.id, permissionId: permission.id })) });
  await prisma.user.create({ data: { businessId, roleId: employeeRole.id, username: "cashier", email: "cashier@test.local", firstName: "Empleado", lastName: "Caja", passwordHash: await argon2.hash(password) } });
  const limitedRole = await prisma.role.create({ data: { businessId, code: "LIMITED", name: "Limitado" } }); await prisma.user.create({ data: { businessId, roleId: limitedRole.id, username: "limitedcash", email: "limitedcash@test.local", firstName: "Sin", lastName: "Permisos", passwordHash: await argon2.hash(password) } });
  token = (await request(app).post("/api/auth/login").send({ identifier: "cajaa", password })).body.data.accessToken; foreignToken = (await request(app).post("/api/auth/login").send({ identifier: "cajab", password })).body.data.accessToken; employeeToken = (await request(app).post("/api/auth/login").send({ identifier: "cashier", password })).body.data.accessToken; limitedToken = (await request(app).post("/api/auth/login").send({ identifier: "limitedcash", password })).body.data.accessToken;
});
beforeEach(resetFinancial);
afterAll(async () => prisma.$disconnect());

describe("apertura, permisos y aislamiento", () => {
  it("abre con cero y persiste usuario, nota y Decimal", async () => { const response = await open("0"); expect(response.status).toBe(201); expect(response.body.data).toMatchObject({ status: "ABIERTA", openingAmount: "0.00", openingNotes: "Apertura test" }); expect(response.body.data.openedBy.id).toBe(adminId); });
  it("abre con monto válido y rechaza negativo o más de dos decimales", async () => { expect((await open("25500.50")).status).toBe(201); await resetFinancial(); for (const amount of ["-1", "12.345"]) expect((await open(amount)).status).toBe(400); });
  it("rechaza una segunda caja y traduce el conflicto", async () => { await open(); const response = await open(); expect(response.status).toBe(409); expect(response.body.code).toBe("CASH_ALREADY_OPEN"); });
  it("serializa dos aperturas simultáneas y deja una sola OPEN", async () => { const responses = await Promise.all([open(), open()]); expect(responses.map((item) => item.status).sort()).toEqual([201, 409]); expect(await prisma.cashRegister.count({ where: { businessId, status: "ABIERTA" } })).toBe(1); });
  it("aísla negocios y exige permisos específicos", async () => { await open(); expect((await request(app).get("/api/cash/current").set(auth(foreignToken))).body.data).toBeNull(); expect((await request(app).get("/api/cash/current").set(auth(limitedToken))).status).toBe(403); expect((await request(app).post("/api/cash/open").set(auth(limitedToken)).send({ openingAmount: "0" })).status).toBe(403); expect((await request(app).post("/api/cash/close").set(auth(limitedToken)).send({ countedCash: "0" })).status).toBe(403); expect((await request(app).post("/api/cash/income").set(auth(limitedToken)).send({ amount: "1", reason: "x" })).status).toBe(403); });
});

describe("cobro atómico e integridad", () => {
  it("crea Payment + SALE + COMPLETADO + StatusEvent en una transacción", async () => { await open(); const turn = await appointment(); const response = await charge(turn.id); expect(response.status).toBe(201); expect(response.body.data.status).toBe("COMPLETADO"); expect(response.body.data.payments).toHaveLength(1); expect(await prisma.payment.count({ where: { appointmentId: turn.id, status: "REGISTRADO" } })).toBe(1); expect(await prisma.cashMovement.count({ where: { payment: { appointmentId: turn.id }, type: "VENTA" } })).toBe(1); expect(await prisma.appointmentStatusEvent.count({ where: { appointmentId: turn.id, toStatus: "COMPLETADO" } })).toBe(1); });
  it("el endpoint complete antiguo no puede saltarse el cobro", async () => { const turn = await appointment(); const response = await request(app).post(`/api/appointments/${turn.id}/complete`).set(auth(token)); expect(response.status).toBe(409); expect(response.body.code).toBe("PAYMENT_REQUIRED"); expect((await prisma.appointment.findUniqueOrThrow({ where: { id: turn.id } })).status).toBe("EN_CURSO"); });
  it("cobra débito y transferencia sin tratarlos como efectivo por su nombre", async () => { await open("100.00"); const debit = await appointment("EN_CURSO", "10.00"); const transfer = await appointment("EN_CURSO", "20.00"); expect((await charge(debit.id, debitMethodId, "10.00")).status).toBe(201); expect((await charge(transfer.id, transferMethodId, "20.00")).status).toBe(201); const current = await request(app).get("/api/cash/current").set(auth(token)); expect(current.body.data.totals).toMatchObject({ totalSales: "30.00", cashSales: "0.00", nonCashSales: "30.00", expectedCash: "100.00" }); });
  it("permite ajuste a ADMIN con motivo, conserva snapshot y audita", async () => { await open(); const turn = await appointment("EN_CURSO", "10000.00"); const response = await charge(turn.id, cashMethodId, "9000.00", token, "Descuento"); expect(response.status).toBe(201); expect(response.body.data.price).toBe("10000"); expect(response.body.data.payments[0]).toMatchObject({ amount: "9000", adjustmentReason: "Descuento" }); expect(await prisma.auditLog.count({ where: { action: "PAYMENT_AMOUNT_ADJUSTED", entityId: response.body.data.payments[0].id } })).toBe(1); });
  it("rechaza ajuste sin permiso y método inactivo", async () => { await open(); const first = await appointment(); const forbidden = await charge(first.id, cashMethodId, "4000.00", employeeToken, "Descuento"); expect(forbidden.status).toBe(403); expect(forbidden.body.code).toBe("PAYMENT_AMOUNT_ADJUSTMENT_FORBIDDEN"); const second = await appointment(); const inactive = await charge(second.id, inactiveMethodId); expect(inactive.status).toBe(404); expect(inactive.body.code).toBe("PAYMENT_METHOD_NOT_AVAILABLE"); });
  it("rechaza sin caja, cancelado, ausente, completado y turno ajeno", async () => { const noCash = await appointment(); expect((await charge(noCash.id)).body.code).toBe("CASH_NOT_OPEN"); await open(); for (const status of ["CANCELADO", "AUSENTE", "COMPLETADO"] as const) { const turn = await appointment(status); const response = await charge(turn.id); expect(response.status).toBe(409); expect(response.body.code).toBe("APPOINTMENT_NOT_CHARGEABLE"); } const foreign = await appointment("EN_CURSO", "5000.00", true); expect((await charge(foreign.id)).status).toBe(404); });
  it("serializa dos cobros, devuelve 409 y no duplica nada", async () => { await open(); const turn = await appointment(); const responses = await Promise.all([charge(turn.id), charge(turn.id)]); expect(responses.map((item) => item.status).sort()).toEqual([201, 409]); expect(responses.find((item) => item.status === 409)?.body.code).toBe("APPOINTMENT_ALREADY_PAID"); expect(await prisma.payment.count({ where: { appointmentId: turn.id } })).toBe(1); expect(await prisma.cashMovement.count({ where: { payment: { appointmentId: turn.id } } })).toBe(1); });
  it("serializa cierre vs cobro y nunca deja una venta fuera del snapshot cerrado", async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await resetFinancial(); const opened = await open("100.00"); const turn = await appointment("EN_CURSO", "50.00");
      const [charged, closed] = await Promise.all([
        charge(turn.id, cashMethodId, "50.00"),
        request(app).post("/api/cash/close").set(auth(token)).send({ countedCash: "100.00", notes: "Prueba cierre vs cobro" }),
      ]);
      expect(closed.status).toBe(200); expect([201, 409]).toContain(charged.status);
      if (charged.status === 409) expect(charged.body.code).toBe("CASH_NOT_OPEN");
      const payment = await prisma.payment.findFirst({ where: { appointmentId: turn.id, status: "REGISTRADO" } });
      const register = await prisma.cashRegister.findUniqueOrThrow({ where: { id: opened.body.data.id } });
      const sales = await prisma.cashMovement.findMany({ where: { cashRegisterId: register.id, type: "VENTA" } });
      expect(register.status).toBe("CERRADA"); expect(sales).toHaveLength(payment ? 1 : 0);
      expect(register.expectedCash?.toFixed(2)).toBe(payment ? "150.00" : "100.00");
      if (payment) expect(sales[0]?.paymentId).toBe(payment.id);
    }
  });
  it("revierte toda la operación si falla después de crear Payment", async () => { await open(); const turn = await appointment(); await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION phase5_fail_sale() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled rollback'; END $$`); await prisma.$executeRawUnsafe(`CREATE TRIGGER phase5_fail_sale_trigger BEFORE INSERT ON "CashMovement" FOR EACH ROW EXECUTE FUNCTION phase5_fail_sale()`); try { expect((await charge(turn.id)).status).toBe(500); } finally { await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS phase5_fail_sale_trigger ON "CashMovement"`); await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS phase5_fail_sale()`); } expect((await prisma.appointment.findUniqueOrThrow({ where: { id: turn.id } })).status).toBe("EN_CURSO"); expect(await prisma.payment.count({ where: { appointmentId: turn.id } })).toBe(0); expect(await prisma.cashMovement.count()).toBe(0); });
});

describe("movimientos, Decimal y efectivo esperado", () => {
  it("calcula exactamente 13000 y separa ventas totales de efectivo", async () => { await open("10000.00"); const cashTurn = await appointment("EN_CURSO", "5000.00"); const transferTurn = await appointment("EN_CURSO", "7000.00"); await charge(cashTurn.id, cashMethodId, "5000.00"); await charge(transferTurn.id, transferMethodId, "7000.00"); expect((await movement("income", "2000.00")).status).toBe(201); expect((await movement("expense", "1000.00")).status).toBe(201); expect((await movement("withdrawal", "3000.00")).status).toBe(201); const current = await request(app).get("/api/cash/current").set(auth(token)); expect(current.body.data.totals).toMatchObject({ totalSales: "12000.00", cashSales: "5000.00", nonCashSales: "7000.00", manualIncome: "2000.00", expenses: "1000.00", withdrawals: "3000.00", expectedCash: "13000.00" }); });
  it("rechaza movimientos cero, negativos, sin caja y retiros mayores al efectivo", async () => { expect((await movement("income", "10.00")).body.code).toBe("CASH_NOT_OPEN"); await open("100.00"); for (const amount of ["0", "-1"]) expect((await movement("expense", amount)).status).toBe(400); const excess = await movement("withdrawal", "100.01"); expect(excess.status).toBe(409); expect(excess.body.code).toBe("INSUFFICIENT_EXPECTED_CASH"); });
  it("suma 0.10 + 0.20 como 0.30 y admite 999999999.99", async () => { await open("0.10"); await movement("income", "0.20"); expect((await request(app).get("/api/cash/current").set(auth(token))).body.data.totals.expectedCash).toBe("0.30"); await resetFinancial(); expect((await open("999999999.99")).body.data.openingAmount).toBe("999999999.99"); });
});

describe("cierre, historial e inmutabilidad", () => {
  it.each([["13000.00", null, "0.00"], ["12500.00", "Faltante", "-500.00"], ["13500.00", "Sobrante", "500.00"]])("cierra con contado %s y diferencia %s", async (counted, notes, difference) => { await open("13000.00"); const response = await request(app).post("/api/cash/close").set(auth(token)).send({ countedCash: counted, notes }); expect(response.status).toBe(200); expect(response.body.data).toMatchObject({ status: "CERRADA", expectedCash: "13000.00", countedCash: counted, difference }); });
  it("exige motivo cuando hay diferencia", async () => { await open("100.00"); const response = await request(app).post("/api/cash/close").set(auth(token)).send({ countedCash: "99.00" }); expect(response.status).toBe(400); expect(response.body.code).toBe("CASH_DIFFERENCE_REASON_REQUIRED"); });
  it("una caja cerrada no recibe movimientos/cobros, conserva detalle y permite una nueva", async () => { const opened = await open("50.00"); const oldId = opened.body.data.id; await request(app).post("/api/cash/close").set(auth(token)).send({ countedCash: "50.00" }); expect((await movement("income", "1.00")).body.code).toBe("CASH_NOT_OPEN"); const turn = await appointment(); expect((await charge(turn.id)).body.code).toBe("CASH_NOT_OPEN"); expect((await request(app).post("/api/cash/close").set(auth(token)).send({ countedCash: "50.00" })).body.code).toBe("CASH_NOT_OPEN"); expect((await request(app).get(`/api/cash/${oldId}`).set(auth(token))).body.data.status).toBe("CERRADA"); expect((await open("10.00")).status).toBe(201); });
  it("pagina historial y movimientos y oculta cajas ajenas", async () => { const opened = await open("10.00"); await movement("income", "2.00"); await request(app).post("/api/cash/close").set(auth(token)).send({ countedCash: "12.00" }); await open("20.00"); const history = await request(app).get("/api/cash/history?page=1&pageSize=1").set(auth(token)); expect(history.body.data.meta).toMatchObject({ page: 1, pageSize: 1, total: 2, totalPages: 2 }); const movements = await request(app).get(`/api/cash/${opened.body.data.id}/movements?page=1&pageSize=1&type=INGRESO_MANUAL`).set(auth(token)); expect(movements.body.data.items).toHaveLength(1); expect((await request(app).get(`/api/cash/${opened.body.data.id}`).set(auth(foreignToken))).status).toBe(404); });
  it("filtra historial y movimientos por el día local de America/Argentina/Cordoba", async () => {
    const opened = await open("10.00"); const instant = new Date("2026-08-12T01:30:00.000Z");
    await prisma.cashRegister.update({ where: { id: opened.body.data.id }, data: { openedAt: instant } });
    await prisma.cashMovement.create({ data: { businessId, cashRegisterId: opened.body.data.id, createdById: adminId, type: "INGRESO_MANUAL", concept: "Noche local", amount: "1.00", occurredAt: instant } });
    const localDayHistory = await request(app).get("/api/cash/history?from=2026-08-11&to=2026-08-11").set(auth(token));
    const utcDayHistory = await request(app).get("/api/cash/history?from=2026-08-12&to=2026-08-12").set(auth(token));
    const localDayMovements = await request(app).get(`/api/cash/${opened.body.data.id}/movements?from=2026-08-11&to=2026-08-11`).set(auth(token));
    const utcDayMovements = await request(app).get(`/api/cash/${opened.body.data.id}/movements?from=2026-08-12&to=2026-08-12`).set(auth(token));
    expect(localDayHistory.body.data.items.map((item: { id: string }) => item.id)).toContain(opened.body.data.id); expect(utcDayHistory.body.data.items).toHaveLength(0);
    expect(localDayMovements.body.data.items).toHaveLength(1); expect(utcDayMovements.body.data.items).toHaveLength(0);
  });
  it("respeta también una timezone IANA positiva", async () => {
    await prisma.business.update({ where: { id: businessId }, data: { timezone: "Pacific/Auckland" } });
    try {
      const opened = await open("10.00"); const instant = new Date("2026-08-11T12:30:00.000Z");
      await prisma.cashMovement.create({ data: { businessId, cashRegisterId: opened.body.data.id, createdById: adminId, type: "INGRESO_MANUAL", concept: "Madrugada Auckland", amount: "1.00", occurredAt: instant } });
      const localDay = await request(app).get(`/api/cash/${opened.body.data.id}/movements?from=2026-08-12&to=2026-08-12`).set(auth(token));
      const previousDay = await request(app).get(`/api/cash/${opened.body.data.id}/movements?from=2026-08-11&to=2026-08-11`).set(auth(token));
      expect(localDay.body.data.items).toHaveLength(1); expect(previousDay.body.data.items).toHaveLength(0);
    } finally { await prisma.business.update({ where: { id: businessId }, data: { timezone: "America/Argentina/Cordoba" } }); }
  });
  it("mantiene COMPLETADO pre-Fase5 sin fabricar Payment", async () => { const historical = await appointment("COMPLETADO"); const detail = await request(app).get(`/api/appointments/${historical.id}`).set(auth(token)); expect(detail.status).toBe(200); expect(detail.body.data.payments).toEqual([]); const clientHistory = await request(app).get(`/api/clients/${clientId}/appointments`).set(auth(token)); expect(clientHistory.body.data.items.find((item: { id: string }) => item.id === historical.id).payments).toEqual([]); expect(await prisma.payment.count({ where: { appointmentId: historical.id } })).toBe(0); });
});
