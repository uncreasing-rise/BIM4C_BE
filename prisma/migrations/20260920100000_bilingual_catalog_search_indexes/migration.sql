-- Keep bilingual catalogue searches fast when users type in Vietnamese.
-- The public list endpoints search title and description in both languages.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "posts_title_vi_trgm_idx" ON "posts" USING GIN ("title_vi" gin_trgm_ops);
CREATE INDEX "posts_description_trgm_idx" ON "posts" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "posts_description_vi_trgm_idx" ON "posts" USING GIN ("description_vi" gin_trgm_ops);

CREATE INDEX "services_title_vi_trgm_idx" ON "services" USING GIN ("title_vi" gin_trgm_ops);
CREATE INDEX "services_description_trgm_idx" ON "services" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "services_description_vi_trgm_idx" ON "services" USING GIN ("description_vi" gin_trgm_ops);

CREATE INDEX "courses_title_vi_trgm_idx" ON "courses" USING GIN ("title_vi" gin_trgm_ops);
CREATE INDEX "courses_description_trgm_idx" ON "courses" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "courses_description_vi_trgm_idx" ON "courses" USING GIN ("description_vi" gin_trgm_ops);

CREATE INDEX "projects_title_vi_trgm_idx" ON "projects" USING GIN ("title_vi" gin_trgm_ops);
CREATE INDEX "projects_description_trgm_idx" ON "projects" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "projects_description_vi_trgm_idx" ON "projects" USING GIN ("description_vi" gin_trgm_ops);
CREATE INDEX "projects_location_vi_trgm_idx" ON "projects" USING GIN ("location_vi" gin_trgm_ops);
