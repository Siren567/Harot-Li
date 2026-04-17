import { z } from "zod";
import { getSupabaseAdminClient } from "../supabase/client.js";

export type CouponRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT";
  discount_value: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  has_no_expiry: boolean;
  min_cart_amount: number | null;
  max_cart_amount: number | null;
  min_items_quantity: number | null;
  applies_to_all_products: boolean;
  included_product_ids: string[] | null;
  included_category_ids: string[] | null;
  excluded_product_ids: string[] | null;
  exclude_sale_items: boolean;
  new_customers_only: boolean;
  usage_limit_total: number | null;
  usage_limit_per_customer: number | null;
  usage_count: number;
  allow_combining: boolean;
  free_shipping: boolean;
  created_at: string;
  updated_at: string;
};

const CouponUpsertSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((s) => s.trim().toUpperCase()),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional().nullable(),
  discount_type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discount_value: z.number().int().min(1),
  is_active: z.boolean().optional(),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  has_no_expiry: z.boolean().optional(),
  min_cart_amount: z.number().int().min(0).optional().nullable(),
  max_cart_amount: z.number().int().min(0).optional().nullable(),
  min_items_quantity: z.number().int().min(0).optional().nullable(),
  applies_to_all_products: z.boolean().optional(),
  included_product_ids: z.array(z.string()).optional().nullable(),
  included_category_ids: z.array(z.string()).optional().nullable(),
  excluded_product_ids: z.array(z.string()).optional().nullable(),
  exclude_sale_items: z.boolean().optional(),
  new_customers_only: z.boolean().optional(),
  usage_limit_total: z.number().int().min(0).optional().nullable(),
  usage_limit_per_customer: z.number().int().min(0).optional().nullable(),
  allow_combining: z.boolean().optional(),
  free_shipping: z.boolean().optional(),
});

export async function listCoupons(): Promise<CouponRow[]> {
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb.from("coupons").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

export async function createCoupon(input: unknown): Promise<CouponRow> {
  const parsed = CouponUpsertSchema.safeParse(input);
  if (!parsed.success) throw { code: "VALIDATION", details: parsed.error.flatten() };
  const v = parsed.data;

  if (v.discount_type === "PERCENTAGE" && v.discount_value > 100) {
    throw { code: "VALIDATION", details: { fieldErrors: { discount_value: ["אחוז הנחה חייב להיות בין 1 ל-100"] } } };
  }

  const sb = getSupabaseAdminClient();
  const { data, error } = await sb
    .from("coupons")
    .insert({
      ...v,
      is_active: v.is_active ?? true,
      has_no_expiry: v.has_no_expiry ?? false,
      applies_to_all_products: v.applies_to_all_products ?? true,
      exclude_sale_items: v.exclude_sale_items ?? false,
      new_customers_only: v.new_customers_only ?? false,
      allow_combining: v.allow_combining ?? false,
      free_shipping: v.free_shipping ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as any;
}

