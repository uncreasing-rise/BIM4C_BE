-- Query-performance indexes for the public catalogue and admin CMS.
-- This migration intentionally uses PostgreSQL-only indexes; no external cache is required.

-- Public catalogue queries always exclude soft-deleted rows and filter by status,
-- then sort by sort_order/published_at. Category variants are covered separately.
CREATE INDEX "projects_deleted_at_status_sort_order_published_at_idx"
  ON "projects" ("deleted_at", "status", "sort_order", "published_at");
CREATE INDEX "projects_category_id_deleted_at_status_sort_order_published_at_idx"
  ON "projects" ("category_id", "deleted_at", "status", "sort_order", "published_at");
CREATE INDEX "projects_deleted_at_updated_at_idx"
  ON "projects" ("deleted_at", "updated_at");

CREATE INDEX "services_deleted_at_status_sort_order_published_at_idx"
  ON "services" ("deleted_at", "status", "sort_order", "published_at");
CREATE INDEX "services_deleted_at_updated_at_idx"
  ON "services" ("deleted_at", "updated_at");

CREATE INDEX "courses_deleted_at_status_sort_order_published_at_idx"
  ON "courses" ("deleted_at", "status", "sort_order", "published_at");
CREATE INDEX "courses_deleted_at_updated_at_idx"
  ON "courses" ("deleted_at", "updated_at");

CREATE INDEX "posts_deleted_at_status_sort_order_published_at_idx"
  ON "posts" ("deleted_at", "status", "sort_order", "published_at");
CREATE INDEX "posts_category_id_deleted_at_status_sort_order_published_at_idx"
  ON "posts" ("category_id", "deleted_at", "status", "sort_order", "published_at");
CREATE INDEX "posts_deleted_at_updated_at_idx"
  ON "posts" ("deleted_at", "updated_at");

-- pg_trgm makes the existing case-insensitive contains searches usable at scale.
-- Keep this before the GIN indexes because gin_trgm_ops is provided by the extension.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "projects_title_trgm_idx" ON "projects" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "projects_location_trgm_idx" ON "projects" USING GIN ("location" gin_trgm_ops);
CREATE INDEX "services_title_trgm_idx" ON "services" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "courses_title_trgm_idx" ON "courses" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "posts_title_trgm_idx" ON "posts" USING GIN ("title" gin_trgm_ops);

CREATE INDEX "contacts_name_trgm_idx" ON "contacts" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "contacts_email_trgm_idx" ON "contacts" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "contacts_company_trgm_idx" ON "contacts" USING GIN ("company" gin_trgm_ops);
CREATE INDEX "course_registrations_name_trgm_idx" ON "course_registrations" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "course_registrations_email_trgm_idx" ON "course_registrations" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "course_registrations_phone_trgm_idx" ON "course_registrations" USING GIN ("phone" gin_trgm_ops);
CREATE INDEX "media_filename_trgm_idx" ON "media" USING GIN ("filename" gin_trgm_ops);
CREATE INDEX "media_alt_trgm_idx" ON "media" USING GIN ("alt" gin_trgm_ops);

CREATE INDEX "course_registrations_course_id_status_created_at_idx"
  ON "course_registrations" ("course_id", "status", "created_at");
CREATE INDEX "admin_sessions_user_id_expires_at_idx"
  ON "admin_sessions" ("user_id", "expires_at");
