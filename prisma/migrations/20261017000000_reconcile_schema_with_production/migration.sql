-- Reconcile the migration history with production.
--
-- Production was brought in line with schema.prisma outside migrations (db push),
-- so replaying these migrations produced a different database: snake_case *_vi
-- columns, trigram search indexes, no google_oauth_tokens table. That drift made
-- CI's "migrate deploy + migrate diff" step fail from 5 Oct.
--
-- On a database built from migrations (CI, a fresh dev DB) this brings it to the
-- production shape, keeping data (columns are renamed, not dropped). Production
-- already has this shape: there the migration is only marked as applied
-- (`prisma migrate resolve --applied 20261017000000_reconcile_schema_with_production`).
--
-- The trigram indexes are dropped because production does not have them. Bring
-- them back through schema.prisma if catalog search gets slow.

DROP INDEX IF EXISTS "contacts_company_trgm_idx";
DROP INDEX IF EXISTS "contacts_email_trgm_idx";
DROP INDEX IF EXISTS "contacts_name_trgm_idx";
DROP INDEX IF EXISTS "course_registrations_email_trgm_idx";
DROP INDEX IF EXISTS "course_registrations_name_trgm_idx";
DROP INDEX IF EXISTS "course_registrations_phone_trgm_idx";
DROP INDEX IF EXISTS "courses_description_trgm_idx";
DROP INDEX IF EXISTS "courses_description_vi_trgm_idx";
DROP INDEX IF EXISTS "courses_title_trgm_idx";
DROP INDEX IF EXISTS "courses_title_vi_trgm_idx";
DROP INDEX IF EXISTS "media_alt_trgm_idx";
DROP INDEX IF EXISTS "media_filename_trgm_idx";
DROP INDEX IF EXISTS "posts_description_trgm_idx";
DROP INDEX IF EXISTS "posts_description_vi_trgm_idx";
DROP INDEX IF EXISTS "posts_title_trgm_idx";
DROP INDEX IF EXISTS "posts_title_vi_trgm_idx";
DROP INDEX IF EXISTS "projects_description_trgm_idx";
DROP INDEX IF EXISTS "projects_description_vi_trgm_idx";
DROP INDEX IF EXISTS "projects_location_trgm_idx";
DROP INDEX IF EXISTS "projects_location_vi_trgm_idx";
DROP INDEX IF EXISTS "projects_title_trgm_idx";
DROP INDEX IF EXISTS "projects_title_vi_trgm_idx";
DROP INDEX IF EXISTS "services_description_trgm_idx";
DROP INDEX IF EXISTS "services_description_vi_trgm_idx";
DROP INDEX IF EXISTS "services_title_trgm_idx";
DROP INDEX IF EXISTS "services_title_vi_trgm_idx";

ALTER TABLE "courses" RENAME COLUMN "learning_outcomes_vi" TO "learningOutcomes_vi";
ALTER TABLE "courses" RENAME COLUMN "seo_description_vi" TO "seoDescription_vi";
ALTER TABLE "courses" RENAME COLUMN "seo_title_vi" TO "seoTitle_vi";
ALTER TABLE "posts" RENAME COLUMN "seo_description_vi" TO "seoDescription_vi";
ALTER TABLE "posts" RENAME COLUMN "seo_title_vi" TO "seoTitle_vi";
ALTER TABLE "projects" RENAME COLUMN "contract_package_vi" TO "contractPackage_vi";
ALTER TABLE "projects" RENAME COLUMN "expected_completion_vi" TO "expectedCompletion_vi";
ALTER TABLE "projects" RENAME COLUMN "seo_description_vi" TO "seoDescription_vi";
ALTER TABLE "projects" RENAME COLUMN "seo_title_vi" TO "seoTitle_vi";
ALTER TABLE "services" RENAME COLUMN "seo_description_vi" TO "seoDescription_vi";
ALTER TABLE "services" RENAME COLUMN "seo_title_vi" TO "seoTitle_vi";

-- CreateTable
CREATE TABLE "google_oauth_tokens" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'default',
    "refresh_token" TEXT NOT NULL,
    "scope" VARCHAR(500),
    "token_type" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- RenameIndex
ALTER INDEX "projects_category_id_deleted_at_status_sort_order_published_at_" RENAME TO "projects_category_id_deleted_at_status_sort_order_published_idx";

