-- Phase A: Data migration — copy from legacy Supabase tables into Prisma models.
-- Idempotent and non-destructive. Safe to re-run.
-- Prisma @id default(uuid()) creates TEXT columns; explicit ::text casts where source is UUID.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- 1. Products: copy public.products → Product, preserve UUIDs (as text)
INSERT INTO "Product" (id, title, slug, "imageUrl", "basePrice", "isActive", "createdAt", "updatedAt")
SELECT p.id::text, p.title, p.slug, p.image_url, p.price, p.is_active, p.created_at, p.updated_at
FROM public.products p
ON CONFLICT (id) DO NOTHING;

-- 2. Merge product_extra JSON into Product
UPDATE "Product" prod
SET "salePrice"                = CASE WHEN (s.value->>'sale_price')::int > 0 THEN (s.value->>'sale_price')::int ELSE NULL END,
    "galleryImages"            = s.value->'gallery_images',
    "allowCustomerImageUpload" = COALESCE((s.value->>'allow_customer_image_upload')::boolean, false),
    "mainCategoryId"           = CASE
                                   WHEN NULLIF(s.value->>'main_category_id','') ~ '^[0-9a-f-]{36}$'
                                        AND EXISTS (SELECT 1 FROM "Category" c WHERE c.id = (s.value->>'main_category_id'))
                                   THEN (s.value->>'main_category_id')
                                   ELSE NULL
                                 END
FROM public.site_settings s
WHERE s.key = 'product_extra:' || prod.id;

-- 3. Backfill CategoryProduct from subcategory_ids + mainCategory
INSERT INTO "CategoryProduct" (id, "categoryId", "productId", "createdAt")
SELECT gen_random_uuid()::text, cid, prod.id, now()
FROM "Product" prod
JOIN public.site_settings s ON s.key = 'product_extra:' || prod.id
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(s.value->'subcategory_ids','[]'::jsonb)) AS cid
WHERE cid ~ '^[0-9a-f-]{36}$'
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c.id = cid)
ON CONFLICT ("categoryId","productId") DO NOTHING;

INSERT INTO "CategoryProduct" (id, "categoryId", "productId", "createdAt")
SELECT gen_random_uuid()::text, prod."mainCategoryId", prod.id, now()
FROM "Product" prod
WHERE prod."mainCategoryId" IS NOT NULL
ON CONFLICT ("categoryId","productId") DO NOTHING;

-- 4. ProductVariant: first variant gets full stock, others get 0.
WITH extras AS (
  SELECT
    split_part(key, ':', 2) AS product_id,
    COALESCE(value->'available_colors', '[]'::jsonb) AS colors,
    COALESCE(value->'pendant_types',    '[]'::jsonb) AS pendants,
    COALESCE((value->>'stock')::int, 0)          AS stock,
    COALESCE((value->>'low_threshold')::int, 5)  AS low_threshold
  FROM public.site_settings
  WHERE key LIKE 'product_extra:%'
),
exploded AS (
  SELECT
    e.product_id,
    NULLIF(c.color,  '') AS color,
    NULLIF(pd.pendant,'') AS pendant,
    e.stock,
    e.low_threshold,
    ROW_NUMBER() OVER (PARTITION BY e.product_id ORDER BY c.ord, pd.ord) AS rn
  FROM extras e
  LEFT JOIN LATERAL (
    SELECT value AS color, ordinality AS ord
    FROM jsonb_array_elements_text(
      CASE WHEN jsonb_array_length(e.colors) = 0 THEN '[""]'::jsonb ELSE e.colors END
    ) WITH ORDINALITY
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT value AS pendant, ordinality AS ord
    FROM jsonb_array_elements_text(
      CASE WHEN jsonb_array_length(e.pendants) = 0 THEN '[""]'::jsonb ELSE e.pendants END
    ) WITH ORDINALITY
  ) pd ON true
)
INSERT INTO "ProductVariant" (id, "productId", color, "pendantType", stock, "lowThreshold", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, x.product_id, x.color, x.pendant,
       CASE WHEN x.rn = 1 THEN x.stock ELSE 0 END,
       x.low_threshold, true, now(), now()
FROM exploded x
WHERE EXISTS (SELECT 1 FROM "Product" p WHERE p.id = x.product_id)
ON CONFLICT ("productId", color, "pendantType", material) DO NOTHING;

-- 4b. Safety net: any product without any variant gets a default variant.
INSERT INTO "ProductVariant" (id, "productId", stock, "lowThreshold", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p.id, 0, 5, true, now(), now()
FROM "Product" p
LEFT JOIN "ProductVariant" v ON v."productId" = p.id
WHERE v.id IS NULL
ON CONFLICT ("productId", color, "pendantType", material) DO NOTHING;

-- 5. InventoryLog seed
INSERT INTO "InventoryLog" (id, "variantId", delta, reason, "createdAt")
SELECT gen_random_uuid()::text, v.id, v.stock, 'INITIAL_STOCK', now()
FROM "ProductVariant" v
LEFT JOIN "InventoryLog" il ON il."variantId" = v.id AND il.reason = 'INITIAL_STOCK'
WHERE v.stock > 0 AND il.id IS NULL;

-- 6. Orders: snapshot → legacyItems, backfill OrderItem
UPDATE "Order" SET "legacyItems" = items WHERE "legacyItems" IS NULL;

INSERT INTO "OrderItem" (id, "orderId", "productId", "nameSnapshot", "unitPrice", qty, "createdAt")
SELECT
  gen_random_uuid()::text, o.id,
  CASE WHEN (elem->>'productId') ~ '^[0-9a-f-]{36}$' THEN elem->>'productId' ELSE NULL END,
  COALESCE(elem->>'name', 'Unknown'),
  GREATEST(COALESCE((elem->>'unitPrice')::int, 0), 0),
  GREATEST(COALESCE((elem->>'qty')::int, 1), 1),
  o."createdAt"
FROM "Order" o
CROSS JOIN LATERAL jsonb_array_elements(o.items) AS elem
WHERE NOT EXISTS (SELECT 1 FROM "OrderItem" oi WHERE oi."orderId" = o.id);

-- 7. Counts report
DO $$
DECLARE p_count int; v_count int; oi_count int; cp_count int; il_count int;
BEGIN
  SELECT count(*) INTO p_count  FROM "Product";
  SELECT count(*) INTO v_count  FROM "ProductVariant";
  SELECT count(*) INTO oi_count FROM "OrderItem";
  SELECT count(*) INTO cp_count FROM "CategoryProduct";
  SELECT count(*) INTO il_count FROM "InventoryLog";
  RAISE NOTICE 'Phase A: % products, % variants, % categoryLinks, % orderItems, % invLogs',
    p_count, v_count, cp_count, oi_count, il_count;
END $$;

COMMIT;
