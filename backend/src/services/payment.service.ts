import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { lockAppointmentPayment, lockBusinessCash } from "../utils/financial-locks.js";
import { checkedMoney, moneyString } from "../utils/money.js";
import { getAppointment } from "./appointment.service.js";

type Actor = { userId: string; canAdjustAmount: boolean; ipAddress: string | undefined };

function activePaymentConflict(error: unknown) {
  const value = error instanceof Error ? `${error.name} ${error.message}` : JSON.stringify(error);
  return value.includes("Payment_one_active_per_appointment") || value.includes("P2002") || value.includes("23505");
}

export async function paymentMethodOptions(businessId: string) {
  return prisma.paymentMethod.findMany({ where: { businessId, active: true }, select: { id: true, name: true, kind: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function completeAppointmentAndCharge(businessId: string, actor: Actor, appointmentId: string, input: { paymentMethodId: string; amount: string; adjustmentReason?: string }) {
  const amount = checkedMoney(input.amount);
  try {
    await prisma.$transaction(async (tx) => {
      // Orden global: caja del negocio antes que pago del turno.
      await lockBusinessCash(tx, businessId);
      await lockAppointmentPayment(tx, businessId, appointmentId);
      const appointment = await tx.appointment.findFirst({ where: { id: appointmentId, businessId } });
      if (!appointment) throw new ApiError(404, "Turno no encontrado.", "APPOINTMENT_NOT_FOUND");
      if (await tx.payment.findFirst({ where: { businessId, appointmentId, status: "REGISTRADO" }, select: { id: true } })) throw new ApiError(409, "Este turno ya fue cobrado.", "APPOINTMENT_ALREADY_PAID");
      if (appointment.status !== "EN_CURSO") throw new ApiError(409, "El turno ya no puede cobrarse.", "APPOINTMENT_NOT_CHARGEABLE");
      const register = await tx.cashRegister.findFirst({ where: { businessId, status: "ABIERTA" } });
      if (!register) throw new ApiError(409, "Debés abrir una caja antes de registrar cobros.", "CASH_NOT_OPEN");
      const method = await tx.paymentMethod.findFirst({ where: { id: input.paymentMethodId, businessId, active: true } });
      if (!method) throw new ApiError(404, "El método de pago no está disponible.", "PAYMENT_METHOD_NOT_AVAILABLE");
      const adjusted = !amount.equals(appointment.price);
      if (adjusted && !actor.canAdjustAmount) throw new ApiError(403, "No tenés permiso para modificar el importe.", "PAYMENT_AMOUNT_ADJUSTMENT_FORBIDDEN");
      if (adjusted && !input.adjustmentReason?.trim()) throw new ApiError(400, "Indicá el motivo del cambio de importe.", "PAYMENT_ADJUSTMENT_REASON_REQUIRED");
      const payment = await tx.payment.create({ data: { businessId, appointmentId, paymentMethodId: method.id, cashRegisterId: register.id, recordedById: actor.userId, amount, adjustmentReason: adjusted ? input.adjustmentReason!.trim() : null } });
      await tx.cashMovement.create({ data: { businessId, cashRegisterId: register.id, paymentMethodId: method.id, paymentId: payment.id, createdById: actor.userId, type: "VENTA", concept: "Cobro de turno", amount } });
      const now = new Date();
      await tx.appointment.update({ where: { id: appointment.id }, data: { status: "COMPLETADO", completedAt: now, version: { increment: 1 } } });
      await tx.appointmentStatusEvent.create({ data: { businessId, appointmentId, userId: actor.userId, fromStatus: appointment.status, toStatus: "COMPLETADO", reason: "Turno cobrado" } });
      await tx.auditLog.create({ data: { businessId, userId: actor.userId, action: "PAYMENT_CREATED", entity: "Payment", entityId: payment.id, metadata: { cashRegisterId: register.id, appointmentId, paymentMethodId: method.id, amount: moneyString(amount) }, ipAddress: actor.ipAddress ?? null } });
      if (adjusted) await tx.auditLog.create({ data: { businessId, userId: actor.userId, action: "PAYMENT_AMOUNT_ADJUSTED", entity: "Payment", entityId: payment.id, metadata: { appointmentId, originalAmount: moneyString(appointment.price), finalAmount: moneyString(amount), reason: input.adjustmentReason!.trim() }, ipAddress: actor.ipAddress ?? null } });
    });
  } catch (error) {
    if (activePaymentConflict(error)) throw new ApiError(409, "Este turno ya fue cobrado.", "APPOINTMENT_ALREADY_PAID");
    throw error;
  }
  return getAppointment(businessId, appointmentId);
}
