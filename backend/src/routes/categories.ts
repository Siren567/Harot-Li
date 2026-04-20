import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { getSupabaseAdminClient } from "../supabase/client.js";
import { requireAdmin } from "../lib/auth.js";
import { invalidatePublicProductsCache } from "./public.js";

export const categoriesRouter = Router();

const FALLBACK_TREE = [
  {
    id: "seed-main-necklaces",
    name: "שרשראות",
    slug: "necklaces",
    description: null,
    imageUrl: null,
    parentId: null,
    isActive: true,
    sortOrder: 1,
    seoTitle: null,
    seoDescription: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subcategories: [
      {
        id: "seed-sub-necklaces-men",
        name: "שרשראות גברים",
        slug: "necklaces-men",
        description: null,
        imageUrl: null,
        parentId: "seed-main-necklaces",
        isActive: true,
        sortOrder: 1,
        seoTitle: null,
        seoDescription: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "seed-sub-necklaces-women",
        name: "שרשראות נשים",
        slug: "necklaces-women",
        description: null,
        imageUrl: null,
        parentId: "seed-main-necklaces",
        isActive: true,
        sortOrder: 2,
        seoTitle: null,
        seoDescription: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: "seed-main-bracelets",
    name: "צמידים",
    slug: "bracelets",
    description: null,
    imageUrl: null,
    parentId: null,
    isActive: true,
    sortOrder: 2,
    seoTitle: null,
    seoDescription: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subcategories: [
      {
        id: "seed-sub-bracelets-men",
        name: "צמידי גברים",
        slug: "bracelets-men",
        description: null,
        imageUrl: null,
        parentId: "seed-main-bracelets",
        isActive: true,
        sortOrder: 1,
        seoTitle: null,
        seoDescription: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "seed-sub-bracelets-women",
        name: "צמידי נשים",
        slug: "bracelets-women",
        description: null,
        imageUrl: null,
        parentId: "seed-main-bracelets",
        isActive: true,
        sortOrder: 2,
        seoTitle: null,
        seoDescription: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: "seed-main-keychains",
    name: "מחזיקי מפתחות",
    slug: "keychains",
    description: null,
    imageUrl: null,
    parentId: null,
    isActive: true,
    sortOrder: 3,
    seoTitle: null,
    seoDescription: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subcategories: [],
  },
  {
    id: "seed-main-other",
    name: "אחר",
    slug: "other",
    description: null,
    imageUrl: null,
    parentId: null,
    isActive: true,
    sortOrder: 4,
    seoTitle: null,
    seoDescription: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subcategories: [],
  },
];

const CATEGORIES_FALLBACK_KEY = "categories_fallback_tree_v1";

type FlatCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
};

function flattenTree(tree: any[]): FlatCategory[] {
  const flat: FlatCategory[] = [];
  for (const main of tree || []) {
    const mainNode: FlatCategory = {
      id: String(main.id),
      name: String(main.name || ""),
      slug: String(main.slug || ""),
      description: main.description ?? null,
      imageUrl: main.imageUrl ?? null,
      parentId: null,
      isActive: Boolean(main.isActive ?? true),
      sortOrder: Number(main.sortOrder ?? 0),
      seoTitle: main.seoTitle ?? null,
      seoDescription: main.seoDescription ?? null,
      createdAt: String(main.createdAt || new Date().toISOString()),
      updatedAt: String(main.updatedAt || new Date().toISOString()),
    };
    flat.push(mainNode);
    const subs = Array.isArray(main.subcategories) ? main.subcategories : [];
    for (const sub of subs) {
      flat.push({
        id: String(sub.id),
        name: String(sub.name || ""),
        slug: String(sub.slug || ""),
        description: sub.description ?? null,
        imageUrl: sub.imageUrl ?? null,
        parentId: String(sub.parentId || main.id),
        isActive: Boolean(sub.isActive ?? true),
        sortOrder: Number(sub.sortOrder ?? 0),
        seoTitle: sub.seoTitle ?? null,
        seoDescription: sub.seoDescription ?? null,
        createdAt: String(sub.createdAt || new Date().toISOString()),
        updatedAt: String(sub.updatedAt || new Date().toISOString()),
      });
    }
  }
  return flat;
}

function toTree(rows: FlatCategory[]) {
  const mains = rows
    .filter((r) => !r.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((main) => ({
      ...main,
      subcategories: rows
        .filter((r) => r.parentId === main.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    }));
  return mains;
}

async function loadFallbackRows(): Promise<FlatCategory[]> {
  try {
    const sb = getSupabaseAdminClient();
    const { data } = await sb.from("site_settings").select("value").eq("key", CATEGORIES_FALLBACK_KEY).maybeSingle();
    const value = data?.value;
    if (Array.isArray(value)) return value as FlatCategory[];
  } catch {
    // ignore and use seeded fallback
  }
  return flattenTree(FALLBACK_TREE as any[]);
}

async function saveFallbackRows(rows: FlatCategory[]) {
  const sb = getSupabaseAdminClient();
  await sb.from("site_settings").upsert({ key: CATEGORIES_FALLBACK_KEY, value: rows }, { onConflict: "key" });
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

const optionalUrl = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.union([z.string().url(), z.null()]).optional()
);

const CategoryBaseSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: optionalUrl,
  parentId: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.union([z.string().min(1).max(120), z.null()]).optional()
  ),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  seoTitle: z.string().max(120).optional().nullable(),
  seoDescription: z.string().max(320).optional().nullable(),
});

const CategoryCreateSchema = CategoryBaseSchema;

const CategoryUpdateSchema = CategoryBaseSchema.partial().superRefine((val, ctx) => {
  if (val.slug !== undefined && val.slug != null && val.slug.trim().length === 0) {
    ctx.addIssue({ code: "custom", path: ["slug"], message: "Slug לא יכול להיות ריק" });
  }
});

function typeFromParent(parentId?: string | null) {
  return parentId ? "sub" : "main";
}

async function ensureParentIsMain(parentId: string) {
  const parent = await prisma.category.findUnique({ where: { id: parentId } });
  if (!parent) return { ok: false as const, error: "PARENT_NOT_FOUND" as const };
  if (parent.parentId) return { ok: false as const, error: "PARENT_NOT_MAIN" as const };
  return { ok: true as const, parent };
}

async function ensureNoCircularDepth2(categoryId: string, nextParentId: string | null) {
  // Enforce depth ≤ 2 and no cycles.
  if (!nextParentId) return { ok: true as const };
  if (nextParentId === categoryId) return { ok: false as const, error: "CIRCULAR" as const };

  const parent = await prisma.category.findUnique({ where: { id: nextParentId } });
  if (!parent) return { ok: false as const, error: "PARENT_NOT_FOUND" as const };
  if (parent.parentId) return { ok: false as const, error: "DEPTH_LIMIT" as const };

  return { ok: true as const };
}

async function reassignProductsFromSubcategoryToParent(tx: any, subcategoryId: string, parentCategoryId: string) {
  const affected = await tx.product.findMany({
    where: {
      OR: [
        { mainCategoryId: subcategoryId },
        { categories: { some: { categoryId: subcategoryId } } },
      ],
    },
    select: { id: true },
  });

  const productIds: string[] = Array.from(
    new Set(affected.map((p: { id: string }) => p.id).filter((id: string | undefined): id is string => Boolean(id)))
  );
  if (productIds.length === 0) return 0;

  await tx.product.updateMany({
    where: { id: { in: productIds }, mainCategoryId: subcategoryId },
    data: { mainCategoryId: parentCategoryId },
  });

  await tx.categoryProduct.createMany({
    data: productIds.map((productId: string) => ({ categoryId: parentCategoryId, productId })),
    skipDuplicates: true,
  });

  await tx.categoryProduct.deleteMany({
    where: { categoryId: subcategoryId, productId: { in: productIds } },
  });

  return productIds.length;
}

/** Products tied to this main category: mainCategoryId or any CategoryProduct on main / its subs. */
async function countProductsForMainCategory(mainId: string, subcategoryIds: string[]) {
  const ids = [mainId, ...subcategoryIds];
  return prisma.product.count({
    where: {
      OR: [{ mainCategoryId: mainId }, { categories: { some: { categoryId: { in: ids } } } }],
    },
  });
}

/** Products tied to this subcategory: mainCategoryId or CategoryProduct on sub. */
async function countProductsForSubCategory(subId: string) {
  return prisma.product.count({
    where: {
      OR: [{ mainCategoryId: subId }, { categories: { some: { categoryId: subId } } }],
    },
  });
}

async function attachProductCountsToCategoryTree(mains: Array<{ id: string; subcategories?: Array<{ id: string }> }>) {
  return Promise.all(
    mains.map(async (m) => {
      const subIds = (m.subcategories ?? []).map((s) => s.id);
      const mainProductCount = await countProductsForMainCategory(m.id, subIds);
      const subcategories = await Promise.all(
        (m.subcategories ?? []).map(async (s) => ({
          ...s,
          productCount: await countProductsForSubCategory(s.id),
        }))
      );
      return { ...m, productCount: mainProductCount, subcategories };
    })
  );
}

categoriesRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const type = typeof req.query.type === "string" ? req.query.type : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const parentId = typeof req.query.parentId === "string" ? req.query.parentId : "";

  const where: any = {};
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (type === "main") where.parentId = null;
  if (type === "sub") where.parentId = { not: null };
  if (parentId) where.parentId = parentId;

  try {
    const categories = await prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return res.json({ categories });
  } catch {
    const rows = await loadFallbackRows();
    let categories = [...rows];
    if (q) {
      const qq = q.toLowerCase();
      categories = categories.filter((c) => String(c.name || "").toLowerCase().includes(qq));
    }
    if (status === "active") categories = categories.filter((c) => c.isActive);
    if (status === "inactive") categories = categories.filter((c) => !c.isActive);
    if (type === "main") categories = categories.filter((c) => !c.parentId);
    if (type === "sub") categories = categories.filter((c) => !!c.parentId);
    if (parentId) categories = categories.filter((c) => c.parentId === parentId);
    return res.json({ categories });
  }
});

