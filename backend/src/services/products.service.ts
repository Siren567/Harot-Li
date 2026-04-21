import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { getSupabaseAdminClient } from "../supabase/client.js";

export type ProductRow = {
  id: string;
  title: string;
  slug: string;
  image_url: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sale_price?: number | null;
  available_colors?: string[];
  pendant_types?: string[];
  allow_customer_image_upload?: boolean;
  gallery_images?: string[];
  main_category_id?: string | null;
  main_category_name?: string | null;
  subcategory_ids?: string[];
  stock?: number;
  low_threshold?: number;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
};

const ProductCreateSchema = z.object({
  title: z.string().min(1).max(140),
  slug: z.string().min(1).max(140).optional().nullable(),
  image_url: z
    .string()
    .max(2_000_000)
    .refine((v) => /^https?:\/\//i.test(v) || /^data:image\//i.test(v), "image_url must be http(s) URL or data:image")
    .optional()
    .nullable(),
  price: z.number().int().min(0),
  is_active: z.boolean().optional(),
  sale_price: z.number().int().min(0).optional().nullable(),
  available_colors: z.array(z.string().min(1).max(40)).max(20).optional(),
  pendant_types: z.array(z.string().min(1).max(40)).max(20).optional(),
  allow_customer_image_upload: z.boolean().optional(),
  gallery_images: z
    .array(
      z
        .string()
        .max(2_000_000)
        .refine((v) => /^https?:\/\//i.test(v) || /^data:image\//i.test(v), "gallery image must be http(s) URL or data:image")
    )
    .max(20)
    .optional(),
  main_category_id: z.string().min(1).max(120).optional().nullable(),
  subcategory_ids: z.array(z.string().min(1).max(120)).max(30).optional(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  low_threshold: z.number().int().min(0).max(1_000_000).optional(),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  seo_keywords: z.string().max(1000).optional().nullable(),
});

const ProductUpdateSchema = ProductCreateSchema.partial();

function productExtraKey(productId: string) {
  return `product_extra:${productId}`;
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u0590-\u05FF]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function resolveUniqueSlug(baseSlug: string, excludeId?: string) {
  const base = baseSlug || `product-${Date.now()}`;
  for (let i = 0; i < 200; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await prisma.product.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// Shape a Prisma Product + its variants + category links into legacy ProductRow.
function toProductRow(p: any): ProductRow {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const colors = Array.from(
    new Set(variants.map((v: any) => v.color).filter((x: any) => typeof x === "string" && x.trim()))
  ) as string[];
  const pendants = Array.from(
    new Set(variants.map((v: any) => v.pendantType).filter((x: any) => typeof x === "string" && x.trim()))
  ) as string[];
  const totalStock = variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
  const lowThreshold = variants.length ? Math.max(...variants.map((v: any) => Number(v.lowThreshold) || 0)) : 5;
  const subcategoryIds: string[] = Array.isArray(p.categories)
    ? p.categories.map((c: any) => c.categoryId).filter((id: string) => id && id !== p.mainCategoryId)
    : [];
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    image_url: p.imageUrl ?? null,
    price: p.basePrice,
    is_active: p.isActive,
    created_at: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    updated_at: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
    sale_price: p.salePrice ?? null,
    available_colors: colors,
    pendant_types: pendants,
    allow_customer_image_upload: Boolean(p.allowCustomerImageUpload),
    gallery_images: Array.isArray(p.galleryImages) ? p.galleryImages : [],
    main_category_id: p.mainCategoryId ?? null,
    main_category_name: p.mainCategory?.name ?? null,
    subcategory_ids: subcategoryIds,
    stock: totalStock,
    low_threshold: lowThreshold,
    seo_title: p.seoTitle ?? null,
    seo_description: p.seoDescription ?? null,
    seo_keywords: p.seoKeywords ?? null,
  };
}

export async function listProducts(params?: { q?: string; active?: boolean }): Promise<ProductRow[]> {
  const where: any = {};
  if (params?.active !== undefined) where.isActive = params.active;
  if (params?.q?.trim()) {
    const q = params.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }
  const products = await prisma.product.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { variants: true, categories: true, mainCategory: { select: { name: true } } },
  });
  return products.map(toProductRow);
}

async function writeLegacyExtras(productId: string, input: any, previous?: any) {
  // Dual-write to site_settings so any storefront code still reading the legacy path stays in sync.
  const sb = getSupabaseAdminClient();
  const value = {
    sale_price: input.sale_price ?? previous?.sale_price ?? null,
    available_colors: input.available_colors ?? previous?.available_colors ?? [],
    pendant_types: input.pendant_types ?? previous?.pendant_types ?? [],
    allow_customer_image_upload: input.allow_customer_image_upload ?? previous?.allow_customer_image_upload ?? false,
    gallery_images: input.gallery_images ?? previous?.gallery_images ?? [],
    main_category_id: input.main_category_id ?? previous?.main_category_id ?? null,
    subcategory_ids: input.subcategory_ids ?? previous?.subcategory_ids ?? [],
    stock: input.stock ?? previous?.stock ?? 0,
    low_threshold: input.low_threshold ?? previous?.low_threshold ?? 5,
  };
  try {
    await sb.from("site_settings").upsert({ key: productExtraKey(productId), value }, { onConflict: "key" });
  } catch {
    // Legacy sync is best-effort; Prisma is the source of truth.
  }
}

async function syncVariantsFromMatrix(
  productId: string,
  colors: string[] | undefined,
  pendants: string[] | undefined,
  stock: number | undefined,
  lowThreshold: number | undefined
) {
  // If caller didn't provide any axis data, leave variants alone.
  if (colors === undefined && pendants === undefined && stock === undefined && lowThreshold === undefined) return;
  const c = (colors ?? []).filter((s) => typeof s === "string" && s.trim());
  const p = (pendants ?? []).filter((s) => typeof s === "string" && s.trim());
  const axes = [c.length ? c : [null], p.length ? p : [null]];
  const combos: Array<{ color: string | null; pendantType: string | null }> = [];
  for (const col of axes[0] as (string | null)[]) {
    for (const pen of axes[1] as (string | null)[]) {
      combos.push({ color: col, pendantType: pen });
    }
  }

  const existing = await prisma.productVariant.findMany({ where: { productId } });
  const keyOf = (v: { color: string | null; pendantType: string | null }) =>
    `${v.color ?? ""}||${v.pendantType ?? ""}`;
  const existingMap = new Map(existing.map((v) => [keyOf(v), v]));
  const targetKeys = new Set(combos.map(keyOf));

  // Create missing variants.
  for (const combo of combos) {
    if (existingMap.has(keyOf(combo))) continue;
    await prisma.productVariant.create({
      data: {
        productId,
        color: combo.color,
        pendantType: combo.pendantType,
        stock: 0,
        lowThreshold: lowThreshold ?? 5,
        isActive: true,
      },
    });
  }

  // Deactivate variants no longer in the matrix (keep rows for history).
  for (const v of existing) {
    if (!targetKeys.has(keyOf(v)) && v.isActive) {
      await prisma.productVariant.update({ where: { id: v.id }, data: { isActive: false } });
    }
  }

  // If a single default variant exists and stock was provided, set it.
  if (stock !== undefined) {
    const current = await prisma.productVariant.findMany({ where: { productId, isActive: true }, orderBy: { createdAt: "asc" } });
    if (current.length === 1) {
      await prisma.productVariant.update({ where: { id: current[0].id }, data: { stock } });
    }
  }
  if (lowThreshold !== undefined) {
    await prisma.productVariant.updateMany({ where: { productId }, data: { lowThreshold } });
  }
}

async function syncCategoryLinks(productId: string, mainCategoryId: string | null | undefined, subcategoryIds: string[] | undefined) {
  if (mainCategoryId === undefined && subcategoryIds === undefined) return;
  const desired = new Set<string>();
  const normalizedMain = typeof mainCategoryId === "string" && mainCategoryId.trim() ? mainCategoryId.trim() : null;
  if (normalizedMain) desired.add(normalizedMain);

  // Enforce a single subcategory per product to keep storefront segmentation deterministic.
  const requestedSubs = Array.from(
    new Set((subcategoryIds ?? []).map((id) => String(id || "").trim()).filter(Boolean))
  );
  const requestedPrimarySub = requestedSubs[0] ?? null;

  // Validate existence.
  const valid = await prisma.category.findMany({
    where: { id: { in: [...Array.from(desired), ...(requestedPrimarySub ? [requestedPrimarySub] : [])] } },
    select: { id: true, parentId: true },
  });
  const validById = new Map(valid.map((c) => [c.id, c]));

  if (requestedPrimarySub) {
    const sub = validById.get(requestedPrimarySub);
    const subBelongsToMain = Boolean(sub?.parentId && normalizedMain && sub.parentId === normalizedMain);
    if (subBelongsToMain) {
      desired.add(requestedPrimarySub);
    }
  }

  await prisma.categoryProduct.deleteMany({ where: { productId } });
  for (const cid of desired) {
    if (!validById.has(cid)) continue;
    await prisma.categoryProduct.create({ data: { productId, categoryId: cid } });
  }
}

export async function createProduct(input: unknown): Promise<ProductRow> {
  const parsed = ProductCreateSchema.safeParse(input);
  if (!parsed.success) throw { code: "VALIDATION", details: parsed.error.flatten() };
  const v = parsed.data;

  const requestedSlug = slugify(v.slug?.trim() ? v.slug : v.title);
  const slug = await resolveUniqueSlug(requestedSlug);

  const mainCategoryExists = v.main_category_id
    ? !!(await prisma.category.findUnique({ where: { id: v.main_category_id } }))
    : false;

  const created = await prisma.product.create({
    data: {
      title: v.title.trim(),
      slug,
      imageUrl: v.image_url ?? null,
      basePrice: v.price,
      isActive: v.is_active ?? true,
      salePrice: v.sale_price ?? null,
      galleryImages: (v.gallery_images ?? []) as any,
      allowCustomerImageUpload: v.allow_customer_image_upload ?? false,
      mainCategoryId: mainCategoryExists ? v.main_category_id! : null,
      seoTitle: v.seo_title ?? null,
      seoDescription: v.seo_description ?? null,
      seoKeywords: v.seo_keywords ?? null,
    },
  });

  // Dual-write to legacy public.products so legacy code still works.
  try {
    const sb = getSupabaseAdminClient();
    await sb.from("products").upsert(
      {
        id: created.id,
        title: created.title,
        slug: created.slug,
        image_url: created.imageUrl,
        price: created.basePrice,
        is_active: created.isActive,
      },
      { onConflict: "id" }
    );
  } catch {
    /* legacy sync best-effort */
  }

  await syncVariantsFromMatrix(created.id, v.available_colors, v.pendant_types, v.stock, v.low_threshold);
  await syncCategoryLinks(created.id, v.main_category_id ?? null, v.subcategory_ids);
  await writeLegacyExtras(created.id, v);

  const full = await prisma.product.findUnique({
    where: { id: created.id },
    include: { variants: true, categories: true },
  });
  return toProductRow(full);
}

export async function updateProduct(id: string, input: unknown): Promise<ProductRow> {
  const parsed = ProductUpdateSchema.safeParse(input);
  if (!parsed.success) throw { code: "VALIDATION", details: parsed.error.flatten() };
  const v = parsed.data;

  const patch: any = {};
  if (v.title !== undefined) patch.title = v.title.trim();
  if (v.slug !== undefined || v.title !== undefined) {
    const nextBase = slugify(v.slug?.trim() ? v.slug : v.title ?? "");
    patch.slug = await resolveUniqueSlug(nextBase, id);
  }
  if (v.image_url !== undefined) patch.imageUrl = v.image_url ?? null;
  if (v.price !== undefined) patch.basePrice = v.price;
  if (v.is_active !== undefined) patch.isActive = v.is_active;
  if (v.sale_price !== undefined) patch.salePrice = v.sale_price ?? null;
  if (v.gallery_images !== undefined) patch.galleryImages = v.gallery_images as any;
  if (v.allow_customer_image_upload !== undefined) patch.allowCustomerImageUpload = v.allow_customer_image_upload;
  if (v.main_category_id !== undefined) {
    const exists = v.main_category_id
      ? !!(await prisma.category.findUnique({ where: { id: v.main_category_id } }))
      : false;
    patch.mainCategoryId = exists ? v.main_category_id! : null;
  }
  if (v.seo_title !== undefined) patch.seoTitle = v.seo_title ?? null;
  if (v.seo_description !== undefined) patch.seoDescription = v.seo_description ?? null;
  if (v.seo_keywords !== undefined) patch.seoKeywords = v.seo_keywords ?? null;

  const updated = await prisma.product.update({ where: { id }, data: patch });

  try {
    const sb = getSupabaseAdminClient();
    await sb
      .from("products")
      .update({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
        ...(patch.imageUrl !== undefined ? { image_url: patch.imageUrl } : {}),
        ...(patch.basePrice !== undefined ? { price: patch.basePrice } : {}),
        ...(patch.isActive !== undefined ? { is_active: patch.isActive } : {}),
      })
      .eq("id", id);
  } catch {
    /* legacy sync best-effort */
  }

  await syncVariantsFromMatrix(id, v.available_colors, v.pendant_types, v.stock, v.low_threshold);
  await syncCategoryLinks(id, v.main_category_id, v.subcategory_ids);
  await writeLegacyExtras(id, v);

  const full = await prisma.product.findUnique({
    where: { id: updated.id },
    include: { variants: true, categories: true },
  });
  return toProductRow(full);
}

export async function deleteProduct(id: string): Promise<void> {
  await prisma.product.delete({ where: { id } });
  try {
    const sb = getSupabaseAdminClient();
    await sb.from("products").delete().eq("id", id);
    await sb.from("site_settings").delete().eq("key", productExtraKey(id));
  } catch {
    /* legacy cleanup best-effort */
  }
}
