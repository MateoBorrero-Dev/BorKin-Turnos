import { CashMovementType, CashRegisterStatus, PaymentMethodKind, Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { checkedMoney, decimal, moneyString, ZERO } from "../utils/money.js";
import { paginationMeta } from "../utils/pagination.js";
import { lockBusinessCash } from "../utils/financial-locks.js";
import { localDateRange } from "../utils/local-date-range.js";

type Tx = Prisma.TransactionClient;
type Register = { id: string; businessId: string; openingAmount: Prisma.Decimal };
type HistoryQuery = { page: number; pageSize: number; status?: CashRegisterStatus | undefined; from?: string | undefined; to?: string | undefined };
type MovementQuery = { page: number; pageSize: number; type?: CashMovementType | undefined; paymentMethodId?: string | undefined; from?: string | undefined; to?: string | undefined };
type Actor = { userId: string; ipAddress: string | undefined };

const registerInclude = {
  openedBy: { select: { id: true, firstName: true, lastName: true } },
  closedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.CashRegisterInclude;

async function businessTimezone(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { timezone: true } });
  if (!business) throw new ApiError(404, "Negocio no encontrado.", "BUSINESS_NOT_FOUND");
  return business.timezone;
}

async function summaries(tx: Tx, registers: Register[]) {
  const ids = registers.map((item) => item.id);
  if (!ids.length) return new Map<string, ReturnType<typeof emptyTotals>>();
  const [paymentGroups, movementGroups] = await Promise.all([
    tx.payment.groupBy({ by: ["cashRegisterId", "paymentMethodId"], where: { cashRegisterId: { in: ids }, status: "REGISTRADO" }, _sum: { amount: true }, _count: { _all: true } }),
    tx.cashMovement.groupBy({ by: ["cashRegisterId", "type"], where: { cashRegisterId: { in: ids }, type: { in: ["INGRESO_MANUAL", "EGRESO", "RETIRO"] } }, _sum: { amount: true } }),
  ]);
  const methodIds = [...new Set(paymentGroups.map((item) => item.paymentMethodId))];
  const methods = methodIds.length ? await tx.paymentMethod.findMany({ where: { id: { in: methodIds } }, select: { id: true, name: true, kind: true } }) : [];
  const methodMap = new Map(methods.map((item) => [item.id, item]));
  const result = new Map<string, ReturnType<typeof emptyTotals>>();
  for (const register of registers) {
    let totalSales = ZERO; let cashSales = ZERO; let paymentCount = 0;
    const byMethod: Array<{ paymentMethodId: string; name: string; kind: PaymentMethodKind; amount: string; count: number }> = [];
    for (const group of paymentGroups.filter((item) => item.cashRegisterId === register.id)) {
      const amount = group._sum.amount ?? ZERO; const method = methodMap.get(group.paymentMethodId);
      if (!method) continue;
      totalSales = totalSales.plus(amount); if (method.kind === "CASH") cashSales = cashSales.plus(amount); paymentCount += group._count._all;
      byMethod.push({ paymentMethodId: method.id, name: method.name, kind: method.kind, amount: moneyString(amount), count: group._count._all });
    }
    const movementAmount = (type: CashMovementType) => movementGroups.find((item) => item.cashRegisterId === register.id && item.type === type)?._sum.amount ?? ZERO;
    const manualIncome = movementAmount("INGRESO_MANUAL"); const expenses = movementAmount("EGRESO"); const withdrawals = movementAmount("RETIRO");
    const expectedCash = register.openingAmount.plus(cashSales).plus(manualIncome).minus(expenses).minus(withdrawals);
    result.set(register.id, {
      paymentCount, totalPayments: moneyString(totalSales), totalSales: moneyString(totalSales), cashSales: moneyString(cashSales),
      nonCashSales: moneyString(totalSales.minus(cashSales)), manualIncome: moneyString(manualIncome), expenses: moneyString(expenses),
      withdrawals: moneyString(withdrawals), expectedCash: moneyString(expectedCash), byMethod,
    });
  }
  return result;
}