categoriesRouter.get("/tree", async (_req, res) => {
  try {
    const mains = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        subcategories: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    const withCounts = await attachProductCountsToCategoryTree(mains);
    res.json({ categories: withCounts });
  } catch (err: any) {
    console.error("[GET /api/categories/tree] FAILED name=", err?.name);
    console.error("[GET /api/categories/tree] FAILED code=", err?.code);
    console.error("[GET /api/categories/tree] FAILED meta=", JSON.stringify(err?.meta ?? null));
    console.error("[GET /api/categories/tree] FAILED message=", String(err?.message ?? err));
    // Fallback categories so product/category UIs keep working if Prisma DB is unavailable.
    const rows = await loadFallbackRows();
    res.json({ categories: toTree(rows) });
  }
});

categoriesRouter.get("/stats", async (_req, res) => {
  try {
    const total = await prisma.category.count();
    const main = await prisma.category.count({ where: { parentId: null } });
    const sub = await prisma.category.count({ where: { parentId: { not: null } } });
    const active = await prisma.category.count({ where: { isActive: true } });
    const inactive = await prisma.category.count({ where: { isActive: false } });

    // Product counts are future-ready; we still expose the shape.
    res.json({ stats: { total, main, sub, active, inactive } });
  } catch {
    const rows = await loadFallbackRows();
    const main = rows.filter((r) => !r.parentId).length;
    const sub = rows.filter((r) => !!r.parentId).length;
    const total = main + sub;
    const active = rows.filter((r) => r.isActive).length;
    const inactive = rows.length - active;
    res.json({ stats: { total, main, sub, active, inactive } });
  }
});

