-- Evolución aditiva de Client. La presentación del teléfono se conserva en
-- "phone" y las comparaciones/búsquedas fuertes usan "phoneNormalized".
ALTER TABLE "Client" ALTER COLUMN "lastName" DROP NOT NULL;
ALTER TABLE "Client" ADD COLUMN "phoneNormalized" TEXT;
ALTER TABLE "Client" ADD COLUMN "emailNormalized" TEXT;

UPDATE "Client"
SET "phoneNormalized" = NULLIF(regexp_replace("phone", '[^0-9]', '', 'g'), '')
WHERE "phone" IS NOT NULL;

UPDATE "Client"
SET "email" = lower(btrim("email")),
    "emailNormalized" = lower(btrim("email"))
WHERE "email" IS NOT NULL;

DROP INDEX IF EXISTS "Client_businessId_phone_idx";
DROP INDEX IF EXISTS "Client_businessId_email_idx";
CREATE INDEX "Client_businessId_phoneNormalized_idx" ON "Client"("businessId", "phoneNormalized");
CREATE INDEX "Client_businessId_emailNormalized_idx" ON "Client"("businessId", "emailNormalized");
