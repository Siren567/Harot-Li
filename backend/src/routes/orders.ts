import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { reasonToHebrew, validateCoupon } from "../logic/coupons/validateCoupon.js";
import { getAnalyticsForRange } from "../services/analytics.service.js";
import { getSupabaseAdminClient } from "../supabase/client.js";
import { requireAdmin } from "../lib/auth.js";

export const ordersRouter = Router();

const OrderItemSchema = z.object({
  productId: z.string().min(1).max(120).optional().nullable(),
  variantId: z.string().min(1).max(120).optional().nullable(),
  name: z.string().min(1).max(200),
  qty: z.number().int().min(1).max(999),
  unitPrice: z.number().int().min(0),
  engravingText: z.string().max(4000).optional().nullable(),
  color: z.string().max(80).optional().nullable(),
  pendantShape: z.string().max(80).optional().nullable(),
  material: z.string().max(80).optional().nullable(),
  customerImageUrl: z.string().max(3_000_000).optional().nullable(),
});

const CreateOrderSchema = z.object({
  customer: z.object({
    fullName: z.string().max(120).optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
    email: z.string().email(),
    city: z.string().max(80).optional().nullable(),
    address: z.string().max(200).optional().nullable(),
  }),
  items: z.array(OrderItemSchema).min(1),
  shippingFee: z.number().int().min(0),
  couponCode: z.string().optional().nullable(),
});

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function productExtraKey(productId: string) {
  return `product_extra:${productId}`;
}

ordersRouter.get("/", requireAdmin, async (req, res) => {
  const limitRaw = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        customer: true,
        orderItems: true,
      },
    });
    res.json({ orders });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