categoriesRouter.get("/:id", async (req, res) => {
  const id = req.params.id;
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      subcategories: true,
      _count: { select: { products: true } },
    },
  });
  if (!category) {
    try {
      const rows = await loadFallbackRows();
      const current = rows.find((r) => r.id === id);
      if (!current) return res.status(404).json({ error: "NOT_FOUND" });
      const subcategories = rows.filter((r) => r.parentId === id);
      return res.json({ category: { ...current, subcategories, productCount: 0 } });
    } catch {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
  }

  let productCount = 0;
  if (!category.parentId) {
    const subIds = (category.subcategories ?? []).map((s) => s.id);
    productCount = await countProductsForMainCategory(category.id, subIds);
  } else {
    productCount = await countProductsForSubCategory(category.id);
  }

  res.json({ category: { ...category, productCount } });
});

categoriesRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = CategoryCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  const data = parsed.data;
  const slug = slugify(data.slug?.trim() ? data.slug : data.name);

  if (data.parentId) {
    const okParent = await ensureParentIsMain(data.parentId);
    if (!okParent.ok) return res.status(400).json({ error: okParent.error });
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: data.name.trim(),
        slug,
        description: data.description ?? null,
        imageUrl: data.imageUrl ?? null,
        parentId: data.parentId ?? null,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
        seoTitle: data.seoTitle ?? null,
        seoDescription: data.seoDescription ?? null,
      },
    });
    invalidatePublicProductsCache();
    res.status(201).json({ category });
  } catch (e: any) {
    if (String(e?.code) === "P2002") return res.status(409).json({ error: "SLUG_EXISTS" });
    try {
      const rows = await loadFallbackRows();
      const duplicate = rows.find((r) => r.slug === slug);
      if (duplicate) return res.status(409).json({ error: "SLUG_EXISTS" });
      if (data.parentId) {
        const parent = rows.find((r) => r.id === data.parentId);
        if (!parent) return res.status(400).json({ error: "PARENT_NOT_FOUND" });
        if (parent.parentId) return res.status(400).json({ error: "PARENT_NOT_MAIN" });
      }
      const now = new Date().toISOString();
      const category: FlatCategory = {
        id: randomUUID(),
        name: data.name.trim(),
        slug,
        description: data.description ?? null,
        imageUrl: data.imageUrl ?? null,
        parentId: data.parentId ?? null,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
        seoTitle: data.seoTitle ?? null,
        seoDescription: data.seoDescription ?? null,
        createdAt: now,
        updatedAt: now,
      };
      rows.push(category);
      await saveFallbackRows(rows);
      return res.status(201).json({ category });
    } catch {
      return res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
});

