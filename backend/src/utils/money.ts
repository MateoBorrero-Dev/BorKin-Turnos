import { Prisma } from "../generated/prisma/client.js";
import { ApiError } from "./api-error.js";

export const ZERO = new Prisma.Decimal(0);
export const MAX_MONEY = new Prisma.Decimal("999999999999.99");

export function decimal(value: string | Prisma.Decimal) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export function checkedMoney(value: string, options: { allowZero?: boolean } = {}) {
  const amount = decimal(value);
  const validMinimum = options.allowZero ? amount.greaterThanOrEqualTo(ZERO) : amount.greaterThan(ZERO);
  if (!validMinimum || amount.greaterThan(MAX_MONEY)) throw new ApiError(400, "Ingresá un monto válido.", "INVALID_AMOUNT");
  return amount;
}

export function moneyString(value: Prisma.Decimal) {
  return value.toFixed(2);
}