ordersRouter.get("/dashboard", requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const prevMonthStart = new Date(monthAgo);
    prevMonthStart.setDate(prevMonthStart.getDate() - 30);

    const [allOrders, recentOrders, allCustomers, newCustomersLast30, newCustomersPrev30, analyticsLast30, analyticsPrev30] = await Promise.all([
      prisma.order.findMany({ include: { customer: true, orderItems: true }, orderBy: { createdAt: "desc" } }),
      prisma.order.findMany({
        where: { createdAt: { gte: monthAgo } },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.customer.findMany(),
      prisma.customer.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.customer.count({ where: { createdAt: { gte: prevMonthStart, lt: monthAgo } } }),
      getAnalyticsForRange(30),
      getAnalyticsForRange(60),
    ]);

    const totalRevenue = allOrders.reduce((sum: number, o: any) => sum + o.total, 0);
    const totalOrders = allOrders.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const pendingOrders = allOrders.filter((o: any) => o.status === "NEW").length;
    const completedOrders = allOrders.filter((o: any) => o.status === "PAID").length;
    const cancelledOrders = allOrders.filter((o: any) => o.status === "CANCELLED").length;
    const paidOrders = completedOrders;

    const revenueLast30 = recentOrders.reduce((sum: number, o: any) => sum + o.total, 0);
    const prevOrders = allOrders.filter((o: any) => o.createdAt >= prevMonthStart && o.createdAt < monthAgo);
    const revenuePrev30 = prevOrders.reduce((sum: number, o: any) => sum + o.total, 0);
    const revenueTrendPercent =
      revenuePrev30 > 0 ? Math.round(((revenueLast30 - revenuePrev30) / revenuePrev30) * 100) : revenueLast30 > 0 ? 100 : 0;

    const newCustomersTrendPercent =
      newCustomersPrev30 > 0
        ? Math.round(((newCustomersLast30 - newCustomersPrev30) / newCustomersPrev30) * 100)
        : newCustomersLast30 > 0
          ? 100
          : 0;

    const totalCustomers = allCustomers.length;
    const customersWithOrders = new Set(allOrders.map((o) => o.customerId));
    const customersWithoutOrders = Math.max(0, totalCustomers - customersWithOrders.size);
    const customersWithMultipleOrders = new Set(
      Object.entries(
        allOrders.reduce<Record<string, number>>((acc: Record<string, number>, o: any) => {
          acc[o.customerId] = (acc[o.customerId] ?? 0) + 1;
          return acc;
        }, {})
      )
        .filter(([, count]: [string, any]) => Number(count) > 1)
        .map(([customerId]) => customerId)
    ).size;
    const returningCustomersRatePercent = totalCustomers > 0 ? Number(((customersWithMultipleOrders / totalCustomers) * 100).toFixed(1)) : 0;
    const siteVisitsLast30 = analyticsLast30.reduce((sum, d) => sum + d.visits, 0);
    const siteVisitsPrev30 = analyticsPrev30
      .slice(0, 30)
      .reduce((sum, d) => sum + d.visits, 0);
    const paidRatePercent = siteVisitsLast30 > 0 ? Number(((paidOrders / siteVisitsLast30) * 100).toFixed(1)) : 0;
    const siteVisitsTrendPercent =
      siteVisitsPrev30 > 0
        ? Math.round(((siteVisitsLast30 - siteVisitsPrev30) / siteVisitsPrev30) * 100)
        : siteVisitsLast30 > 0
          ? 100
          : 0;
    const totalSessionSecondsLast30 = analyticsLast30.reduce((sum, d) => sum + d.sessionSeconds, 0);
    const totalSessionCountLast30 = analyticsLast30.reduce((sum, d) => sum + d.sessionCount, 0);
    const avgSessionSeconds = totalSessionCountLast30 > 0 ? Math.round(totalSessionSecondsLast30 / totalSessionCountLast30) : 0;

    const lineItemsForStats = (o: any) => {
      const rel = Array.isArray(o.orderItems) && o.orderItems.length ? o.orderItems : [];
      if (rel.length) return rel;
      return Array.isArray(o.items) ? (o.items as any[]) : [];
    };

    const totalItemsSold = allOrders.reduce((sum: number, o: any) => {
      const items = lineItemsForStats(o);
      return (
        sum +
        items.reduce((itemSum: number, it: any) => {
          const qty = Number(it?.qty ?? 0);
          return itemSum + (Number.isFinite(qty) ? qty : 0);
        }, 0)
      );
    }, 0);
    const avgItemsPerOrder = totalOrders > 0 ? Number((totalItemsSold / totalOrders).toFixed(2)) : 0;

    const topProductsMap = new Map<string, number>();
    for (const o of allOrders as any[]) {
      const items = lineItemsForStats(o);
      for (const it of items) {
        const name = String(it?.name ?? it?.nameSnapshot ?? "").trim();
        const qty = Number(it?.qty ?? 0);
        if (!name || !Number.isFinite(qty) || qty <= 0) continue;
        topProductsMap.set(name, (topProductsMap.get(name) ?? 0) + qty);
      }
    }
    const topProducts = Array.from(topProductsMap.entries())
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    // Revenue per day in the last 7 days
    const dailyRevenue: Array<{ date: string; total: number }> = [];
    const dailyOrders: Array<{ date: string; total: number }> = [];
    const dailySiteVisits: Array<{ date: string; total: number }> = [];
    const dailyNewCustomers: Array<{ date: string; total: number }> = [];
    const visitsByDate = new Map(analyticsLast30.map((row) => [row.date, row.visits]));
    for (let i = 6; i >= 0; i -= 1) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayKey = dayStart.toISOString().slice(0, 10);
      const dayTotal = allOrders
        .filter((o: any) => o.createdAt >= dayStart && o.createdAt < dayEnd)
        .reduce((sum: number, o: any) => sum + o.total, 0);
      const dayOrders = allOrders.filter((o: any) => o.createdAt >= dayStart && o.createdAt < dayEnd).length;
      const dayNewCustomers = allCustomers.filter((c: any) => c.createdAt >= dayStart && c.createdAt < dayEnd).length;
      dailyRevenue.push({ date: dayKey, total: dayTotal });
      dailyOrders.push({ date: dayKey, total: dayOrders });
      dailySiteVisits.push({ date: dayKey, total: visitsByDate.get(dayKey) ?? 0 });
      dailyNewCustomers.push({ date: dayKey, total: dayNewCustomers });
    }

    const recentOrdersPayload = recentOrders.slice(0, 8).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customer: o.customer?.fullName || o.customer?.email || "לקוח",
      total: o.total,
      payment: o.status === "PAID" ? "paid" : "unpaid",
      status: o.status === "PAID" ? "completed" : o.status === "CANCELLED" ? "cancelled" : "new",
      design: "—",
      createdAt: o.createdAt,
    }));

    res.json({
      stats: {
        totalRevenue,
        totalOrders,
        newCustomers: newCustomersLast30,
        avgOrderValue,
        siteVisits: siteVisitsLast30,
        siteVisitsTrendPercent,
        conversionRatePercent: paidRatePercent,
        conversionRateTrendPercent: 0,
        returningCustomersRatePercent,
        returningCustomersTrendPercent: 0,
        avgSessionSeconds,
        avgSessionTrendPercent: 0,
        pendingOrders,
        completedOrders,
        lowStockProducts: customersWithoutOrders,
        cancelledOrders,
        topProducts,
        customersWithoutOrders,
      },
      revenueTrendPercent,
      newCustomersTrendPercent,
      chartMonthLabel: "30 ימים אחרונים",
      dailyRevenue,
      dailyOrders,
      dailySiteVisits,
      dailyNewCustomers,
      recentOrders: recentOrdersPayload,
      stockAlerts: [],
    });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

