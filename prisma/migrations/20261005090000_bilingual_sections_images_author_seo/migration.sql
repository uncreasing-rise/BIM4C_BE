-- Vietnamese versions of fields that were single-language. All columns are
-- nullable and additive; the base column stays the English/default value.

ALTER TABLE "course_sections"
  ADD COLUMN "title_vi" VARCHAR(240),
  ADD COLUMN "description_vi" TEXT;

ALTER TABLE "project_images"
  ADD COLUMN "alt_vi" VARCHAR(240),
  ADD COLUMN "caption_vi" VARCHAR(500);

ALTER TABLE "posts"
  ADD COLUMN "authorName_vi" VARCHAR(160);

ALTER TABLE "site_settings"
  ADD COLUMN "defaultSeoTitle_vi" VARCHAR(240),
  ADD COLUMN "defaultSeoDescription_vi" VARCHAR(500);

-- Existing text was written for the Vietnamese site, so it seeds the
-- Vietnamese column; the base column keeps it as the English fallback until
-- an editor translates it.
UPDATE "course_sections" SET "title_vi" = "title", "description_vi" = "description";
UPDATE "project_images" SET "alt_vi" = "alt", "caption_vi" = "caption";
UPDATE "posts" SET "authorName_vi" = "author_name" WHERE "author_name" IS NOT NULL;
