import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { reasonToHebrew, validateCoupon } from "../logic/coupons/validateCoupon.js";
import { getAnalyticsForRange } from "../services/analytics.service.js";
import { getSupabaseAdminClient } from "../supabase/client.js";

export const ordersRouter = Router();

const OrderItemSchema = z.object({
  productId: z.string().min(1).max(120).optional().nullable(),
  name: z.string().min(1).max(200),
  qty: z.number().int().min(1).max(999),
  unitPrice: z.number().int().min(0),
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

ordersRouter.get("/", async (req, res) => {
  const limitRaw = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        customer: true,
      },
    });
    res.json({ orders });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

ordersRouter.get("/dashboard", async (_req, res) => {
  try {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const prevMonthStart = new Date(monthAgo);
    prevMonthStart.setDate(prevMonthStart.getDate() - 30);

    const [allOrders, recentOrders, allCustomers, newCustomersLast30, newCustomersPrev30, analyticsLast30, analyticsPrev30] = await Promise.all([
      prisma.order.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" } }),
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

    const totalItemsSold = allOrders.reduce((sum: number, o: any) => {
      const items = Array.isArray(o.items) ? (o.items as any[]) : [];
      return (
        sum +
        items.reduce((itemSum, it) => {
          const qty = Number(it?.qty ?? 0);
          return itemSum + (Number.isFinite(qty) ? qty : 0);
        }, 0)
      );
    }, 0);
    const avgItemsPerOrder = totalOrders > 0 ? Number((totalItemsSold / totalOrders).toFixed(2)) : 0;

    const topProductsMap = new Map<string, number>();
    for (const o of allOrders as any[]) {
      const items = Array.isArray(o.items) ? (o.items as any[]) : [];
      for (const it of items) {
        const name = String(it?.name ?? "").trim();
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

async function generateUniqueOrderNumber() {
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
    const existing = await prisma.order.findUnique({ where: { orderNumber } });
    if (!existing) return orderNumber;
  }
  // fallback
  return `HG-${Date.now()}`;
}

ordersRouter.post("/", async (req, res) => {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  const { customer: inputCustomer, items, shippingFee, couponCode } = parsed.data;
  const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const itemsQuantity = items.reduce((sum, it) => sum + it.qty, 0);

  const code = couponCode?.trim() ? normalizeCode(couponCode) : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email: inputCustomer.email },
        update: {
          fullName: inputCustomer.fullName ?? undefined,
          phone: inputCustomer.phone ?? undefined,
        },
        create: {
          email: inputCustomer.email,
          fullName: inputCustomer.fullName ?? null,
          phone: inputCustomer.phone ?? null,
        },
      });

      let discountAmount = 0;
      let freeShipping = false;
      let appliedCouponId: string | null = null;

      if (code) {
        const coupon = await tx.coupon.findUnique({ where: { code } });
        if (!coupon) {
          return { ok: false as const, reason: "NOT_FOUND" as const };
        }

        const customerOrdersCount = await tx.order.count({ where: { customerId: customer.id } });
        const customerRedemptionsCount = await tx.couponRedemption.count({ where: { couponId: coupon.id, customerId: customer.id } });

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

        if (!validation.ok) {
          return { ok: false as const, reason: validation.reason };
        }

        discountAmount = validation.discountAmount;
        freeShipping = validation.freeShipping;
        appliedCouponId = coupon.id;
      }

      const effectiveShippingFee = freeShipping ? 0 : shippingFee;
      const total = Math.max(0, subtotal + effectiveShippingFee - discountAmount);

      const orderNumber = await generateUniqueOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          subtotal,
          shippingFee: effectiveShippingFee,
          discountAmount,
          total,
          couponId: appliedCouponId,
          items: items as unknown as any,
        },
      });

      // Coupon redemption is recorded only after successful payment callback.

      return { ok: true as const, order };
    });

    if (!result.ok) {
      const reason = result.reason;
      return res.status(400).json({ ok: false, reason, message: reasonToHebrew(reason) });
    }

    const productQtyMap = new Map<string, number>();
    for (const item of items) {
      const productId = String(item.productId || "").trim();
      if (!productId) continue;
      productQtyMap.set(productId, (productQtyMap.get(productId) ?? 0) + item.qty);
    }
    if (productQtyMap.size > 0) {
      try {
        const sb = getSupabaseAdminClient();
        for (const [productId, qty] of productQtyMap.entries()) {
          const key = productExtraKey(productId);
          const { data: row } = await sb.from("site_settings").select("value").eq("key", key).maybeSingle();
          const value = row?.value && typeof row.value === "object" && !Array.isArray(row.value) ? { ...row.value } : {};
          const stockRaw = Number((value as any).stock ?? 0);
          const nextStock = Math.max(0, (Number.isFinite(stockRaw) ? Math.round(stockRaw) : 0) - qty);
          (value as any).stock = nextStock;
          if (!Number.isFinite(Number((value as any).low_threshold))) (value as any).low_threshold = 5;
          await sb.from("site_settings").upsert({ key, value }, { onConflict: "key" });
        }
      } catch {
        // Keep order creation successful even if stock sync failed.
      }
    }

    return res.status(201).json({ ok: true, order: result.order });
  } catch (e: any) {
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