async function generateUniqueOrderNumber(client: any = prisma) {
  // Human-readable number, unique-enforced by DB.
  // Format: HG-YYYYMMDD-<4 random digits>
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const prefix = `HG-${y}${m}${day}-`;
  for (let i = 0; i < 12; i++) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    const orderNumber = `${prefix}${suffix}`;
    const existing = await client.order.findUnique({ where: { orderNumber } });
    if (!existing) return orderNumber;
  }
  // fallback
  return `HG-${Date.now()}`;
}

// Resolve which variant should back an order line. Picks explicit variantId,
// else best match on (productId, color, pendantType, material), else first variant.
async function resolveVariant(
  tx: any,
  item: z.infer<typeof OrderItemSchema>
): Promise<{ variantId: string | null; productId: string | null }> {
  if (item.variantId) {
    const v = await tx.productVariant.findUnique({ where: { id: item.variantId } });
    if (v) return { variantId: v.id, productId: v.productId };
  }
  const productId = item.productId?.trim() || null;
  if (!productId) return { variantId: null, productId: null };
  const variants = await tx.productVariant.findMany({
    where: { productId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (variants.length === 0) return { variantId: null, productId };
  const match = variants.find(
    (v: any) =>
      (item.color ? v.color === item.color : true) &&
      (item.pendantShape ? v.pendantType === item.pendantShape : true) &&
      (item.material ? v.material === item.material : true)
  );
  return { variantId: (match || variants[0]).id, productId };
}

ordersRouter.post("/", async (req, res) => {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "VALIDATION", details: parsed.error.flatten() });
  }

  const { customer: inputCustomer, items, shippingFee, couponCode } = parsed.data;
  const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const itemsQuantity = items.reduce((sum, it) => sum + it.qty, 0);

  const code = couponCode?.trim() ? normalizeCode(couponCode) : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const normalizedEmail = inputCustomer.email.trim().toLowerCase();
      const customer = await tx.customer.upsert({
        where: { email: normalizedEmail },
        update: {
          fullName: inputCustomer.fullName ?? undefined,
          phone: inputCustomer.phone ?? undefined,
        },
        create: {
          email: normalizedEmail,
          fullName: inputCustomer.fullName ?? null,
          phone: inputCustomer.phone ?? null,
        },
      });

      // Resolve variants + validate stock BEFORE any writes.
      const resolved: Array<{ item: z.infer<typeof OrderItemSchema>; variantId: string | null; productId: string | null }> = [];
      for (const item of items) {
        const r = await resolveVariant(tx, item);
        resolved.push({ item, ...r });
      }

      // Aggregate qty per variant (same variant might appear on multiple lines).
      const variantDemand = new Map<string, number>();
      for (const r of resolved) {
        if (!r.variantId) continue;
        variantDemand.set(r.variantId, (variantDemand.get(r.variantId) ?? 0) + r.item.qty);
      }

      // Lock the variant rows so concurrent orders can't oversell.
      if (variantDemand.size > 0) {
        const variantIds = Array.from(variantDemand.keys());
        const locked: Array<{ id: string; stock: number; productId: string }> = await tx.$queryRawUnsafe(
          `SELECT id, stock, "productId" FROM "ProductVariant" WHERE id = ANY($1) FOR UPDATE`,
          variantIds
        );
        for (const v of locked) {
          const needed = variantDemand.get(v.id) ?? 0;
          if (v.stock < needed) {
            return { ok: false as const, reason: "OUT_OF_STOCK" as const, variantId: v.id, available: v.stock };
          }
        }
      }

      // Coupon validation (unchanged).
      let discountAmount = 0;
      let freeShipping = false;
      let appliedCouponId: string | null = null;

      if (code) {
        const coupon = await tx.coupon.findUnique({ where: { code } });
        if (!coupon) return { ok: false as const, reason: "NOT_FOUND" as const };

        const customerOrdersCount = await tx.order.count({ where: { customerId: customer.id } });
        const customerRedemptionsCount = await tx.couponRedemption.count({
          where: { couponId: coupon.id, customerId: customer.id },
        });

        const validation = validateCoupon({
          coupon,
          customer,
          customerOrdersCount,
          customerRedemptionsCount,
          cartSubtotal: subtotal,
          itemsQuantity,
          now: new Date(),
          existingCouponCode: null,
        });

        if (!validation.ok) return { ok: false as const, reason: validation.reason };

        discountAmount = validation.discountAmount;
        freeShipping = validation.freeShipping;
        appliedCouponId = coupon.id;
      }

      const effectiveShippingFee = freeShipping ? 0 : shippingFee;
      const total = Math.max(0, subtotal + effectiveShippingFee - discountAmount);

      const orderNumber = await generateUniqueOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          subtotal,
          shippingFee: effectiveShippingFee,
          discountAmount,
          total,
          couponId: appliedCouponId,
          items: items as unknown as any, // kept for legacy readers; OrderItem rows are canonical
        },
      });

      // Create normalized OrderItem rows.
      await tx.orderItem.createMany({
        data: resolved.map((r) => ({
          orderId: order.id,
          productId: r.productId,
          variantId: r.variantId,
          nameSnapshot: r.item.name,
          unitPrice: r.item.unitPrice,
          qty: r.item.qty,
          engravingText: r.item.engravingText ?? null,
          color: r.item.color ?? null,
          pendantShape: r.item.pendantShape ?? null,
          material: r.item.material ?? null,
          customerImageUrl: r.item.customerImageUrl ?? null,
        })),
      });

      // Transactional stock deduction + InventoryLog.
      for (const [variantId, qty] of variantDemand.entries()) {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { stock: { decrement: qty } },
        });
        await tx.inventoryLog.create({
          data: {
            variantId,
            delta: -qty,
            reason: "ORDER_PLACED",
            orderId: order.id,
          },
        });
      }

      return { ok: true as const, order };
    }, { timeout: 20000, maxWait: 10000 });

    if (!result.ok) {
      const reason = result.reason;
      const status = reason === "OUT_OF_STOCK" ? 409 : 400;
      const message = reason === "OUT_OF_STOCK" ? "אחד המוצרים אזל מהמלאי" : reasonToHebrew(reason as any);
      return res.status(status).json({ ok: false, reason, message });
    }

    return res.status(201).json({ ok: true, order: result.order });
  } catch (e: any) {
    // CHECK constraint stock >= 0 surfaces as transaction failure → never oversells.
    if (String(e?.message || "").includes("variant_stock_nonneg")) {
      return res.status(409).json({ ok: false, reason: "OUT_OF_STOCK" });
    }
    console.error("[POST /api/orders] FAILED name=", e?.name);
    console.error("[POST /api/orders] FAILED code=", e?.code);
    console.error("[POST /api/orders] FAILED meta=", JSON.stringify(e?.meta ?? null));
    console.error("[POST /api/orders] FAILED message=", String(e?.message ?? e));
    console.error("[POST /api/orders] FAILED stack=", e?.stack);
    return res.status(500).json({ error: "SERVER_ERROR", hint: String(e?.message ?? "").slice(0, 500) });
  }
});

