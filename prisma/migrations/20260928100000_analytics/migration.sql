-- First-party, cookieless page analytics (no IP or lasting identifier stored).
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "type" VARCHAR(24) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "locale" VARCHAR(5),
    "target" VARCHAR(500),
    "label" VARCHAR(200),
    "content_type" VARCHAR(24),
    "content_slug" VARCHAR(200),
    "source" VARCHAR(100) NOT NULL,
    "medium" VARCHAR(100) NOT NULL,
    "campaign" VARCHAR(200),
    "referrer" VARCHAR(255),
    "device" VARCHAR(10) NOT NULL,
    "browser" VARCHAR(30) NOT NULL,
    "os" VARCHAR(30) NOT NULL,
    "country" VARCHAR(2),
    "visitor_id" CHAR(16) NOT NULL,
    "session_id" VARCHAR(40) NOT NULL,
    "duration_ms" INTEGER,
    "scroll_depth" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");
CREATE INDEX "analytics_events_type_created_at_idx" ON "analytics_events"("type", "created_at");
CREATE INDEX "analytics_events_path_created_at_idx" ON "analytics_events"("path", "created_at");
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events"("session_id");

-- How each lead found the site.
ALTER TABLE "contacts" ADD COLUMN "attribution" JSONB;
ALTER TABLE "appointments" ADD COLUMN "attribution" JSONB;
ALTER TABLE "course_registrations" ADD COLUMN "attribution" JSONB;
ALTER TABLE "newsletter_subscriptions" ADD COLUMN "attribution" JSONB;
