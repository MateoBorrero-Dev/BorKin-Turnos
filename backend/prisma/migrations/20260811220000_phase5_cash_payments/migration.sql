-- Payment methods use a structured kind. `isCash` is retained as a legacy
-- compatibility field, but all Phase 5 financial calculations use `kind`.
CREATE TYPE "PaymentMethodKind" AS ENUM ('CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'OTHER');

ALTER TABLE "PaymentMethod" ADD COLUMN "kind" "PaymentMethodKind" NOT NULL DEFAULT 'OTHER';
UPDATE "PaymentMethod"
SET "kind" = CASE
  WHEN "code" = 'EFECTIVO' THEN 'CASH'::"PaymentMethodKind"
  WHEN "code" = 'DEBITO' THEN 'DEBIT_CARD'::"PaymentMethodKind"
  WHEN "code" = 'CREDITO' THEN 'CREDIT_CARD'::"PaymentMethodKind"
  WHEN "code" = 'TRANSFERENCIA' THEN 'TRANSFER'::"PaymentMethodKind"
  ELSE 'OTHER'::"PaymentMethodKind"
END;
UPDATE "PaymentMethod" SET "isCash" = ("kind" = 'CASH');

ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'VENTA';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'INGRESO_MANUAL';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'RETIRO';

ALTER TABLE "CashRegister"
  ADD COLUMN "openingNotes" TEXT,
  ADD COLUMN "closingNotes" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN "adjustmentReason" TEXT,
  ADD COLUMN "reversedById" UUID;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_reversedById_fkey"
  FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- V1 keeps Appointment 1:N Payment while allowing at most one active payment.
CREATE UNIQUE INDEX "Payment_one_active_per_appointment"
  ON "Payment" ("appointmentId") WHERE ("status" = 'REGISTRADO');

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_reversal_state_check" CHECK (
    ("status" = 'REGISTRADO' AND "reversedAt" IS NULL AND "reversedById" IS NULL AND "reversalReason" IS NULL)
    OR
    ("status" = 'REVERTIDO' AND "reversedAt" IS NOT NULL AND "reversedById" IS NOT NULL AND length(trim("reversalReason")) >= 2)
  );

ALTER TABLE "CashRegister"
  ADD CONSTRAINT "CashRegister_state_check" CHECK (
    ("status" = 'ABIERTA' AND "closedById" IS NULL AND "closedAt" IS NULL AND "expectedCash" IS NULL AND "countedCash" IS NULL AND "difference" IS NULL)
    OR
    ("status" = 'CERRADA' AND "closedById" IS NOT NULL AND "closedAt" IS NOT NULL AND "expectedCash" IS NOT NULL AND "countedCash" IS NOT NULL AND "difference" IS NOT NULL)
  );

ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_payment_link_check" CHECK (
    ("type" = 'VENTA' AND "paymentId" IS NOT NULL AND "paymentMethodId" IS NOT NULL)
    OR
    ("type" <> 'VENTA' AND "paymentId" IS NULL)
  );

CREATE INDEX "CashMovement_business_register_occurred_idx"
  ON "CashMovement" ("businessId", "cashRegisterId", "occurredAt" DESC);
