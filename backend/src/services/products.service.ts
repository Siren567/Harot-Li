import { z } from "zod";
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
  subcategory_ids?: string[];
  stock?: number;
  low_threshold?: number;
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
});

const ProductUpdateSchema = ProductCreateSchema.partial();

function productExtraKey(productId: string) {
  return `product_extra:${productId}`;
}

function normalizeExtraRow(row: any) {
  const v = row?.value && typeof row.value === "object" && !Array.isArray(row.value) ? row.value : {};
  return {
    sale_price: typeof v.sale_price === "number" && Number.isFinite(v.sale_price) ? Math.max(0, Math.round(v.sale_price)) : null,
    available_colors: Array.isArray(v.available_colors) ? v.available_colors.filter((x: any) => typeof x === "string") : [],
    pendant_types: Array.isArray(v.pendant_types) ? v.pendant_types.filter((x: any) => typeof x === "string") : [],
    allow_customer_image_upload: Boolean(v.allow_customer_image_upload),
    gallery_images: Array.isArray(v.gallery_images) ? v.gallery_images.filter((x: any) => typeof x === "string") : [],
    main_category_id: typeof v.main_category_id === "string" && v.main_category_id.trim() ? v.main_category_id : null,
    subcategory_ids: Array.isArray(v.subcategory_ids) ? v.subcategory_ids.filter((x: any) => typeof x === "string") : [],
    stock: typeof v.stock === "number" && Number.isFinite(v.stock) ? Math.max(0, Math.round(v.stock)) : 0,
    low_threshold:
      typeof v.low_threshold === "number" && Number.isFinite(v.low_threshold) ? Math.max(0, Math.round(v.low_threshold)) : 5,
  };
}

async function loadExtrasMap(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, ReturnType<typeof normalizeExtraRow>>();
  const sb = getSupabaseAdminClient();
  const keys = productIds.map((id) => productExtraKey(id));
  const map = new Map<string, ReturnType<typeof normalizeExtraRow>>();
  try {
    const { data, error } = await sb.from("site_settings").select("key,value").in("key", keys);
    if (error) return map;
    for (const row of data ?? []) {
      const key = String(row.key ?? "");
      const productId = key.split(":")[1];
      if (!productId) continue;
      map.set(productId, normalizeExtraRow(row));
    }
  } catch {
    // Keep products readable even when extras source is unavailable.
  }
  return map;
}

async function saveProductExtras(productId: string, input: z.infer<typeof ProductCreateSchema> | z.infer<typeof ProductUpdateSchema>) {
  const hasExtraFields =
    input.sale_price !== undefined ||
    input.available_colors !== undefined ||
    input.pendant_types !== undefined ||
    input.allow_customer_image_upload !== undefined ||
    input.gallery_images !== undefined ||
    input.main_category_id !== undefined ||
    input.subcategory_ids !== undefined ||
    input.stock !== undefined ||
    input.low_threshold !== undefined;
  if (!hasExtraFields) return;
  const sb = getSupabaseAdminClient();
  const { data: existingRow, error: existingErr } = await sb
    .from("site_settings")
    .select("value")
    .eq("key", productExtraKey(productId))
    .maybeSingle();
  if (existingErr) throw existingErr;
  const prev = normalizeExtraRow(existingRow ?? {});
  const value = {
    sale_price: input.sale_price ?? prev.sale_price,
    available_colors: input.available_colors ?? prev.available_colors,
    pendant_types: input.pendant_types ?? prev.pendant_types,
    allow_customer_image_upload: input.allow_customer_image_upload ?? prev.allow_customer_image_upload,
    gallery_images: input.gallery_images ?? prev.gallery_images,
    main_category_id: input.main_category_id ?? prev.main_category_id,
    subcategory_ids: input.subcategory_ids ?? prev.subcategory_ids,
    stock: input.stock ?? prev.stock,
    low_threshold: input.low_threshold ?? prev.low_threshold,
  };
  const { error } = await sb
    .from("site_settings")
    .upsert({ key: productExtraKey(productId), value }, { onConflict: "key" });
  if (error) throw error;
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
  const sb = getSupabaseAdminClient();
  const base = baseSlug || `product-${Date.now()}`;
  for (let i = 0; i < 200; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    let query = sb.from("products").select("id").eq("slug", candidate).limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export async function listProducts(params?: { q?: string; active?: boolean }): Promise<ProductRow[]> {
  const sb = getSupabaseAdminClient();
  let query = sb.from("products").select("*");
  if (params?.q?.trim()) {
    const q = params.q.trim();
    query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  }
  if (params?.active !== undefined) {
    query = query.eq("is_active", params.active);
  }
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ProductRow[];
  const extrasMap = await loadExtrasMap(rows.map((r) => r.id));
  return rows.map((row) => ({ ...row, ...(extrasMap.get(row.id) ?? {}) }));
}

export async function createProduct(input: unknown): Promise<ProductRow> {
  const parsed = ProductCreateSchema.safeParse(input);
  if (!parsed.success) throw { code: "VALIDATION", details: parsed.error.flatten() };
  const v = parsed.data;
  const requestedSlug = slugify(v.slug?.trim() ? v.slug : v.title);
  const slug = await resolveUniqueSlug(requestedSlug);

  const sb = getSupabaseAdminClient();
  const { data, error } = await sb
    .from("products")
    .insert({
      title: v.title.trim(),
      slug,
      image_url: v.image_url ?? null,
      price: v.price,
      is_active: v.is_active ?? true,
    })
    .select("*")
    .single();
  if (error) throw error;
  await saveProductExtras(data.id, v);
  const extrasMap = await loadExtrasMap([data.id]);
  return { ...(data as any), ...(extrasMap.get(data.id) ?? {}) };
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
  if (v.image_url !== undefined) patch.image_url = v.image_url ?? null;
  if (v.price !== undefined) patch.price = v.price;
  if (v.is_active !== undefined) patch.is_active = v.is_active;

  const sb = getSupabaseAdminClient();
  const { data, error } = await sb.from("products").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await saveProductExtras(id, v);
  const extrasMap = await loadExtrasMap([id]);
  return { ...(data as any), ...(extrasMap.get(id) ?? {}) };
}

export async function deleteProduct(id: string): Promise<void> {
  const sb = getSupabaseAdminClient();
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) throw error;
  const { error: extraErr } = await sb.from("site_settings").delete().eq("key", productExtraKey(id));
  if (extraErr) throw extraErr;
}

