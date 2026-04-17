import { z } from "zod";
import { getSupabaseAdminClient } from "../supabase/client.js";

export type TopSellerRow = {
  id: string;
  product_id: string;
  sort_order: number;
  badge_text: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  products: {
    id: string;
    title: string;
    slug: string;
    image_url: string | null;
    price: number;
    is_active: boolean;
  } | null;
};

const TopSellersReplaceSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        sort_order: z.number().int().min(0).max(9999),
        badge_text: z.string().max(40).optional().nullable(),
        is_active: z.boolean().optional(),
      })
    )
    .max(30),
});

export async function listTopSellers(): Promise<TopSellerRow[]> {
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb
    .from("top_sellers")
    .select("id, product_id, sort_order, badge_text, is_active, created_at, updated_at, products(id, title, slug, image_url, price, is_active)")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
}

export async function replaceTopSellers(input: unknown): Promise<TopSellerRow[]> {
  const parsed = TopSellersReplaceSchema.safeParse(input);
  if (!parsed.success) throw { code: "VALIDATION", details: parsed.error.flatten() };
  const payload = parsed.data.items;
  const sb = getSupabaseAdminClient();

  // 1) read current
  const current = await listTopSellers();
  const currentByProduct = new Map(current.map((x) => [x.product_id, x]));
  const nextProductIds = new Set(payload.map((x) => x.product_id));

  // 2) delete removed products
  const toDeleteIds = current.filter((x) => !nextProductIds.has(x.product_id)).map((x) => x.id);
  if (toDeleteIds.length > 0) {
    const { error: delErr } = await sb.from("top_sellers").delete().in("id", toDeleteIds);
    if (delErr) throw delErr;
  }

  // 3) upsert current/new
  for (const item of payload) {
    const exists = currentByProduct.get(item.product_id);
    if (exists) {
      const { error } = await sb
        .from("top_sellers")
        .update({
          sort_order: item.sort_order,
          badge_text: item.badge_text ?? null,
          is_active: item.is_active ?? true,
        })
        .eq("id", exists.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("top_sellers").insert({
        product_id: item.product_id,
        sort_order: item.sort_order,
        badge_text: item.badge_text ?? null,
        is_active: item.is_active ?? true,
      });
      if (error) throw error;
    }
  }

  return listTopSellers();
}

