-- Phase 2: operational business configuration.
ALTER TABLE "ServiceCategory" ADD COLUMN "description" TEXT;
ALTER TABLE "ScheduleBlock" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

CREATE INDEX "ServiceCategory_businessId_active_idx" ON "ServiceCategory"("businessId", "active");
CREATE UNIQUE INDEX "Service_businessId_name_key" ON "Service"("businessId", "name");
CREATE UNIQUE INDEX "Employee_businessId_email_key" ON "Employee"("businessId", "email");
CREATE UNIQUE INDEX "EmployeeSchedule_employeeId_dayOfWeek_startMinute_endMinute_key"
  ON "EmployeeSchedule"("employeeId", "dayOfWeek", "startMinute", "endMinute");
CREATE INDEX "ScheduleBlock_businessId_active_startAt_idx" ON "ScheduleBlock"("businessId", "active", "startAt");
