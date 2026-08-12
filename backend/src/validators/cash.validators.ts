import { z } from "zod";

const money = z.string().trim().regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Ingresá un monto válido con hasta 2 decimales.");
const positiveMoney = money.refine((value) => !/^0+(?:\.0{1,2})?$/.test(value), "El monto debe ser mayor que cero.");
const notes = z.string().trim().max(500).nullable().optional();
const reason = z.string().trim().min(2).max(500);
const uuid = z.uuid("El identificador debe ser un UUID válido.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá una fecha válida.");

export const cashIdSchema = uuid;
export const openCashSchema = z.object({ openingAmount: money, notes }).strict();
export const closeCashSchema = z.object({ countedCash: money, notes }).strict();
export const cashMovementSchema = z.object({ amount: positiveMoney, reason }).strict();
export const chargeAppointmentSchema = z.object({ paymentMethodId: uuid, amount: positiveMoney, adjustmentReason: reason.optional() }).strict();
export const cashHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(["ABIERTA", "CERRADA"]).optional(), from: date.optional(), to: date.optional(),
}).strict();
export const cashMovementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["VENTA", "INGRESO_MANUAL", "EGRESO", "RETIRO"]).optional(), paymentMethodId: uuid.optional(), from: date.optional(), to: date.optional(),
}).strict();
