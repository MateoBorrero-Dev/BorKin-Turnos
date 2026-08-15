CREATE INDEX "Client_businessId_createdAt_idx" ON "Client"("businessId", "createdAt");
CREATE INDEX "Payment_businessId_status_createdAt_idx" ON "Payment"("businessId", "status", "createdAt");
CREATE INDEX "Payment_businessId_paymentMethodId_status_createdAt_idx" ON "Payment"("businessId", "paymentMethodId", "status", "createdAt");
CREATE INDEX "CashMovement_businessId_type_occurredAt_idx" ON "CashMovement"("businessId", "type", "occurredAt");
CREATE INDEX "AuditLog_businessId_userId_createdAt_idx" ON "AuditLog"("businessId", "userId", "createdAt");
