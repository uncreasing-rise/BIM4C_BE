CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EDITOR');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'ARCHIVE', 'ROLE_CHANGE', 'SETTINGS_UPDATE', 'MEDIA_UPLOAD', 'MEDIA_DELETE');

CREATE TABLE "admin_users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "email" VARCHAR(320) NOT NULL,
  "name" VARCHAR(160) NOT NULL, "password_hash" VARCHAR(255) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE', "last_login_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");
CREATE INDEX "admin_users_status_created_at_idx" ON "admin_users"("status", "created_at");

CREATE TABLE "admin_user_roles" (
  "user_id" UUID NOT NULL, "role" "AdminRole" NOT NULL,
  CONSTRAINT "admin_user_roles_pkey" PRIMARY KEY ("user_id", "role")
);
CREATE INDEX "admin_user_roles_role_idx" ON "admin_user_roles"("role");
ALTER TABLE "admin_user_roles" ADD CONSTRAINT "admin_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "admin_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "token_hash" CHAR(64) NOT NULL,
  "user_id" UUID NOT NULL, "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");
CREATE INDEX "admin_sessions_user_id_idx" ON "admin_sessions"("user_id");
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "actor_id" UUID, "action" "AuditAction" NOT NULL,
  "resource" VARCHAR(80) NOT NULL, "resource_id" VARCHAR(120), "request_id" VARCHAR(100),
  "metadata" JSONB, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_resource_created_at_idx" ON "audit_logs"("resource", "created_at");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "site_settings" (
  "id" VARCHAR(32) NOT NULL DEFAULT 'default', "company_name" VARCHAR(200) NOT NULL,
  "email" VARCHAR(320) NOT NULL, "phone" VARCHAR(32), "address" VARCHAR(500),
  "social_links" JSONB NOT NULL, "default_seo_title" VARCHAR(240) NOT NULL,
  "default_seo_description" VARCHAR(500) NOT NULL, "default_og_image" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "site_settings" ("id", "company_name", "email", "social_links", "default_seo_title", "default_seo_description", "updated_at")
VALUES ('default', 'BIM4C Construction', 'info@bim4c.vn', '{}'::jsonb, 'BIM4C Construction', 'Giải pháp BIM và quản lý xây dựng hiện đại.', CURRENT_TIMESTAMP);
