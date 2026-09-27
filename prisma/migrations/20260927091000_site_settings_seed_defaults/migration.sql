-- The frontend no longer ships fallback metrics, social links or brochure.
-- Store the values it used to hard-code, only where the admin has not set them yet.
UPDATE "site_settings"
SET "metrics" = '[{"value":"50+","label_vi":"Dự án BIM & Quản lý","label_en":"BIM & Management Projects"},{"value":"100+","label_vi":"Kỹ sư & Chuyên gia","label_en":"Engineers & Specialists"},{"value":"05+","label_vi":"Năm phát triển","label_en":"Years of Growth"},{"value":"98%","label_vi":"Hài lòng đối tác","label_en":"Partner Satisfaction"}]'::jsonb
WHERE "id" = 'default' AND ("metrics" IS NULL OR "metrics" = 'null'::jsonb OR "metrics" = '[]'::jsonb);

UPDATE "site_settings"
SET "social_links" = '{"linkedin":"https://www.linkedin.com/company/bim4c","facebook":"https://www.facebook.com/bim4c","youtube":"https://www.youtube.com/@bim4c"}'::jsonb
WHERE "id" = 'default' AND "social_links" = '{}'::jsonb;

UPDATE "site_settings"
SET "brochure_url" = '/documents/hsnl-bim4c-2026.pdf'
WHERE "id" = 'default' AND ("brochure_url" IS NULL OR "brochure_url" = '');
