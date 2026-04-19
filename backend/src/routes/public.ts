import { Router } from "express";
import { listProducts } from "../services/products.service.js";
import { getSupabaseAdminClient } from "../supabase/client.js";
import { prisma } from "../db/prisma.js";

export const publicRouter = Router();

function mapMainCategoryToStudio(mainCategoryId?: string | null) {
  const id = String(mainCategoryId ?? "").toLowerCase();
  if (id.includes("bracelet") || id.includes("צמיד")) return "bracelets";
  if (id.includes("key") || id.includes("מחזיק")) return "keychains";
  if (id.includes("necklace") || id.includes("שרשר")) return "necklaces";
  return "other";
}

function mapMainCategoryToStudioByText(rawSlug = "", rawName = "") {
  const s = String(rawSlug).toLowerCase();
  const n = String(rawName).toLowerCase();
  if (s.includes("bracelet") || n.includes("צמיד")) return "bracelets";
  if (s.includes("key") || n.includes("מחזיק")) return "keychains";
  if (s.includes("necklace") || n.includes("שרשר")) return "necklaces";
  return "other";
}

function mapSubcategoryLabel(raw?: string | null) {
  const source = String(raw ?? "").trim();
  const s = source.toLowerCase();
  if (!s) return null;
  if (s.includes("couple") || s.includes("זוג")) return "זוגיים";
  if (s.includes("men") || s.includes("גברים")) return "גברים";
  if (s.includes("women") || s.includes("נשים")) return "נשים";
  return source || null;
}

function pickSubcategoryLabel(inputs: Array<string | null | undefined>, productTitle?: string | null) {
  const labels = inputs.map((x) => mapSubcategoryLabel(x)).filter(Boolean) as string[];
  const title = String(productTitle ?? "").toLowerCase();
  if (title.includes("פרח")) return "נשים";
  if (title.includes("זוג")) return "זוגיים";
  if (!labels.length) return null;
  const hasCouple = labels.includes("זוגיים");
  if (hasCouple) return "זוגיים";
  const hasWomen = labels.includes("נשים");
  const hasMen = labels.includes("גברים");
  if (hasWomen && hasMen) {
    if (title.includes("אישה") || title.includes("נשים") || title.includes("פרח") || title.includes("לב")) return "נשים";
    if (title.includes("גבר") || title.includes("גברים") || title.includes("כדור")) return "גברים";
    return "נשים";
  }
  return labels[0];
}

