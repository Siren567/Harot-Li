import { z } from "zod";
import { getSupabaseAdminClient } from "../supabase/client.js";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  is_active: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

const CategoryUpsertSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  seo_title: z.string().max(120).optional().nullable(),
  seo_description: z.string().max(320).optional().nullable(),
});

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u0590-\u05FF]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function listCategories(): Promise<CategoryRow[]> {
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb.from("categories").select("*").order("sort_order").order("created_at");
  if (error) throw error;
  return (data ?? []) as any;
}

export async function listCategoriesTree(): Promise<(CategoryRow & { subcategories: CategoryRow[] })[]> {
  const rows = await listCategories();
  const mains = rows.filter((r) => !r.parent_id);
  const byParent = new Map<string, CategoryRow[]>();
  for (const r of rows) {
    if (!r.parent_id) continue;
    const arr = byParent.get(r.parent_id) ?? [];
    arr.push(r);
    byParent.set(r.parent_id, arr);
  }
  return mains.map((m) => ({ ...m, subcategories: byParent.get(m.id) ?? [] }));
}

export async function createCategory(input: unknown): Promise<CategoryRow> {
  const parsed = CategoryUpsertSchema.safeParse(input);
  if (!parsed.success) throw { code: "VALIDATION", details: parsed.error.flatten() };
  const v = parsed.data;
  const slug = slugify(v.slug?.trim() ? v.slug : v.name);

  const sb = getSupabaseAdminClient();
  const { data, error } = await sb
    .from("categories")
    .insert({
      name: v.name.trim(),
      slug,
      description: v.description ?? null,
      image_url: v.image_url ?? null,
      parent_id: v.parent_id ?? null,
      is_active: v.is_active ?? true,
      sort_order: v.sort_order ?? 0,
      seo_title: v.seo_title ?? null,
      seo_description: v.seo_description ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as any;
}

export async function updateCategory(id: string, input: unknown): Promise<CategoryRow> {
  const parsed = CategoryUpsertSchema.partial().safeParse(input);
  if (!parsed.success) throw { code: "VALIDATION", details: parsed.error.flatten() };
  const v = parsed.data;

  const patch: any = {};
  if (v.name !== undefined) patch.name = v.name.trim();
  if (v.slug !== undefined || v.name !== undefined) patch.slug = slugify(v.slug?.trim() ? v.slug : v.name ?? "");
  if (v.description !== undefined) patch.description = v.description ?? null;
  if (v.image_url !== undefined) patch.image_url = v.image_url ?? null;
  if (v.parent_id !== undefined) patch.parent_id = v.parent_id ?? null;
  if (v.is_active !== undefined) patch.is_active = v.is_active;
  if (v.sort_order !== undefined) patch.sort_order = v.sort_order;
  if (v.seo_title !== undefined) patch.seo_title = v.seo_title ?? null;
  if (v.seo_description !== undefined) patch.seo_description = v.seo_description ?? null;

  const sb = getSupabaseAdminClient();
  const { data, error } = await sb.from("categories").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as any;
}

export async function deleteCategory(id: string): Promise<void> {
  const sb = getSupabaseAdminClient();
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) throw error;
}

