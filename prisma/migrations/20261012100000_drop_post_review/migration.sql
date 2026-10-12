-- Remove the post draft/review workflow (single-admin site; not needed).
-- The columns were added by 20261012090000 and never held data.

ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_submitted_by_id_fkey";
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_reviewed_by_id_fkey";
DROP INDEX IF EXISTS "posts_review_status_deleted_at_idx";

ALTER TABLE "posts"
  DROP COLUMN IF EXISTS "draft",
  DROP COLUMN IF EXISTS "draft_updated_at",
  DROP COLUMN IF EXISTS "review_status",
  DROP COLUMN IF EXISTS "review_note",
  DROP COLUMN IF EXISTS "submitted_at",
  DROP COLUMN IF EXISTS "submitted_by_id",
  DROP COLUMN IF EXISTS "reviewed_at",
  DROP COLUMN IF EXISTS "reviewed_by_id";

DROP TYPE IF EXISTS "ReviewStatus";