function emptyTotals() {
  return { paymentCount: 0, totalPayments: "0.00", totalSales: "0.00", cashSales: "0.00", nonCashSales: "0.00", manualIncome: "0.00", expenses: "0.00", withdrawals: "0.00", expectedCash: "0.00", byMethod: [] as Array<{ paymentMethodId: string; name: string; kind: PaymentMethodKind; amount: string; count: number }> };
}

function registerView<T extends { openingAmount: Prisma.Decimal; expectedCash: Prisma.Decimal | null; countedCash: Prisma.Decimal | null; difference: Prisma.Decimal | null }>(row: T) {
  return { ...row, openingAmount: moneyString(row.openingAmount), expectedCash: row.expectedCash ? moneyString(row.expectedCash) : null, countedCash: row.countedCash ? moneyString(row.countedCash) : null, difference: row.difference ? moneyString(row.difference) : null };
}

async function recentMovements(tx: Tx, cashRegisterId: string, take = 10) {
  const rows = await tx.cashMovement.findMany({ where: { cashRegisterId }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take, include: { paymentMethod: { select: { id: true, name: true, kind: true } }, createdBy: { select: { id: true, firstName: true, lastName: true } } } });
  return rows.map((row) => ({ ...row, amount: moneyString(row.amount) }));
}

export async function currentCash(businessId: string) {
  const register = await prisma.cashRegister.findFirst({ where: { businessId, status: "ABIERTA" }, include: registerInclude });
  if (!register) return null;
  const totals = (await summaries(prisma, [register])).get(register.id) ?? emptyTotals();
  return { ...registerView(register), totals, recentMovements: await recentMovements(prisma, register.id) };
}

function databaseConflict(error: unknown, marker: string) {
  const value = error instanceof Error ? `${error.name} ${error.message}` : JSON.stringify(error);
  return value.includes(marker) || value.includes("P2002") || value.includes("23505");
}

export async function openCash(businessId: string, actor: Actor, input: { openingAmount: string; notes?: string | null }) {
  const openingAmount = checkedMoney(input.openingAmount, { allowZero: true });
  try {
    const id = await prisma.$transaction(async (tx) => {
      await lockBusinessCash(tx, businessId);
      if (await tx.cashRegister.findFirst({ where: { businessId, status: "ABIERTA" }, select: { id: true } })) throw new ApiError(409, "Ya existe una caja abierta.", "CASH_ALREADY_OPEN");
      const created = await tx.cashRegister.create({ data: { businessId, openedById: actor.userId, openingAmount, openingNotes: input.notes ?? null } });
      await tx.auditLog.create({ data: { businessId, userId: actor.userId, action: "CASH_OPENED", entity: "CashRegister", entityId: created.id, metadata: { openingAmount: moneyString(openingAmount), notes: input.notes ?? null }, ipAddress: actor.ipAddress ?? null } });
      return created.id;
    });
    return cashDetail(businessId, id);
  } catch (error) {
    if (databaseConflict(error, "CashRegister_one_open_per_business")) throw new ApiError(409, "Ya existe una caja abierta.", "CASH_ALREADY_OPEN");
    throw error;
  }
}

export async function addMovement(businessId: string, actor: Actor, type: "INGRESO_MANUAL" | "EGRESO" | "RETIRO", input: { amount: string; reason: string }) {
  const amount = checkedMoney(input.amount);
  await prisma.$transaction(async (tx) => {
    await lockBusinessCash(tx, businessId);
    const register = await tx.cashRegister.findFirst({ where: { businessId, status: "ABIERTA" } });
    if (!register) throw new ApiError(409, "No hay una caja abierta.", "CASH_NOT_OPEN");
    if (type !== "INGRESO_MANUAL") {
      const total = (await summaries(tx, [register])).get(register.id) ?? emptyTotals();
      if (amount.greaterThan(decimal(total.expectedCash))) throw new ApiError(409, "El monto supera el efectivo esperado disponible.", "INSUFFICIENT_EXPECTED_CASH");
    }
    const movement = await tx.cashMovement.create({ data: { businessId, cashRegisterId: register.id, createdById: actor.userId, type, concept: input.reason, amount } });
    const action = type === "INGRESO_MANUAL" ? "CASH_MANUAL_INCOME" : type === "EGRESO" ? "CASH_EXPENSE" : "CASH_WITHDRAWAL";
    await tx.auditLog.create({ data: { businessId, userId: actor.userId, action, entity: "CashMovement", entityId: movement.id, metadata: { cashRegisterId: register.id, amount: moneyString(amount), reason: input.reason }, ipAddress: actor.ipAddress ?? null } });
  });
  return currentCash(businessId);
}

