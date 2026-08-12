import type { Prisma } from "../generated/prisma/client.js";

type Tx = Prisma.TransactionClient;

/**
 * Orden global cuando una operación necesita ambos locks:
 * 1. caja del negocio; 2. pago del turno.
 * Las operaciones que sólo afectan caja adquieren únicamente el primero.
 */
export async function lockBusinessCash(tx: Tx, businessId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${businessId}:cash-register`}, 0))`;
}

export async function lockAppointmentPayment(tx: Tx, businessId: string, appointmentId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${businessId}:appointment-payment:${appointmentId}`}, 0))`;
}