categoriesRouter.patch("/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  const parsed = CategoryUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  const data = parsed.data;

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "NOT_FOUND" });

  const nextParentId = data.parentId !== undefined ? (data.parentId ?? null) : existing.parentId;
  if (data.parentId !== undefined) {
    const circular = await ensureNoCircularDepth2(id, nextParentId);
    if (!circular.ok) return res.status(400).json({ error: circular.error });
    if (nextParentId) {
      const okParent = await ensureParentIsMain(nextParentId);
      if (!okParent.ok) return res.status(400).json({ error: okParent.error });
    }
  }

  // Slug: never overwrite a stable unique slug with a "base" slug derived from name when the
  // client sends slug=null (empty field) but the name did not change — that caused 409 conflicts
  // (e.g. qa-main-uuid shortened to qa-main) on saves that only toggled isActive.
  const incomingName = data.name !== undefined ? data.name.trim() : existing.name;
  const nameChanged = data.name !== undefined && incomingName !== existing.name;
  let nextSlug = existing.slug;
  if (data.slug !== undefined) {
    const raw = data.slug;
    if (raw != null && String(raw).trim().length > 0) {
      nextSlug = slugify(String(raw).trim());
    } else if (nameChanged) {
      nextSlug = slugify(incomingName);
    }
  }
  if (!nextSlug) nextSlug = existing.slug;
  const slugNeedsDbUpdate = nextSlug !== existing.slug;
  if (slugNeedsDbUpdate) {
    const taken = await prisma.category.findFirst({ where: { slug: nextSlug, id: { not: id } } });
    if (taken) return res.status(409).json({ error: "SLUG_EXISTS" });
  }

  try {
    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(slugNeedsDbUpdate ? { slug: nextSlug } : {}),
          ...(data.description !== undefined ? { description: data.description ?? null } : {}),
          ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl ?? null } : {}),
          ...(data.parentId !== undefined ? { parentId: nextParentId } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
          ...(data.seoTitle !== undefined ? { seoTitle: data.seoTitle ?? null } : {}),
          ...(data.seoDescription !== undefined ? { seoDescription: data.seoDescription ?? null } : {}),
        },
      });

      if (data.sortOrder !== undefined) {
        const siblings = await tx.category.findMany({
          where: { parentId: updated.parentId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });
        const others = siblings.filter((c) => c.id !== updated.id);
        const target = Math.max(0, Math.min(data.sortOrder, others.length));
        others.splice(target, 0, updated);
        for (let idx = 0; idx < others.length; idx += 1) {
          if (others[idx].sortOrder === idx) continue;
          await tx.category.update({ where: { id: others[idx].id }, data: { sortOrder: idx } });
        }
      }
      if (data.isActive === false && updated.parentId) {
        await reassignProductsFromSubcategoryToParent(tx, updated.id, updated.parentId);
      }
      return tx.category.findUniqueOrThrow({ where: { id: updated.id } });
    });
    invalidatePublicProductsCache();
    res.json({ category });
  } catch (e: any) {
    if (String(e?.code) === "P2002") return res.status(409).json({ error: "SLUG_EXISTS" });
    try {
      const rows = await loadFallbackRows();
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) return res.status(404).json({ error: "NOT_FOUND" });
      const duplicate = rows.find((r) => r.slug === nextSlug && r.id !== id);
      if (duplicate) return res.status(409).json({ error: "SLUG_EXISTS" });
      const current = rows[idx];
      const updated: FlatCategory = {
        ...current,
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(slugNeedsDbUpdate ? { slug: nextSlug } : {}),
        ...(data.description !== undefined ? { description: data.description ?? null } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl ?? null } : {}),
        ...(data.parentId !== undefined ? { parentId: nextParentId } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.seoTitle !== undefined ? { seoTitle: data.seoTitle ?? null } : {}),
        ...(data.seoDescription !== undefined ? { seoDescription: data.seoDescription ?? null } : {}),
        updatedAt: new Date().toISOString(),
      };
      rows[idx] = updated;
      await saveFallbackRows(rows);
      return res.json({ category: updated });
    } catch {
      return res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
});

