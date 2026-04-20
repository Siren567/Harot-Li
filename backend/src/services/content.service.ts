import { z } from "zod";
import { getSupabaseAdminClient } from "../supabase/client.js";
import { prisma } from "../db/prisma.js";
import { listTopSellers } from "./topSellers.service.js";

export type ContentSectionRow = {
  id: string;
  key: string;
  title: string | null;
  body: any;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LegalPageRow = {
  id: string;
  slug: string;
  title: string;
  body: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SiteSettingRow = {
  id: string;
  key: string;
  value: any;
  created_at: string;
  updated_at: string;
};

export type TopSellerWithProduct = {
  id: string;
  product_id: string;
  sort_order: number;
  badge_text: string | null;
  is_active: boolean;
  products: {
    id: string;
    title: string;
    slug: string;
    image_url: string | null;
    price: number;
    is_active: boolean;
  } | null;
};

const ContentUpsertSchema = z.object({
  key: z.string().min(1).max(80),
  title: z.string().max(120).optional().nullable(),
  body: z.any(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

const LegalUpsertSchema = z.object({
  slug: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  body: z.any(),
  is_active: z.boolean().optional(),
});

const SiteSettingUpsertSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.any(),
});

const AnyUrlSchema = z.string().url();

const HeroSectionBodySchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  ctaText: z.string().min(1),
  ctaLink: z.string().min(1),
  trustText: z.string().optional(),
  heroImageUrl: AnyUrlSchema.optional().nullable(),
  colors: z.record(z.string()).optional(),
});

const FinalCtaBodySchema = z.object({
  label: z.string().optional().nullable(),
  titleLines: z.array(z.string()).min(1),
  subtitle: z.string().min(1),
  ctaText: z.string().min(1),
  ctaLink: z.string().min(1),
  colors: z.record(z.string()).optional(),
});

const FooterBodySchema = z.object({
  brandTitle: z.string().min(1),
  brandSubtitle: z.string().min(1),
  navigationLinks: z.array(z.object({ label: z.string(), href: z.string() })).optional(),
  infoLinks: z.array(z.object({ label: z.string(), key: z.string().optional(), href: z.string().optional() })).optional(),
  contact: z.object({
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
  }).optional(),
  copyrightText: z.string().optional(),
  statusLinkText: z.string().optional(),
  statusLinkHref: z.string().optional(),
  socialLinks: z.array(z.object({ label: z.string(), href: z.string() })).optional(),
});

const BenefitsBodySchema = z.array(
  z.object({
    icon: z.string(),
    title: z.string(),
    description: z.string(),
  })
);

const StepsBodySchema = z.array(
  z.object({
    id: z.number().int(),
    title: z.string(),
    description: z.string(),
  })
);

const ExamplesBodySchema = z.array(z.string());

const GenericJsonSchema = z.any();

function validateSectionBody(key: string, body: any) {
  const map: Record<string, z.ZodTypeAny> = {
    hero: HeroSectionBodySchema,
    benefits: BenefitsBodySchema,
    how_steps: StepsBodySchema,
    examples: ExamplesBodySchema,
    final_cta: FinalCtaBodySchema,
    footer: FooterBodySchema,
    top_sellers_section: GenericJsonSchema,
    announcement: GenericJsonSchema,
  };
  const schema = map[key] ?? GenericJsonSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw { code: "VALIDATION", details: parsed.error.flatten() };
}

export async function listContentSections(): Promise<ContentSectionRow[]> {
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb.from("content_sections").select("*").order("sort_order").order("created_at");
  if (error) throw error;
  return (data ?? []) as any;
}

export async function upsertContentSection(input: unknown): Promise<ContentSectionRow> {
  const parsed = ContentUpsertSchema.safeParse(input);
  if (!parsed.success) throw { code: "VALIDATION", details: parsed.error.flatten() };
  const v = parsed.data;
  validateSectionBody(v.key, v.body);
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb
    .from("content_sections")
    .upsert(
      {
        key: v.key,
        title: v.title ?? null,
        body: v.body,
        is_active: v.is_active ?? true,
        sort_order: v.sort_order ?? 0,
      },
      { onConflict: "key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as any;
}

export async function listLegalPages(): Promise<LegalPageRow[]> {
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb.from("legal_pages").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

export async function getLegalPage(slug: string): Promise<LegalPageRow | null> {
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb.from("legal_pages").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

export async function upsertLegalPage(input: unknown): Promise<LegalPageRow> {
  const parsed = LegalUpsertSchema.safeParse(input);
  if (!parsed.success) throw { code: "VALIDATION", details: parsed.error.flatten() };
  const v = parsed.data;
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb
    .from("legal_pages")
    .upsert(
      {
        slug: v.slug,
        title: v.title,
        body: v.body,
        is_active: v.is_active ?? true,
      },
      { onConflict: "slug" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as any;
}

export async function listSiteSettings(): Promise<SiteSettingRow[]> {
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb.from("site_settings").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

export async function upsertSiteSetting(input: unknown): Promise<SiteSettingRow> {
  const parsed = SiteSettingUpsertSchema.safeParse(input);
  if (!parsed.success) throw { code: "VALIDATION", details: parsed.error.flatten() };
  const v = parsed.data;
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb
    .from("site_settings")
    .upsert({ key: v.key, value: v.value }, { onConflict: "key" })
    .select("*")
    .single();
  if (error) throw error;
  return data as any;
}

export async function listTopSellersWithProducts(): Promise<TopSellerWithProduct[]> {
  const rows = await listTopSellers();
  return rows.filter((row) => row.products !== null);
}

export async function getContentBootstrap() {
  // Each query is independent — if one fails (DB down, schema drift, pool issue)
  // we still return a valid shape with empty defaults so the frontend can boot.
  const results = await Promise.allSettled([
    listContentSections(),
    listSiteSettings(),
    listLegalPages(),
    listTopSellersWithProducts(),
  ]);
  const [sectionsR, settingsR, legalR, topR] = results;
  const labels = ["sections", "settings", "legalPages", "topSellers"] as const;
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.warn(`[content/bootstrap] ${labels[i]} failed:`, (r.reason as any)?.message ?? r.reason);
    }
  });
  const sections = sectionsR.status === "fulfilled" ? sectionsR.value : [];
  const settings = settingsR.status === "fulfilled" ? settingsR.value : [];
  const legalPages = legalR.status === "fulfilled" ? legalR.value : [];
  const topSellers = topR.status === "fulfilled" ? topR.value : [];
  let categories: Array<{
    id: string;
    name: string;
    slug: string;
    sortOrder: number;
    isActive: boolean;
  }> = [];
  try {
    categories = await prisma.category.findMany({
      where: { parentId: null, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  } catch (err: any) {
    console.warn("[content/bootstrap] categories failed:", err?.message ?? err);
  }
  return {
    sections,
    settings,
    legalPages: legalPages.filter((p) => p.is_active),
    topSellers: topSellers.filter((x) => x.is_active),
    categories,
  };
}

