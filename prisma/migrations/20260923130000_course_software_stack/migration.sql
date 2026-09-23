ALTER TABLE "courses"
  ADD COLUMN "software_stack" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "software_stack_vi" JSONB;