categoriesRouter.post("/:id/toggle", requireAdmin, async (req, res) => {
  const id = req.params.id;
  const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "NOT_FOUND" });

  const { isActive } = parsed.data;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({ where: { id }, data: { isActive } });
      // default cascade: if main category toggled inactive -> inactivate subcategories too
      if (!isActive && !existing.parentId) {
        await tx.category.updateMany({ where: { parentId: id }, data: { isActive: false } });
      }
      if (!isActive && existing.parentId) {
        await reassignProductsFromSubcategoryToParent(tx, id, existing.parentId);
      }
      return updated;
    });
    invalidatePublicProductsCache();
    res.json({ category: result });
  } catch {
    try {
      const rows = await loadFallbackRows();
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) return res.status(404).json({ error: "NOT_FOUND" });
      rows[idx] = { ...rows[idx], isActive, updatedAt: new Date().toISOString() };
      if (!isActive && !rows[idx].parentId) {
        for (let i = 0; i < rows.length; i += 1) {
          if (rows[i].parentId === id) rows[i] = { ...rows[i], isActive: false, updatedAt: new Date().toISOString() };
        }
      }
      await saveFallbackRows(rows);
      return res.json({ category: rows[idx] });
    } catch {
      return res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
});

categoriesRouter.delete("/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;

  let existing: { id: string; parentId: string | null } | null = null;
  try {
    existing = await prisma.category.findUnique({ where: { id }, select: { id: true, parentId: true } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[DELETE /api/categories/:id] findUnique failed", err);
    existing = null;
  }

  if (existing) {
    const isSubcategory = Boolean(existing.parentId);

    try {
      await prisma.$transaction(async (tx) => {
        if (!isSubcategory) {
          const subs = await tx.category.findMany({
            where: { parentId: id },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: { id: true },
          });
          for (const sub of subs) {
            await reassignProductsFromSubcategoryToParent(tx, sub.id, id);
            await tx.categoryProduct.deleteMany({ where: { categoryId: sub.id } });
            await tx.category.delete({ where: { id: sub.id } });
          }
        }
        if (isSubcategory && existing.parentId) {
          await reassignProductsFromSubcategoryToParent(tx, id, existing.parentId);
        }
        await tx.categoryProduct.deleteMany({ where: { categoryId: id } });
        await tx.product.updateMany({ where: { mainCategoryId: id }, data: { mainCategoryId: null } });
        await tx.category.delete({ where: { id } });
      });
      invalidatePublicProductsCache();
      return res.status(200).json({ deleted: true });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("[DELETE /api/categories/:id] prisma delete failed", err);
      const code = String(err?.code ?? "");
      if (code === "P2025") return res.status(404).json({ error: "NOT_FOUND" });
      if (code === "P2003" || code === "P2014") {
        return res.status(409).json({ error: "HAS_DEPENDENCIES", message: String(err?.message ?? "") });
      }
      return res.status(500).json({ error: "SERVER_ERROR" });
    }
  }

  try {
    const rows = await loadFallbackRows();
    const exists = rows.some((r) => r.id === id);
    if (!exists) return res.status(404).json({ error: "NOT_FOUND" });
    const childrenFallback = rows.some((r) => r.parentId === id);
    if (childrenFallback) return res.status(409).json({ error: "HAS_SUBCATEGORIES" });
    const next = rows.filter((r) => r.id !== id);
    await saveFallbackRows(next);
    return res.status(200).json({ deleted: true });
  } catch {
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

