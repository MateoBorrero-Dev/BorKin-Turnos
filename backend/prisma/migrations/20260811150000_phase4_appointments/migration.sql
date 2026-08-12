-- Snapshot histórico mínimo: el nombre del servicio no cambia si el catálogo se renombra.
ALTER TABLE "Appointment" ADD COLUMN "serviceName" TEXT;

UPDATE "Appointment" AS appointment
SET "serviceName" = service."name"
FROM "Service" AS service
WHERE service."id" = appointment."serviceId";

ALTER TABLE "Appointment" ALTER COLUMN "serviceName" SET NOT NULL;

CREATE INDEX "Appointment_businessId_employeeId_status_startAt_idx"
  ON "Appointment"("businessId", "employeeId", "status", "startAt");

-- Appointment_no_employee_overlap ya fue creada en la migración inicial con
-- btree_gist, rango semiabierto [) y una condición que sólo excluye CANCELADO.
