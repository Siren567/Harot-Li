import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { reasonToHebrew, validateCoupon } from "../logic/coupons/validateCoupon.js";
import { CouponDiscountType } from "@prisma/client";

export const couponsRouter = Router();

const CodeSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/)
  .transform((s) => s.trim().toUpperCase());

const CouponBaseSchema = z.object({
  code: CodeSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional().nullable(),

  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.number().int().min(1),

  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  hasNoExpiry: z.boolean().optional(),

  minCartAmount: z.number().int().min(0).optional().nullable(),
  maxCartAmount: z.number().int().min(0).optional().nullable(),
  minItemsQuantity: z.number().int().min(0).optional().nullable(),

  appliesToAllProducts: z.boolean().optional(),
  includedProductIds: z.array(z.string()).optional().nullable(),
  includedCategoryIds: z.array(z.string()).optional().nullable(),
  excludedProductIds: z.array(z.string()).optional().nullable(),
  excludeSaleItems: z.boolean().optional(),

  newCustomersOnly: z.boolean().optional(),
  usageLimitTotal: z.number().int().min(0).optional().nullable(),
  usageLimitPerCustomer: z.number().int().min(0).optional().nullable(),
  allowCombining: z.boolean().optional(),
  freeShipping: z.boolean().optional(),
});

function refineCoupon(val: any, ctx: z.RefinementCtx) {
  if (val.discountType === "PERCENTAGE" && val.discountValue > 100) {
    ctx.addIssue({ code: "custom", path: ["discountValue"], message: "אחוז הנחה חייב להיות בין 1 ל-100" });
  }
  if (val.hasNoExpiry && val.endsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "לא ניתן להגדיר תאריך סיום כאשר אין תפוגה" });
  }
  if (val.startsAt && val.endsAt && new Date(val.startsAt) > new Date(val.endsAt)) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "תאריך סיום חייב להיות אחרי תאריך התחלה" });
  }
  if (val.minCartAmount != null && val.maxCartAmount != null && val.minCartAmount > val.maxCartAmount) {
    ctx.addIssue({ code: "custom", path: ["maxCartAmount"], message: "סכום מקסימלי חייב להיות גדול/שווה לסכום מינימלי" });
  }
}

const CouponCreateSchema = CouponBaseSchema.superRefine(refineCoupon);
const CouponUpdateSchema = CouponBaseSchema.partial().superRefine(refineCoupon);

function safeJsonArray(arr?: string[] | null) {
  if (!arr || arr.length === 0) return null;
  return arr as unknown as any;
}

couponsRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const type = typeof req.query.type === "string" ? req.query.type : "";

  const where: any = {};
  if (q) {
    where.OR = [
      { code: { contains: q.toUpperCase(), mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (status === "expired") where.endsAt = { lt: new Date() };
  if (status === "scheduled") where.startsAt = { gt: new Date() };

  if (type === "percentage") where.discountType = CouponDiscountType.PERCENTAGE;
  if (type === "fixed") where.discountType = CouponDiscountType.FIXED_AMOUNT;

  const coupons = await prisma.coupon.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
  });

  res.json({ coupons });
});

couponsRouter.get("/:id", async (req, res) => {
  const id = req.params.id;
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) return res.status(404).json({ error: "NOT_FOUND" });

  const usageTotal = await prisma.couponRedemption.count({ where: { couponId: id } });
  const topUsers = await prisma.couponRedemption.groupBy({
    by: ["customerId"],
    where: { couponId: id },
    _count: { customerId: true },
    orderBy: { _count: { customerId: "desc" } },
    take: 5,
  });

  res.json({ coupon, stats: { usageTotal, topUsers } });
});

