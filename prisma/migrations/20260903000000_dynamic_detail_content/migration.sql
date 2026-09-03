-- Additive detail-content fields. Existing legacy `sections` data remains intact.
ALTER TABLE "projects"
  ADD COLUMN "content_blocks" JSONB,
  ADD COLUMN "seo_title" VARCHAR(240),
  ADD COLUMN "seo_description" VARCHAR(1000),
  ADD COLUMN "seo_image" VARCHAR(500),
  ADD COLUMN "canonical_url" VARCHAR(1000),
  ADD COLUMN "related_ids" JSONB;

ALTER TABLE "services"
  ADD COLUMN "content_blocks" JSONB,
  ADD COLUMN "seo_title" VARCHAR(240),
  ADD COLUMN "seo_description" VARCHAR(1000),
  ADD COLUMN "seo_image" VARCHAR(500),
  ADD COLUMN "canonical_url" VARCHAR(1000),
  ADD COLUMN "related_ids" JSONB;

ALTER TABLE "courses"
  ADD COLUMN "content_blocks" JSONB,
  ADD COLUMN "seo_title" VARCHAR(240),
  ADD COLUMN "seo_description" VARCHAR(1000),
  ADD COLUMN "seo_image" VARCHAR(500),
  ADD COLUMN "canonical_url" VARCHAR(1000),
  ADD COLUMN "related_ids" JSONB,
  ADD COLUMN "duration" VARCHAR(160),
  ADD COLUMN "level" VARCHAR(160),
  ADD COLUMN "price" VARCHAR(160),
  ADD COLUMN "instructor" VARCHAR(240),
  ADD COLUMN "learning_outcomes" JSONB;

ALTER TABLE "posts"
  ADD COLUMN "content_blocks" JSONB,
  ADD COLUMN "seo_title" VARCHAR(240),
  ADD COLUMN "seo_description" VARCHAR(1000),
  ADD COLUMN "seo_image" VARCHAR(500),
  ADD COLUMN "canonical_url" VARCHAR(1000),
  ADD COLUMN "related_ids" JSONB;
