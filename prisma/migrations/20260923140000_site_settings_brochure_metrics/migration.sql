-- These columns were previously added by the ad-hoc script prisma/migrate-columns.ts,
-- so databases created only from migrations were missing them. IF NOT EXISTS keeps
-- this a no-op on databases where the script already ran.
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "brochure_url" VARCHAR(1000);
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "metrics" JSONB;
