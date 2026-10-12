-- Post drafts and editorial review. Additive: existing posts get
-- review_status NONE and no draft, so the public site is unchanged.

CREATE TYPE "ReviewStatus" AS ENUM ('NONE', 'PENDING', 'CHANGES_REQUESTED');

ALTER TABLE "posts"
  ADD COLUMN "draft" JSONB,
  ADD COLUMN "draft_updated_at" TIMESTAMPTZ(3),
  ADD COLUMN "review_status" "ReviewStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "review_note" VARCHAR(1000),
  ADD COLUMN "submitted_at" TIMESTAMPTZ(3),
  ADD COLUMN "submitted_by_id" UUID,
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(3),
  ADD COLUMN "reviewed_by_id" UUID;

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "posts_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "posts_review_status_deleted_at_idx" ON "posts"("review_status", "deleted_at");