// --- Order status transitions ---
const AllowedTransitions: Record<string, string[]> = {
  NEW:        ["PAID", "CANCELLED"],
  PAID:       ["FULFILLED", "CANCELLED", "REFUNDED"],
  FULFILLED:  ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED:    ["COMPLETED", "REFUNDED"],
  COMPLETED:  ["REFUNDED"],
  CANCELLED:  [],
  REFUNDED:   [],
};

const StatusUpdateSchema = z.object({
  status: z.enum(["NEW", "PAID", "FULFILLED", "SHIPPED", "COMPLETED", "CANCELLED", "REFUNDED"]),
  note: z.string().max(400).optional().nullable(),
});

ordersRouter.patch("/:id/status", requireAdmin, async (req, res) => {
  const parsed = StatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  const { status: nextStatus, note } = parsed.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: req.params.id }, include: { orderItems: true } });
      if (!order) return { ok: false as const, code: 404, reason: "NOT_FOUND" as const };

      if (order.status === nextStatus) return { ok: true as const, order };

      const allowed = AllowedTransitions[order.status] ?? [];
      if (!allowed.includes(nextStatus)) {
        return { ok: false as const, code: 400, reason: "INVALID_TRANSITION" as const };
      }

      const restoresStock = nextStatus === "CANCELLED" || nextStatus === "REFUNDED";
      if (restoresStock) {
        for (const it of order.orderItems) {
          if (!it.variantId) continue;
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stock: { increment: it.qty } },
          });
          await tx.inventoryLog.create({
            data: {
              variantId: it.variantId,
              delta: it.qty,
              reason: nextStatus === "CANCELLED" ? "ORDER_CANCELLED" : "ORDER_REFUNDED",
              orderId: order.id,
              note: note ?? null,
            },
          });
        }
      }

      const next = await tx.order.update({
        where: { id: order.id },
        data: { status: nextStatus as any },
      });
      return { ok: true as const, order: next };
    });

    if (!updated.ok) return res.status(updated.code).json({ error: updated.reason });
    return res.json({ ok: true, order: updated.order });
  } catch {
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

