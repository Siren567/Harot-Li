import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { reasonToHebrew, validateCoupon } from "../logic/coupons/validateCoupon.js";
import { getAnalyticsForRange } from "../services/analytics.service.js";
import { getSupabaseAdminClient } from "../supabase/client.js";
import { requireAdmin } from "../lib/auth.js";
import { isDatabaseConnectionError, respondDatabaseUnavailable } from "../lib/dbErrors.js";
import { createPaymentLink } from "../services/payplus.service.js";

export const ordersRouter = Router();

/** Dashboard reads only these columns so DBs without newer optional columns (e.g. `deliveryDetails`) still work. */
const dashboardOrderSelect = {
  id: true,
  orderNumber: true,
  customerId: true,
  total: true,
  status: true,
  createdAt: true,
  items: true,
  customer: { select: { fullName: true, email: true } },
  orderItems: { select: { nameSnapshot: true, qty: true } },
} as const;

const OrderItemSchema = z.object({
  productId: z.string().min(1).max(120),
  variantId: z.string().min(1).max(120),
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
    floor: z.string().max(40).optional().nullable(),
    apartment: z.string().max(40).optional().nullable(),
    zipCode: z.string().max(24).optional().nullable(),
    notes: z.string().max(4000).optional().nullable(),
  }),
  items: z.array(OrderItemSchema).min(1),
  shippingFee: z.number().int().min(0),
  couponCode: z.string().optional().nullable(),
  shippingMethodId: z.string().max(64).optional().nullable(),
  orderNotes: z.string().max(4000).optional().nullable(),
  paymentMethod: z.enum(["cash", "payplus"]).optional().default("cash"),
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
  } catch (e) {
    if (isDatabaseConnectionError(e)) return respondDatabaseUnavailable(res, e);
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

    const [allOrders, recentOrders, allCustomers, newCustomersLast30, newCustomersPrev30, analyticsLast30, analyticsPrev30, lowStockVariants] = await Promise.all([
      prisma.order.findMany({ select: dashboardOrderSelect, orderBy: { createdAt: "desc" } }),
      prisma.order.findMany({
        where: { createdAt: { gte: monthAgo } },
        select: dashboardOrderSelect,
        orderBy: { createdAt: "desc" },
      }),
      prisma.customer.findMany(),
      prisma.customer.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.customer.count({ where: { createdAt: { gte: prevMonthStart, lt: monthAgo } } }),
      getAnalyticsForRange(30).catch((err) => {
        console.warn("[GET /api/orders/dashboard] analytics(30) fallback:", err?.message ?? err);
        return Array.from({ length: 30 }, (_, idx) => {
          const d = new Date();
          d.setDate(d.getDate() - (29 - idx));
          return { date: d.toISOString().slice(0, 10), visits: 0, sessionSeconds: 0, sessionCount: 0 };
        });
      }),
      getAnalyticsForRange(60).catch((err) => {
        console.warn("[GET /api/orders/dashboard] analytics(60) fallback:", err?.message ?? err);
        return Array.from({ length: 60 }, (_, idx) => {
          const d = new Date();
          d.setDate(d.getDate() - (59 - idx));
          return { date: d.toISOString().slice(0, 10), visits: 0, sessionSeconds: 0, sessionCount: 0 };
        });
      }),
      prisma.productVariant.findMany({
        where: { isActive: true },
        select: {
          id: true,
          sku: true,
          color: true,
          stock: true,
          lowThreshold: true,
          product: { select: { title: true, isActive: true } },
        },
        orderBy: { stock: "asc" },
      }),
    ]);

    const totalRevenue = allOrders.reduce((sum: number, o: any) => sum + o.total, 0);
    const totalOrders = allOrders.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const pendingOrders = allOrders.filter((o: any) => ["NEW", "PAID", "FULFILLED", "SHIPPED"].includes(String(o.status))).length;
    const completedOrders = allOrders.filter((o: any) => o.status === "COMPLETED").length;
    const cancelledOrders = allOrders.filter((o: any) => o.status === "CANCELLED").length;
    const paidOrders = allOrders.filter((o: any) => o.status === "PAID" || o.status === "COMPLETED").length;

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
    const paidPrev30 = prevOrders.filter((o: any) => o.status === "PAID" || o.status === "COMPLETED").length;
    const paidRatePrev30 = siteVisitsPrev30 > 0 ? Number(((paidPrev30 / siteVisitsPrev30) * 100).toFixed(1)) : 0;
    const conversionRateTrendPercent =
      paidRatePrev30 > 0
        ? Math.round(((paidRatePercent - paidRatePrev30) / paidRatePrev30) * 100)
        : paidRatePercent > 0
          ? 100
          : 0;
    const siteVisitsTrendPercent =
      siteVisitsPrev30 > 0
        ? Math.round(((siteVisitsLast30 - siteVisitsPrev30) / siteVisitsPrev30) * 100)
        : siteVisitsLast30 > 0
          ? 100
          : 0;
    const totalSessionSecondsLast30 = analyticsLast30.reduce((sum, d) => sum + d.sessionSeconds, 0);
    const totalSessionCountLast30 = analyticsLast30.reduce((sum, d) => sum + d.sessionCount, 0);
    const avgSessionSeconds = totalSessionCountLast30 > 0 ? Math.round(totalSessionSecondsLast30 / totalSessionCountLast30) : 0;
    const analyticsPrevWindow = analyticsPrev30.slice(0, 30);
    const totalSessionSecondsPrev30 = analyticsPrevWindow.reduce((sum, d) => sum + d.sessionSeconds, 0);
    const totalSessionCountPrev30 = analyticsPrevWindow.reduce((sum, d) => sum + d.sessionCount, 0);
    const avgSessionPrev30 = totalSessionCountPrev30 > 0 ? Math.round(totalSessionSecondsPrev30 / totalSessionCountPrev30) : 0;
    const avgSessionTrendPercent =
      avgSessionPrev30 > 0
        ? Math.round(((avgSessionSeconds - avgSessionPrev30) / avgSessionPrev30) * 100)
        : avgSessionSeconds > 0
          ? 100
          : 0;
    const returningPrevTotalCustomers = await prisma.customer.count({ where: { createdAt: { lt: monthAgo } } });
    const prevOrdersForReturning = allOrders.filter((o: any) => o.createdAt < monthAgo);
    const returningPrev = new Set(
      Object.entries(
        prevOrdersForReturning.reduce<Record<string, number>>((acc: Record<string, number>, o: any) => {
          acc[o.customerId] = (acc[o.customerId] ?? 0) + 1;
          return acc;
        }, {})
      )
        .filter(([, count]: [string, any]) => Number(count) > 1)
        .map(([customerId]) => customerId)
    ).size;
    const returningPrevRatePercent =
      returningPrevTotalCustomers > 0 ? Number(((returningPrev / returningPrevTotalCustomers) * 100).toFixed(1)) : 0;
    const returningCustomersTrendPercent =
      returningPrevRatePercent > 0
        ? Math.round(((returningCustomersRatePercent - returningPrevRatePercent) / returningPrevRatePercent) * 100)
        : returningCustomersRatePercent > 0
          ? 100
          : 0;

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
    const stockAlertsAll = lowStockVariants
      .filter((v) => v.product?.isActive)
      .map((v) => {
        const threshold = Number(v.lowThreshold) || 5;
        const qty = Number(v.stock) || 0;
        return {
          id: v.id,
          name: v.product?.title || "מוצר",
          sku: v.sku || (v.color ? String(v.color) : "—"),
          qty,
          kind: qty <= 0 ? ("out" as const) : qty <= threshold ? ("low" as const) : null,
        };
      })
      .filter((x) => x.kind !== null) as Array<{ id: string; name: string; sku: string; qty: number; kind: "out" | "low" }>;
    const stockAlerts = stockAlertsAll.slice(0, 16);

    res.json({
      stats: {
        totalRevenue,
        totalOrders,
        newCustomers: newCustomersLast30,
        avgOrderValue,
        siteVisits: siteVisitsLast30,
        siteVisitsTrendPercent,
        conversionRatePercent: paidRatePercent,
        conversionRateTrendPercent,
        returningCustomersRatePercent,
        returningCustomersTrendPercent,
        avgSessionSeconds,
        avgSessionTrendPercent,
        pendingOrders,
        completedOrders,
        lowStockProducts: stockAlertsAll.length,
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
      stockAlerts,
    });
  } catch (err: any) {
    console.error("[GET /api/orders/dashboard] FAILED name=", err?.name);
    console.error("[GET /api/orders/dashboard] FAILED code=", err?.code);
    console.error("[GET /api/orders/dashboard] FAILED meta=", JSON.stringify(err?.meta ?? null));
    console.error("[GET /api/orders/dashboard] FAILED message=", String(err?.message ?? err));
    console.error("[GET /api/orders/dashboard] FAILED stack=", err?.stack);
    if (isDatabaseConnectionError(err)) return respondDatabaseUnavailable(res, err);
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

// Resolve and validate the exact purchased variant. No fallback-to-first behavior.
async function resolveVariant(
  tx: any,
  item: z.infer<typeof OrderItemSchema>
): Promise<
  | { ok: true; variantId: string; productId: string }
  | { ok: false; reason: "VARIANT_NOT_FOUND" | "VARIANT_NOT_ACTIVE" | "VARIANT_PRODUCT_MISMATCH" }
> {
  const productId = item.productId.trim();
  const variantId = item.variantId.trim();
  const v = await tx.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, productId: true, isActive: true },
  });
  if (!v) return { ok: false, reason: "VARIANT_NOT_FOUND" };
  if (!v.isActive) return { ok: false, reason: "VARIANT_NOT_ACTIVE" };
  if (v.productId !== productId) return { ok: false, reason: "VARIANT_PRODUCT_MISMATCH" };
  return { ok: true, variantId: v.id, productId: v.productId };
}

