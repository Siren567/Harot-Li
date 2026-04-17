import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

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

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u0590-\u05FF]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const CategoryBaseSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  seoTitle: z.string().max(120).optional().nullable(),
  seoDescription: z.string().max(320).optional().nullable(),
});

const CategoryCreateSchema = CategoryBaseSchema.superRefine((val, ctx) => {
  if (val.parentId && val.parentId.length < 10) {
    ctx.addIssue({ code: "custom", path: ["parentId"], message: "קטגוריית אב לא תקינה" });
  }
});

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

  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  res.json({ categories });
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
  } catch {
    // Fallback categories so product/category UIs keep working if Prisma DB is unavailable.
    res.json({ categories: FALLBACK_TREE });
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
    const main = FALLBACK_TREE.length;
    const sub = FALLBACK_TREE.reduce((acc, c: any) => acc + (Array.isArray(c.subcategories) ? c.subcategories.length : 0), 0);
    const total = main + sub;
    res.json({ stats: { total, main, sub, active: total, inactive: 0 } });
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
  if (!category) return res.status(404).json({ error: "NOT_FOUND" });

  res.json({ category: { ...category, productCount: 0 } });
});

categoriesRouter.post("/", async (req, res) => {
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
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

categoriesRouter.patch("/:id", async (req, res) => {
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
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

categoriesRouter.post("/:id/toggle", async (req, res) => {
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
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

categoriesRouter.delete("/:id", async (req, res) => {
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
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

