-- Phase B: Seed Category table from the hardcoded admin/backend tree.
-- Uses the exact seed-* IDs so existing references (site_settings main_category_id,
-- subcategory_ids) resolve correctly. Idempotent via ON CONFLICT.

BEGIN;

INSERT INTO "Category" (id, name, slug, "parentId", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('seed-main-necklaces', 'שרשראות',         'necklaces', NULL, true, 1, now(), now()),
  ('seed-main-bracelets', 'צמידים',           'bracelets', NULL, true, 2, now(), now()),
  ('seed-main-keychains', 'מחזיקי מפתחות',   'keychains', NULL, true, 3, now(), now()),
  ('seed-main-other',     'אחר',              'other',     NULL, true, 4, now(), now()),
  ('seed-sub-necklaces-men',   'שרשראות גברים', 'necklaces-men',   'seed-main-necklaces', true, 1, now(), now()),
  ('seed-sub-necklaces-women', 'שרשראות נשים',  'necklaces-women', 'seed-main-necklaces', true, 2, now(), now()),
  ('seed-sub-bracelets-men',   'צמידי גברים',   'bracelets-men',   'seed-main-bracelets', true, 1, now(), now()),
  ('seed-sub-bracelets-women', 'צמידי נשים',    'bracelets-women', 'seed-main-bracelets', true, 2, now(), now())
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    "parentId" = EXCLUDED."parentId",
    "isActive" = EXCLUDED."isActive",
    "sortOrder" = EXCLUDED."sortOrder",
    "updatedAt" = now();

-- Now that categories exist, re-link products that had a UUID/seed mainCategoryId
-- referenced in site_settings but couldn't be linked during Phase A.
UPDATE "Product" prod
SET "mainCategoryId" = s.value->>'main_category_id'
FROM public.site_settings s
WHERE s.key = 'product_extra:' || prod.id
  AND prod."mainCategoryId" IS NULL
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c.id = (s.value->>'main_category_id'));

-- Backfill CategoryProduct links now that Category rows exist.
INSERT INTO "CategoryProduct" (id, "categoryId", "productId", "createdAt")
SELECT gen_random_uuid()::text, cid, prod.id, now()
FROM "Product" prod
JOIN public.site_settings s ON s.key = 'product_extra:' || prod.id
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(s.value->'subcategory_ids','[]'::jsonb)) AS cid
WHERE EXISTS (SELECT 1 FROM "Category" c WHERE c.id = cid)
ON CONFLICT ("categoryId","productId") DO NOTHING;

INSERT INTO "CategoryProduct" (id, "categoryId", "productId", "createdAt")
SELECT gen_random_uuid()::text, prod."mainCategoryId", prod.id, now()
FROM "Product" prod
WHERE prod."mainCategoryId" IS NOT NULL
ON CONFLICT ("categoryId","productId") DO NOTHING;

DO $$
DECLARE c_count int; cp_count int; linked int;
BEGIN
  SELECT count(*) INTO c_count  FROM "Category";
  SELECT count(*) INTO cp_count FROM "CategoryProduct";
  SELECT count(*) INTO linked   FROM "Product" WHERE "mainCategoryId" IS NOT NULL;
  RAISE NOTICE 'Phase B seed: % categories, % product-category links, % products with mainCategory', c_count, cp_count, linked;
END $$;

COMMIT;