function pickSubcategoryLabels(inputs: Array<string | null | undefined>) {
  const out: string[] = [];
  for (const value of inputs) {
    const label = mapSubcategoryLabel(value);
    if (!label) continue;
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

function mapStudioColors(colors?: string[]) {
  const inColors = Array.isArray(colors) ? colors : [];
  return inColors
    .map((c) => {
      const x = String(c).trim().toLowerCase();
      if (x.includes("זהב") || x.includes("gold")) return "gold";
      if (x.includes("כסף") || x.includes("silver")) return "silver";
      if (x.includes("רוז") || x.includes("rose")) return "rose";
      if (x.includes("שחור") || x.includes("black")) return "black";
      return null;
    })
    .filter(Boolean) as string[];
}

publicRouter.get("/products", async (_req, res) => {
  try {
    const rows = await listProducts({ active: true });
    const ids = new Set<string>();
    for (const p of rows) {
      if (p.main_category_id) ids.add(String(p.main_category_id));
      if ((p as any)?.category_id) ids.add(String((p as any).category_id));
      for (const sid of p.subcategory_ids ?? []) ids.add(String(sid));
    }

    const categoriesById = new Map<string, { id: string; name: string; slug: string; parent_id: string | null }>();
    const variantsByProductId = new Map<
      string,
      Array<{
        id: string;
        color: string | null;
        pendantType: string | null;
        material: string | null;
        stock: number;
        priceOverride: number | null;
        isActive: boolean;
      }>
    >();
    if (ids.size > 0) {
      try {
        const sb = getSupabaseAdminClient();
        const { data } = await sb
          .from("categories")
          .select("id,name,slug,parent_id")
          .in("id", Array.from(ids));
        for (const row of data ?? []) {
          categoriesById.set(String(row.id), {
            id: String(row.id),
            name: String(row.name ?? ""),
            slug: String(row.slug ?? ""),
            parent_id: row.parent_id ? String(row.parent_id) : null,
          });
        }
      } catch {
        // Continue with best-effort mapping without categories table lookup.
      }
    }

    if (rows.length > 0) {
      const productIds = rows.map((p) => p.id);
      const variants = await prisma.productVariant.findMany({
        where: { productId: { in: productIds } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          productId: true,
          color: true,
          pendantType: true,
          material: true,
          stock: true,
          priceOverride: true,
          isActive: true,
        },
      });
      for (const variant of variants) {
        const key = variant.productId;
        const existing = variantsByProductId.get(key) ?? [];
        existing.push(variant);
        variantsByProductId.set(key, existing);
      }
    }

    const products = rows.map((p) => {
      const legacyCategoryId = (p as any)?.category_id ? String((p as any).category_id) : null;
      const mainRaw = p.main_category_id
        ? categoriesById.get(String(p.main_category_id))
        : legacyCategoryId
          ? categoriesById.get(legacyCategoryId)
          : null;
      const subRows = (p.subcategory_ids ?? []).map((sid) => categoriesById.get(String(sid))).filter(Boolean);
      const subRawFirst = subRows[0] ?? null;
      const effectiveMain = mainRaw?.parent_id ? categoriesById.get(mainRaw.parent_id) ?? mainRaw : mainRaw;

      const image = p.image_url ?? (Array.isArray((p as any).images) ? (p as any).images[0] : null) ?? null;
      const gallery = Array.isArray(p.gallery_images) ? p.gallery_images.filter(Boolean) : [];
      const images = Array.from(new Set([image, ...gallery].filter(Boolean))) as string[];
      const effectivePriceAgorot = p.sale_price && p.sale_price > 0 && p.sale_price < p.price ? p.sale_price : p.price;
      const pAny = p as any;
      const variants = variantsByProductId.get(p.id) ?? [];
      const activeVariants = variants.filter((v) => v.isActive);
      const totalStock = activeVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      const subcategoryLabels = pickSubcategoryLabels([
        ...subRows.map((s) => s?.name),
        ...subRows.map((s) => s?.slug),
        ...(p.subcategory_ids ?? []),
        pAny.subcategoryName,
        pAny.subcategoryLabel,
      ]);
      return {
        id: p.id,
        name: p.title,
        description: "",
        price: Number((effectivePriceAgorot / 100).toFixed(2)),
        image,
        images,
        mainCategoryId: effectiveMain?.id ?? p.main_category_id ?? legacyCategoryId ?? null,
        subcategoryIds: p.subcategory_ids ?? [],
        studioCategory: effectiveMain
          ? mapMainCategoryToStudioByText(effectiveMain.slug, effectiveMain.name)
          : mapMainCategoryToStudio(p.main_category_id),
        subcategoryLabel: pickSubcategoryLabel(
          [
            ...subRows.map((s) => s?.name),
            ...subRows.map((s) => s?.slug),
            ...(p.subcategory_ids ?? []),
            pAny.subcategoryName,
            pAny.subcategoryLabel,
          ],
          p.title
        ),
        subcategoryLabels,
        categoryName: effectiveMain?.name ?? null,
        subcategoryName: subRawFirst?.name ?? null,
        studioColors: mapStudioColors(p.available_colors),
        allowCustomerImageUpload: Boolean(p.allow_customer_image_upload),
        stock: totalStock,
        lowThreshold: typeof p.low_threshold === "number" ? p.low_threshold : 5,
        variants: activeVariants.map((v) => ({
          id: v.id,
          color: v.color,
          pendantType: v.pendantType,
          material: v.material,
          stock: Number(v.stock) || 0,
          price: Number(((v.priceOverride ?? effectivePriceAgorot) / 100).toFixed(2)),
          isActive: v.isActive,
        })),
      };
    });
    res.json({ products });
  } catch (err: any) {
    console.error("[GET /api/public/products] failed:", {
      message: err?.message,
      code: err?.code,
      name: err?.name,
      stack: err?.stack,
    });
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// GET /api/public/site — minimal site meta used by the storefront (WhatsApp digits, etc.).
publicRouter.get("/site", async (_req, res) => {
  let whatsapp: string | null = null;
  try {
    const sb = getSupabaseAdminClient();
    const { data } = await sb
      .from("site_settings")
      .select("value")
      .in("key", ["site_whatsapp", "whatsapp", "studio_whatsapp"])
      .limit(1)
      .maybeSingle();
    const raw = data?.value;
    if (typeof raw === "string") whatsapp = raw;
    else if (raw && typeof raw === "object") whatsapp = (raw as any).digits ?? (raw as any).phone ?? null;
  } catch (err: any) {
    console.warn("[GET /api/public/site] site_settings lookup failed:", err?.message);
  }
  res.json({ whatsapp: whatsapp ?? "" });
});

// POST /api/public/marketing-events — stub accepts events and returns OK.
// Keeps beacon from erroring until analytics ingestion is wired.
publicRouter.post("/marketing-events", (_req, res) => {
  res.json({ ok: true });
});

