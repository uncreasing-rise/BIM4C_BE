-- Official company name: "Công ty Cổ phần Xây dựng và Công nghệ BIM4C" /
-- "BIM4C Construction and Technology Joint Stock Company". Earlier content
-- used the words in the other order or with "&". Also replace the sample
-- social links with the company's real pages.

UPDATE "site_settings"
SET "company_name" = 'Công ty Cổ phần Xây dựng và Công nghệ BIM4C',
    "social_links" = COALESCE("social_links", '{}'::jsonb)
      || '{"linkedin":"https://www.linkedin.com/company/bim4cjsc","facebook":"https://www.facebook.com/BIM4CGroup/","youtube":"https://www.youtube.com/@BIM4C-vp8lv"}'::jsonb,
    "updated_at" = now()
WHERE "id" = 'default';

UPDATE "page_contents"
SET "vi" = replace(replace(replace(replace("vi"::text,
      'Công ty Cổ phần Công nghệ và Xây dựng BIM4C', 'Công ty Cổ phần Xây dựng và Công nghệ BIM4C'),
      'CÔNG TY CỔ PHẦN CÔNG NGHỆ VÀ XÂY DỰNG BIM4C', 'CÔNG TY CỔ PHẦN XÂY DỰNG VÀ CÔNG NGHỆ BIM4C'),
      'BIM4C TECHNOLOGY & CONSTRUCTION JOINT STOCK COMPANY', 'BIM4C CONSTRUCTION AND TECHNOLOGY JOINT STOCK COMPANY'),
      'Công ty Cổ phần Xây dựng & Công nghệ BIM4C', 'Công ty Cổ phần Xây dựng và Công nghệ BIM4C')::jsonb,
    "en" = replace(replace(replace(replace("en"::text,
      'BIM4C Technology and Construction Joint Stock Company', 'BIM4C Construction and Technology Joint Stock Company'),
      'BIM4C TECHNOLOGY & CONSTRUCTION JOINT STOCK COMPANY', 'BIM4C CONSTRUCTION AND TECHNOLOGY JOINT STOCK COMPANY'),
      'BIM4C Technology and Construction JSC', 'BIM4C Construction and Technology JSC'),
      'BIM4C Construction & Technology Joint Stock Company', 'BIM4C Construction and Technology Joint Stock Company')::jsonb,
    "updated_at" = now();
