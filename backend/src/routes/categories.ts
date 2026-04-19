import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { getSupabaseAdminClient } from "../supabase/client.js";
import { requireAdmin } from "../lib/auth.js";

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

    res.json({ categories: mains });
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

  res.json({ category: { ...category, productCount: 0 } });
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

  const nextSlug = data.slug !== undefined ? slugify(data.slug?.trim() ? data.slug : data.name ?? existing.name) : existing.slug;

  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.slug !== undefined || data.name !== undefined ? { slug: nextSlug } : {}),
        ...(data.description !== undefined ? { description: data.description ?? null } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl ?? null } : {}),
        ...(data.parentId !== undefined ? { parentId: nextParentId } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.seoTitle !== undefined ? { seoTitle: data.seoTitle ?? null } : {}),
        ...(data.seoDescription !== undefined ? { seoDescription: data.seoDescription ?? null } : {}),
      },
    });
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
        ...(data.slug !== undefined || data.name !== undefined ? { slug: nextSlug } : {}),
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
      return updated;
    });
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

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "NOT_FOUND" });

  const children = await prisma.category.count({ where: { parentId: id } });
  if (children > 0) return res.status(409).json({ error: "HAS_SUBCATEGORIES" });

  const assignments = await prisma.categoryProduct.count({ where: { categoryId: id } });
  if (assignments > 0) return res.status(409).json({ error: "HAS_PRODUCTS" });

  try {
    await prisma.category.delete({ where: { id } });
    res.status(204).send();
  } catch {
    try {
      const rows = await loadFallbackRows();
      const exists = rows.some((r) => r.id === id);
      if (!exists) return res.status(404).json({ error: "NOT_FOUND" });
      const childrenFallback = rows.some((r) => r.parentId === id);
      if (childrenFallback) return res.status(409).json({ error: "HAS_SUBCATEGORIES" });
      const next = rows.filter((r) => r.id !== id);
      await saveFallbackRows(next);
      return res.status(204).send();
    } catch {
      return res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
});