couponsRouter.post("/", async (req, res) => {
  const parsed = CouponCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  const data = parsed.data;
  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        isActive: data.isActive ?? true,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        hasNoExpiry: data.hasNoExpiry ?? false,
        minCartAmount: data.minCartAmount ?? null,
        maxCartAmount: data.maxCartAmount ?? null,
        minItemsQuantity: data.minItemsQuantity ?? null,
        appliesToAllProducts: data.appliesToAllProducts ?? true,
        includedProductIds: safeJsonArray(data.includedProductIds),
        includedCategoryIds: safeJsonArray(data.includedCategoryIds),
        excludedProductIds: safeJsonArray(data.excludedProductIds),
        excludeSaleItems: data.excludeSaleItems ?? false,
        newCustomersOnly: data.newCustomersOnly ?? false,
        usageLimitTotal: data.usageLimitTotal ?? null,
        usageLimitPerCustomer: data.usageLimitPerCustomer ?? null,
        allowCombining: data.allowCombining ?? false,
        freeShipping: data.freeShipping ?? false,
      },
    });
    res.status(201).json({ coupon });
  } catch (e: any) {
    if (String(e?.code) === "P2002") {
      return res.status(409).json({ error: "CODE_EXISTS" });
    }
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

couponsRouter.patch("/:id", async (req, res) => {
  const id = req.params.id;
  const parsed = CouponUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  const data = parsed.data;

  try {
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(data.code ? { code: data.code } : {}),
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description ?? null } : {}),
        ...(data.discountType ? { discountType: data.discountType } : {}),
        ...(data.discountValue !== undefined ? { discountValue: data.discountValue } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.startsAt !== undefined ? { startsAt: data.startsAt ? new Date(data.startsAt) : null } : {}),
        ...(data.endsAt !== undefined ? { endsAt: data.endsAt ? new Date(data.endsAt) : null } : {}),
        ...(data.hasNoExpiry !== undefined ? { hasNoExpiry: data.hasNoExpiry } : {}),
        ...(data.minCartAmount !== undefined ? { minCartAmount: data.minCartAmount ?? null } : {}),
        ...(data.maxCartAmount !== undefined ? { maxCartAmount: data.maxCartAmount ?? null } : {}),
        ...(data.minItemsQuantity !== undefined ? { minItemsQuantity: data.minItemsQuantity ?? null } : {}),
        ...(data.appliesToAllProducts !== undefined ? { appliesToAllProducts: data.appliesToAllProducts } : {}),
        ...(data.includedProductIds !== undefined ? { includedProductIds: safeJsonArray(data.includedProductIds) } : {}),
        ...(data.includedCategoryIds !== undefined ? { includedCategoryIds: safeJsonArray(data.includedCategoryIds) } : {}),
        ...(data.excludedProductIds !== undefined ? { excludedProductIds: safeJsonArray(data.excludedProductIds) } : {}),
        ...(data.excludeSaleItems !== undefined ? { excludeSaleItems: data.excludeSaleItems } : {}),
        ...(data.newCustomersOnly !== undefined ? { newCustomersOnly: data.newCustomersOnly } : {}),
        ...(data.usageLimitTotal !== undefined ? { usageLimitTotal: data.usageLimitTotal ?? null } : {}),
        ...(data.usageLimitPerCustomer !== undefined ? { usageLimitPerCustomer: data.usageLimitPerCustomer ?? null } : {}),
        ...(data.allowCombining !== undefined ? { allowCombining: data.allowCombining } : {}),
        ...(data.freeShipping !== undefined ? { freeShipping: data.freeShipping } : {}),
      },
    });
    res.json({ coupon });
  } catch (e: any) {
    if (String(e?.code) === "P2025") return res.status(404).json({ error: "NOT_FOUND" });
    if (String(e?.code) === "P2002") return res.status(409).json({ error: "CODE_EXISTS" });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

couponsRouter.delete("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await prisma.coupon.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (String(e?.code) === "P2025") return res.status(404).json({ error: "NOT_FOUND" });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

const ValidateSchema = z.object({
  code: CodeSchema,
  cartSubtotal: z.number().int().min(0),
  itemsQuantity: z.number().int().min(0),
  customerEmail: z.string().email().optional().nullable(),
  now: z.string().datetime().optional(),
  existingCouponCode: z.string().optional().nullable(),
});

couponsRouter.post("/validate", async (req, res) => {
  const parsed = ValidateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  const { code, cartSubtotal, itemsQuantity, customerEmail, now, existingCouponCode } = parsed.data;

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return res.status(404).json({ ok: false, reason: "NOT_FOUND", message: reasonToHebrew("NOT_FOUND") });

  let customer: any = null;
  let customerOrdersCount = 0;
  let customerRedemptionsCount = 0;

  if (customerEmail) {
    customer = await prisma.customer.findUnique({ where: { email: customerEmail } });
    if (customer) {
      customerOrdersCount = await prisma.order.count({ where: { customerId: customer.id } });
      customerRedemptionsCount = await prisma.couponRedemption.count({ where: { couponId: coupon.id, customerId: customer.id } });
    }
  }

  const result = validateCoupon({
    coupon,
    customer,
    customerOrdersCount,
    customerRedemptionsCount,
    cartSubtotal,
    itemsQuantity,
    now: now ? new Date(now) : new Date(),
    existingCouponCode,
  });

  if (!result.ok) {
    return res.status(200).json({ ok: false, reason: result.reason, message: reasonToHebrew(result.reason) });
  }

  return res.json({ ok: true, code: result.code, discountAmount: result.discountAmount, freeShipping: result.freeShipping });
});

