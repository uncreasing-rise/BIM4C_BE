CREATE TABLE "hero_slides" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "eyebrow" VARCHAR(160) NOT NULL,
  "title" VARCHAR(240) NOT NULL, "image" VARCHAR(500) NOT NULL, "alt" VARCHAR(240) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0, "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "hero_slides_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hero_slides_is_active_sort_order_idx" ON "hero_slides"("is_active", "sort_order");
CREATE TABLE "strategic_partners" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" VARCHAR(180) NOT NULL,
  "logo" VARCHAR(500) NOT NULL, "website" VARCHAR(500), "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "strategic_partners_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "strategic_partners_is_active_sort_order_idx" ON "strategic_partners"("is_active", "sort_order");
