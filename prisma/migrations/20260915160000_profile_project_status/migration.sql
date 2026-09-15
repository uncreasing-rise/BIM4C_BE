-- A portfolio entry does not establish construction progress or completion.
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'PROFILED';
ALTER TABLE "projects" ALTER COLUMN "year" DROP NOT NULL;