ordersRouter.post("/", async (req, res) => {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "VALIDATION", details: parsed.error.flatten() });
  }

  const { customer: inputCustomer, items, shippingFee, couponCode, shippingMethodId, orderNotes, paymentMethod } = parsed.data;
  console.log(`[POST /api/orders] creating order paymentMethod=${paymentMethod} items=${items.length}`);
  const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const itemsQuantity = items.reduce((sum, it) => sum + it.qty, 0);

  const code = couponCode?.trim() ? normalizeCode(couponCode) : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Resolve variants + validate stock BEFORE any writes.
      const resolved: Array<{ item: z.infer<typeof OrderItemSchema>; variantId: string; productId: string }> = [];
      for (const item of items) {
        const r = await resolveVariant(tx, item);
        if (!r.ok) return { ok: false as const, reason: r.reason };
        resolved.push({ item, variantId: r.variantId, productId: r.productId });
      }

      // Aggregate qty per variant (same variant might appear on multiple lines).
      const variantDemand = new Map<string, number>();
      for (const r of resolved) {
        variantDemand.set(r.variantId, (variantDemand.get(r.variantId) ?? 0) + r.item.qty);
      }

      // Lock the variant rows so concurrent orders can't oversell.
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
      if (locked.length !== variantIds.length) return { ok: false as const, reason: "VARIANT_NOT_FOUND" as const };

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

      const deliveryDetails = {
        shippingMethodId: shippingMethodId?.trim() || null,
        orderNotes: orderNotes?.trim() || null,
        address: {
          city: inputCustomer.city?.trim() || null,
          street: inputCustomer.address?.trim() || null,
          floor: inputCustomer.floor?.trim() || null,
          apartment: inputCustomer.apartment?.trim() || null,
          zipCode: inputCustomer.zipCode?.trim() || null,
          checkoutNotes: inputCustomer.notes?.trim() || null,
        },
      };

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
          deliveryDetails: deliveryDetails as object,
          // Payment flow (PayPlus prep): cash stays pending until handled manually,
          // payplus stays pending until the webhook flips it to paid/failed.
          paymentMethod,
          paymentStatus: "pending",
        } as any,
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
      const message =
        reason === "OUT_OF_STOCK"
          ? "אחד המוצרים אזל מהמלאי"
          : reason === "VARIANT_NOT_FOUND" || reason === "VARIANT_NOT_ACTIVE" || reason === "VARIANT_PRODUCT_MISMATCH"
            ? "פריט הזמנה לא תקין - נא לבחור וריאציה זמינה מחדש"
            : reasonToHebrew(reason as any);
      return res.status(status).json({ ok: false, reason, message });
    }

    // Cash orders complete immediately — paymentStatus stays "pending" (cash-on-delivery)
    // and the admin marks it paid manually through the order status flow.
    if (paymentMethod === "cash") {
      return res.status(201).json({
        ok: true,
        paymentMethod: "cash",
        order: { ...result.order, paymentMethod: "cash", paymentStatus: "pending" },
      });
    }

    // PayPlus: create the hosted payment page and save paymentUrl/paymentId on
    // the order. We do NOT mark the order as paid here — the webhook does.
    try {
      const createdOrder = result.order as any;
      const fullOrder = await prisma.order.findUnique({
        where: { id: createdOrder.id },
        include: { customer: true },
      });
      if (!fullOrder) throw new Error("ORDER_DISAPPEARED_AFTER_CREATE");

      const link = await createPaymentLink({
        order: { id: fullOrder.id, orderNumber: fullOrder.orderNumber, totalAgorot: fullOrder.total },
        customer: {
          fullName: fullOrder.customer?.fullName ?? null,
          email: fullOrder.customer?.email ?? null,
          phone: fullOrder.customer?.phone ?? null,
        },
        items: items.map((it) => ({ name: it.name, unitPriceAgorot: it.unitPrice, qty: it.qty })),
      });

      await prisma.order.update({
        where: { id: fullOrder.id },
        data: { paymentId: link.paymentRequestUid, paymentUrl: link.paymentUrl } as any,
      });

      console.log(`[POST /api/orders] payplus link created order=${fullOrder.orderNumber}`);

      return res.status(201).json({
        ok: true,
        paymentMethod: "payplus",
        orderId: fullOrder.id,
        paymentStatus: "pending",
        paymentUrl: link.paymentUrl,
        order: {
          ...createdOrder,
          paymentMethod: "payplus",
          paymentStatus: "pending",
          paymentUrl: link.paymentUrl,
          paymentId: link.paymentRequestUid,
        },
      });
    } catch (linkErr: any) {
      console.error("[POST /api/orders] payplus link creation FAILED", {
        code: linkErr?.code,
        status: linkErr?.status,
        message: String(linkErr?.message ?? linkErr).slice(0, 500),
      });
      // Mark the order's paymentStatus=failed so the admin sees it didn't start,
      // but keep the order row so the customer can retry / support can recover.
      try {
        await prisma.order.update({
          where: { id: (result.order as any).id },
          data: { paymentStatus: "failed" } as any,
        });
      } catch {
        // best-effort; do not mask the original error
      }
      const code = String(linkErr?.code || "");
      const userMessage =
        code === "PAYPLUS_NOT_CONFIGURED"
          ? "שירות התשלומים אינו מוגדר כעת. אנא נסו שוב מאוחר יותר."
          : "לא ניתן היה לאתחל את התשלום. נא לנסות שוב.";
      return res.status(502).json({
        ok: false,
        reason: "PAYMENT_INIT_FAILED",
        code: code || "PAYMENT_INIT_FAILED",
        message: userMessage,
        order: { id: (result.order as any).id, orderNumber: (result.order as any).orderNumber },
      });
    }
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

