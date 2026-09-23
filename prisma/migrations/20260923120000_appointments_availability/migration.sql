CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

CREATE TABLE "availability_rules" (
  "id" UUID NOT NULL,
  "weekday" INTEGER NOT NULL,
  "start_time" VARCHAR(5) NOT NULL,
  "end_time" VARCHAR(5) NOT NULL,
  "duration_minutes" INTEGER NOT NULL DEFAULT 30,
  "buffer_minutes" INTEGER NOT NULL DEFAULT 10,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "availability_rules_weekday_start_time_end_time_key" ON "availability_rules"("weekday", "start_time", "end_time");
CREATE INDEX "availability_rules_weekday_is_active_idx" ON "availability_rules"("weekday", "is_active");

CREATE TABLE "availability_exceptions" (
  "id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "is_available" BOOLEAN NOT NULL DEFAULT false,
  "start_time" VARCHAR(5),
  "end_time" VARCHAR(5),
  "note" VARCHAR(240),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "availability_exceptions_date_key" ON "availability_exceptions"("date");
CREATE INDEX "availability_exceptions_date_is_available_idx" ON "availability_exceptions"("date", "is_available");

CREATE TABLE "appointments" (
  "id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "phone" VARCHAR(32),
  "company" VARCHAR(200),
  "topic" VARCHAR(120) NOT NULL,
  "message" VARCHAR(5000),
  "project_slug" VARCHAR(180),
  "start_at" TIMESTAMPTZ(3) NOT NULL,
  "end_at" TIMESTAMPTZ(3) NOT NULL,
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "status" "AppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
  "consent_given" BOOLEAN,
  "consent_at" TIMESTAMPTZ(3),
  "privacy_policy_version" VARCHAR(64),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "appointments_start_at_end_at_status_idx" ON "appointments"("start_at", "end_at", "status");
CREATE INDEX "appointments_email_created_at_idx" ON "appointments"("email", "created_at");
