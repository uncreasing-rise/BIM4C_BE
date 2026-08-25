CREATE TYPE "SubmissionStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM');

ALTER TABLE "project_images" ADD COLUMN "caption" VARCHAR(500);

ALTER TABLE "contacts"
  ADD COLUMN "status" "SubmissionStatus" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "contacts_status_created_at_idx" ON "contacts"("status", "created_at");

ALTER TABLE "course_registrations"
  ADD COLUMN "status" "SubmissionStatus" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "course_registrations_status_created_at_idx" ON "course_registrations"("status", "created_at");

ALTER TABLE "newsletter_subscriptions"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "unsubscribed_at" TIMESTAMPTZ(3);
CREATE INDEX "newsletter_subscriptions_is_active_created_at_idx" ON "newsletter_subscriptions"("is_active", "created_at");

CREATE TABLE "media" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "url" VARCHAR(1000) NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "alt" VARCHAR(240),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "media_storage_key_key" ON "media"("storage_key");
CREATE INDEX "media_created_at_idx" ON "media"("created_at");