/**
 * Public, read-only payment status lookup used by the PayPlus return pages.
 * Exposes only non-sensitive fields so it is safe without auth — the caller
 * already knows the orderId (PayPlus redirected them there).
 */
ordersRouter.get("/:id/payment-status", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: "NOT_FOUND" });
    const o = order as any;
    return res.json({
      ok: true,
      orderNumber: order.orderNumber,
      paymentMethod: o.paymentMethod ?? "cash",
      paymentStatus: o.paymentStatus ?? "pending",
      total: order.total,
    });
  } catch (e) {
    if (isDatabaseConnectionError(e)) return respondDatabaseUnavailable(res, e);
    return res.status(500).json({ error: "SERVER_ERROR" });
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

const OrderNoteUpdateSchema = z.object({
  note: z.string().max(4000).optional().nullable(),
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

ordersRouter.patch("/:id/note", requireAdmin, async (req, res) => {
  const parsed = OrderNoteUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  const nextNote = String(parsed.data.note ?? "").trim();
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: "NOT_FOUND" });
    const rawDetails: any = (order as any).deliveryDetails;
    const detailsObj =
      rawDetails && typeof rawDetails === "object"
        ? { ...rawDetails }
        : rawDetails && typeof rawDetails === "string"
          ? (() => {
              try {
                const parsedRaw = JSON.parse(rawDetails);
                return parsedRaw && typeof parsedRaw === "object" ? { ...parsedRaw } : {};
              } catch {
                return {};
              }
            })()
          : {};
    const updatedDetails = {
      ...detailsObj,
      orderNotes: nextNote || null,
    };
    await prisma.order.update({
      where: { id: req.params.id },
      data: { deliveryDetails: updatedDetails as any },
    });
    return res.json({ ok: true, note: nextNote });
  } catch (e) {
    if (isDatabaseConnectionError(e)) return respondDatabaseUnavailable(res, e);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

