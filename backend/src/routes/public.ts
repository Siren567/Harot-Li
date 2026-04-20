import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { getSupabaseAdminClient } from "../supabase/client.js";

export const publicRouter = Router();
const PRODUCTS_CACHE_TTL_MS = 30_000;
let cachedProductsPayload: { products: any[] } | null = null;
let cachedProductsUntil = 0;
let productsInFlight: Promise<{ products: any[] }> | null = null;

function mapMainCategoryToStudio(mainCategoryId?: string | null) {
  const id = String(mainCategoryId ?? "").toLowerCase();
  if (id.includes("couple") || id.includes("זוג")) return "couple";
  if (id.includes("bracelet") || id.includes("צמיד")) return "bracelets";
  if (id.includes("key") || id.includes("מחזיק")) return "keychains";
  if (id.includes("necklace") || id.includes("שרשר")) return "necklaces";
  return "other";
}

function mapMainCategoryToStudioByText(rawSlug = "", rawName = "") {
  const s = String(rawSlug).toLowerCase();
  const n = String(rawName).toLowerCase();
  if (s.includes("couple") || n.includes("זוג")) return "couple";
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

function mapAudienceKey(raw?: string | null): "men" | "women" | "couple" | null {
  const source = String(raw ?? "").trim().toLowerCase();
  if (!source) return null;
  if (source.includes("couple") || source.includes("זוג")) return "couple";
  if (source.includes("women") || source.includes("woman") || source.includes("נשים") || source.includes("אישה")) return "women";
  if (source.includes("men") || source.includes("man") || source.includes("גברים") || source.includes("גבר")) return "men";
  return null;
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

function normalizeColorToken(raw?: string | null): "gold" | "silver" | "rose" | "black" | null {
  const x = String(raw ?? "").trim().toLowerCase();
  if (!x) return null;
  if (x.includes("זהב") || x.includes("gold")) return "gold";
  if (x.includes("כסף") || x.includes("silver")) return "silver";
  if (x.includes("רוז") || x.includes("rose")) return "rose";
  if (x.includes("שחור") || x.includes("black")) return "black";
  return null;
}

publicRouter.get("/products", async (_req, res) => {
  try {
    const now = Date.now();
    if (cachedProductsPayload && now < cachedProductsUntil) {
      return res.json(cachedProductsPayload);
    }
    if (productsInFlight) {
      const payload = await productsInFlight;
      return res.json(payload);
    }

    productsInFlight = (async () => {
      const rows = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        basePrice: true,
        salePrice: true,
        imageUrl: true,
        galleryImages: true,
        allowCustomerImageUpload: true,
        mainCategoryId: true,
        mainCategory: { select: { id: true, name: true, slug: true, parentId: true, isActive: true } },
        categories: { select: { category: { select: { id: true, name: true, slug: true, parentId: true, isActive: true } } } },
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            color: true,
            pendantType: true,
            material: true,
            stock: true,
            lowThreshold: true,
            priceOverride: true,
            isActive: true,
          },
        },
      },
      });

      const products = rows.map((p) => {
      const allCategoryRows = (p.categories ?? []).map((x) => x.category).filter((c) => Boolean(c?.isActive));
      const mainRaw = p.mainCategory?.isActive ? p.mainCategory : null;
      const subRows = allCategoryRows.filter((c) => c.id !== p.mainCategoryId && c.isActive !== false);
      const subRawFirst = subRows[0] ?? null;
      const effectiveMain = mainRaw?.parentId ? allCategoryRows.find((c) => c.id === mainRaw.parentId) ?? mainRaw : mainRaw;

      const image = p.imageUrl ?? null;
      const gallery = Array.isArray(p.galleryImages) ? p.galleryImages.filter(Boolean) : [];
      const images = Array.from(new Set([image, ...gallery].filter(Boolean))) as string[];
      const effectivePriceAgorot = p.salePrice && p.salePrice > 0 && p.salePrice < p.basePrice ? p.salePrice : p.basePrice;
      const studioColors = mapStudioColors(
        Array.from(
          new Set(
            (p.variants ?? [])
              .map((v) => v.color)
              .filter((v): v is string => typeof v === "string" && v.trim().length > 0),
          ),
        ),
      );
      const allowedColorKeys = new Set(studioColors);
      // Strict product-scoped color filtering: never leak unrelated variant colors.
      const activeVariants = (p.variants ?? []).filter((v) => {
        const key = normalizeColorToken(v.color);
        if (allowedColorKeys.size === 0) return true;
        if (!key) return false;
        return allowedColorKeys.has(key);
      });
      const totalStock = activeVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      const variantLowThresholds = activeVariants.map((v) => Number(v.lowThreshold) || 5);
      const computedLow = variantLowThresholds.length > 0 ? Math.min(...variantLowThresholds) : 5;
      const subcategoryLabels = pickSubcategoryLabels([
        ...subRows.map((s) => s?.name ?? null),
        ...subRows.map((s) => s?.slug ?? null),
      ]);
      const audienceCandidates = [
        ...subRows.map((s) => s?.slug ?? null),
        ...subRows.map((s) => s?.name ?? null),
        ...subcategoryLabels,
        subRawFirst?.slug ?? null,
        subRawFirst?.name ?? null,
        p.title,
      ];
      const audienceKeys = Array.from(new Set(audienceCandidates.map((v) => mapAudienceKey(v)).filter(Boolean))) as Array<"men" | "women" | "couple">;
      const primaryAudience = audienceKeys.length === 1 ? audienceKeys[0] : audienceKeys.includes("couple") ? "couple" : audienceKeys[0] ?? null;
      return {
        id: p.id,
        name: p.title,
        description: p.description ?? "",
        price: Number((effectivePriceAgorot / 100).toFixed(2)),
        image,
        images,
        mainCategoryId: effectiveMain?.id ?? p.mainCategoryId ?? null,
        subcategoryIds: subRows.map((s) => s.id),
        studioCategory: effectiveMain
          ? mapMainCategoryToStudioByText(effectiveMain.slug, effectiveMain.name)
          : mapMainCategoryToStudio(p.mainCategoryId),
        subcategoryLabel: pickSubcategoryLabel(
          [
            ...subRows.map((s) => s?.name),
            ...subRows.map((s) => s?.slug),
          ],
          p.title
        ),
        subcategoryLabels,
        audience: primaryAudience,
        audiences: audienceKeys,
        categoryName: effectiveMain?.name ?? null,
        subcategoryName: subRawFirst?.name ?? null,
        studioColors,
        allowCustomerImageUpload: Boolean(p.allowCustomerImageUpload),
        stock: totalStock,
        lowThreshold: computedLow,
        variants: activeVariants.map((v) => ({
          id: v.id,
          color: v.color,
          pendantType: v.pendantType,
          material: v.material,
          stock: Number(v.stock) || 0,
          lowThreshold: Number(v.lowThreshold) || 5,
          price: Number(((v.priceOverride ?? effectivePriceAgorot) / 100).toFixed(2)),
          isActive: v.isActive,
        })),
      };
      });
      return { products };
    })();
    const payload = await productsInFlight;
    cachedProductsPayload = payload;
    cachedProductsUntil = Date.now() + PRODUCTS_CACHE_TTL_MS;
    return res.json(payload);
  } catch (err: any) {
    // Log the full Prisma error (name + code + meta + message + stack) on separate lines
    // so Vercel keeps each field intact and we can see the schema-drift cause.
    console.error("[GET /api/public/products] FAILED name=", err?.name);
    console.error("[GET /api/public/products] FAILED code=", err?.code);
    console.error("[GET /api/public/products] FAILED clientVersion=", err?.clientVersion);
    console.error("[GET /api/public/products] FAILED meta=", JSON.stringify(err?.meta ?? null));
    console.error("[GET /api/public/products] FAILED message=", String(err?.message ?? err));
    console.error("[GET /api/public/products] FAILED stack=", err?.stack);
    res.status(500).json({ error: "SERVER_ERROR", hint: String(err?.message ?? "").slice(0, 500) });
  } finally {
    productsInFlight = null;
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

const orderStatusSelect = {
  orderNumber: true,
  status: true,
  createdAt: true,
  total: true,
} as const;

function normalizeOrderLookupInput(raw: string) {
  return raw.trim().replace(/^#+/u, "").replace(/\s+/g, "");
}

/** DB stores HG-YYYYMMDD-XXXX; users often paste digits-only or a short suffix. */
async function findOrderForPublicLookup(rawInput: string) {
  const q = normalizeOrderLookupInput(rawInput);
  if (!q || q.length > 80) return null;

  const byExact = await prisma.order.findUnique({ where: { orderNumber: q }, select: orderStatusSelect });
  if (byExact) return byExact;

  const byCi = await prisma.order.findFirst({
    where: { orderNumber: { equals: q, mode: "insensitive" } },
    select: orderStatusSelect,
    orderBy: { createdAt: "desc" },
  });
  if (byCi) return byCi;

  const qDigits = q.replace(/\D/g, "");
  if (!qDigits || qDigits.length > 24) return null;

  // Full digit-only match: e.g. 202604198234 vs HG-20260419-8234
  if (qDigits.length >= 8) {
    const fullRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Order"
      WHERE regexp_replace("orderNumber", '[^0-9]', '', 'g') = ${qDigits}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (fullRows[0]?.id) {
      return prisma.order.findUnique({ where: { id: fullRows[0].id }, select: orderStatusSelect });
    }
  }

  // Suffix on digit-only form (e.g. 2235 or 22235 — matches end of …20260222235)
  if (qDigits.length >= 4 && qDigits.length <= 15) {
    const sufRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Order"
      WHERE char_length(regexp_replace("orderNumber", '[^0-9]', '', 'g')) >= char_length(${qDigits}::text)
        AND RIGHT(regexp_replace("orderNumber", '[^0-9]', '', 'g'), char_length(${qDigits}::text)) = ${qDigits}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (sufRows[0]?.id) {
      return prisma.order.findUnique({ where: { id: sufRows[0].id }, select: orderStatusSelect });
    }
  }

  return null;
}

// GET /api/public/order-status?orderNumber=... — public order lookup (no auth).
publicRouter.get("/order-status", async (req, res) => {
  const raw = typeof req.query.orderNumber === "string" ? req.query.orderNumber : "";
  const q = normalizeOrderLookupInput(raw);
  if (!q || q.length > 80) {
    return res.status(400).json({ error: "INVALID_ORDER_NUMBER" });
  }
  try {
    const order = await findOrderForPublicLookup(raw);
    if (!order) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        totalAgorot: order.total,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/public/order-status]", err?.message ?? err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// POST /api/public/marketing-events — stub accepts events and returns OK.
// Keeps beacon from erroring until analytics ingestion is wired.
publicRouter.post("/marketing-events", (_req, res) => {
  res.json({ ok: true });
});

