import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../lib/auth.js";
import { isDatabaseConnectionError, respondDatabaseUnavailable } from "../lib/dbErrors.js";

export const variantsRouter = Router();

// GET /api/variants?productId=... — list variants for a product (admin-only).
variantsRouter.get("/", requireAdmin, async (req, res) => {
  const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
  const where = productId ? { productId } : {};
  try {
    const variants = await prisma.productVariant.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: { product: { select: { id: true, title: true, slug: true } } },
    });
    res.json({ variants });
  } catch (e) {
    if (isDatabaseConnectionError(e)) return respondDatabaseUnavailable(res, e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

const VariantPatchSchema = z.object({
  color: z.string().max(80).optional().nullable(),
  pendantType: z.string().max(80).optional().nullable(),
  material: z.string().max(80).optional().nullable(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  lowThreshold: z.number().int().min(0).max(1_000_000).optional(),
  sku: z.string().min(1).max(80).optional().nullable(),
  priceOverride: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  note: z.string().max(200).optional().nullable(),
});

const VariantCreateSchema = z.object({
  productId: z.string().min(1),
  color: z.string().max(80).optional().nullable(),
  pendantType: z.string().max(80).optional().nullable(),
  material: z.string().max(80).optional().nullable(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  lowThreshold: z.number().int().min(0).max(1_000_000).optional(),
  priceOverride: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});

// POST /api/variants — admin add a variant for a product.
variantsRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = VariantCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  const { productId, color, pendantType, material, stock, lowThreshold, priceOverride, isActive } = parsed.data;
  try {
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return res.status(404).json({ error: "PRODUCT_NOT_FOUND" });
    const variant = await prisma.productVariant.create({
      data: {
        productId,
        color: color ?? "חדש",
        pendantType: pendantType ?? null,
        material: material ?? null,
        stock: stock ?? 0,
        lowThreshold: lowThreshold ?? 5,
        priceOverride: priceOverride ?? null,
        isActive: isActive ?? true,
      },
    });
    return res.status(201).json({ variant });
  } catch (e: any) {
    if (String(e?.code) === "P2002") return res.status(409).json({ error: "VARIANT_COMBINATION_EXISTS" });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// PATCH /api/variants/:id — admin edit with InventoryLog on stock change.
variantsRouter.patch("/:id", requireAdmin, async (req, res) => {
  const parsed = VariantPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  const { color, pendantType, material, stock, lowThreshold, sku, priceOverride, isActive, note } = parsed.data;
  const actorId = (req as any).admin?.id ?? null;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.productVariant.findUnique({ where: { id: req.params.id } });
      if (!current) return { ok: false as const, code: 404 };

      const data: any = {};
      if (color !== undefined) data.color = color;
      if (pendantType !== undefined) data.pendantType = pendantType;
      if (material !== undefined) data.material = material;
      if (lowThreshold !== undefined) data.lowThreshold = lowThreshold;
      if (sku !== undefined) data.sku = sku;
      if (priceOverride !== undefined) data.priceOverride = priceOverride;
      if (isActive !== undefined) data.isActive = isActive;
      if (stock !== undefined) data.stock = stock;

      const next = await tx.productVariant.update({ where: { id: current.id }, data });

      if (stock !== undefined && stock !== current.stock) {
        await tx.inventoryLog.create({
          data: {
            variantId: current.id,
            delta: stock - current.stock,
            reason: "MANUAL_ADJUSTMENT",
            actorId,
            note: note ?? null,
          },
        });
      }

      return { ok: true as const, variant: next };
    });

    if (!updated.ok) return res.status(updated.code).json({ error: "NOT_FOUND" });
    return res.json({ variant: updated.variant });
  } catch (e: any) {
    if (String(e?.code) === "P2002") {
      return res.status(409).json({ error: "VARIANT_COMBINATION_EXISTS" });
    }
    if (String(e?.message || "").includes("variant_stock_nonneg")) {
      return res.status(400).json({ error: "INVALID_STOCK" });
    }
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// DELETE /api/variants/:id — admin remove a variant.
variantsRouter.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await prisma.productVariant.delete({ where: { id: req.params.id } });
    return res.json({ deleted: true });
  } catch (e: any) {
    if (String(e?.code) === "P2025") return res.status(404).json({ error: "NOT_FOUND" });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});