export async function closeCash(businessId: string, actor: Actor, input: { countedCash: string; notes?: string | null }) {
  const countedCash = checkedMoney(input.countedCash, { allowZero: true });
  const id = await prisma.$transaction(async (tx) => {
    await lockBusinessCash(tx, businessId);
    const register = await tx.cashRegister.findFirst({ where: { businessId, status: "ABIERTA" } });
    if (!register) throw new ApiError(409, "No hay una caja abierta.", "CASH_NOT_OPEN");
    const totals = (await summaries(tx, [register])).get(register.id) ?? emptyTotals();
    const expectedCash = decimal(totals.expectedCash); const difference = countedCash.minus(expectedCash);
    if (!difference.equals(ZERO) && !input.notes?.trim()) throw new ApiError(400, "Indicá el motivo de la diferencia de caja.", "CASH_DIFFERENCE_REASON_REQUIRED");
    const now = new Date();
    await tx.cashRegister.update({ where: { id: register.id }, data: { status: "CERRADA", closedById: actor.userId, closedAt: now, expectedCash, countedCash, difference, closingNotes: input.notes ?? null } });
    await tx.auditLog.create({ data: { businessId, userId: actor.userId, action: "CASH_CLOSED", entity: "CashRegister", entityId: register.id, metadata: { expectedCash: moneyString(expectedCash), countedCash: moneyString(countedCash), difference: moneyString(difference), notes: input.notes ?? null }, ipAddress: actor.ipAddress ?? null } });
    return register.id;
  });
  return cashDetail(businessId, id);
}

export async function cashHistory(businessId: string, query: HistoryQuery) {
  const range = localDateRange(await businessTimezone(businessId), query.from, query.to);
  const where: Prisma.CashRegisterWhereInput = { businessId, ...(query.status ? { status: query.status } : {}), ...(range ? { openedAt: range } : {}) };
  const [rows, total] = await prisma.$transaction([
    prisma.cashRegister.findMany({ where, include: registerInclude, orderBy: { openedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.cashRegister.count({ where }),
  ]);
  const totalMap = await summaries(prisma, rows);
  return { items: rows.map((row) => ({ ...registerView(row), totals: totalMap.get(row.id) ?? emptyTotals() })), meta: paginationMeta(query.page, query.pageSize, total) };
}

export async function cashDetail(businessId: string, id: string) {
  const row = await prisma.cashRegister.findFirst({ where: { id, businessId }, include: registerInclude });
  if (!row) throw new ApiError(404, "Caja no encontrada.", "CASH_REGISTER_NOT_FOUND");
  const totals = (await summaries(prisma, [row])).get(row.id) ?? emptyTotals();
  return { ...registerView(row), totals, recentMovements: await recentMovements(prisma, row.id, 20) };
}

export async function cashMovements(businessId: string, id: string, query: MovementQuery) {
  if (!await prisma.cashRegister.findFirst({ where: { id, businessId }, select: { id: true } })) throw new ApiError(404, "Caja no encontrada.", "CASH_REGISTER_NOT_FOUND");
  const range = localDateRange(await businessTimezone(businessId), query.from, query.to);
  const where: Prisma.CashMovementWhereInput = { businessId, cashRegisterId: id, ...(query.type ? { type: query.type } : {}), ...(query.paymentMethodId ? { paymentMethodId: query.paymentMethodId } : {}), ...(range ? { occurredAt: range } : {}) };
  const [rows, total] = await prisma.$transaction([
    prisma.cashMovement.findMany({ where, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { paymentMethod: { select: { id: true, name: true, kind: true } }, createdBy: { select: { id: true, firstName: true, lastName: true } } } }),
    prisma.cashMovement.count({ where }),
  ]);
  return { items: rows.map((row) => ({ ...row, amount: moneyString(row.amount) })), meta: paginationMeta(query.page, query.pageSize, total) };
}
