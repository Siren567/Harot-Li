import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../env.js";
import {
  approveGrowTransaction,
  createGrowPaymentLink,
  extractGrowNotifyFields,
  isGrowNotifyAuthorized,
} from "../services/growPayments.service.js";
import {
  parseWebhookEvent,
  verifyPayPlusWebhookSignature,
  getPayPlusConfig,
} from "../services/payplus.service.js";
import type { Request, Response, NextFunction } from "express";

export const paymentsRouter = Router();

const CreateGrowLinkSchema = z.object({
  orderId: z.string().min(1),
  returnUrl: z.string().url().optional().nullable(),
});

paymentsRouter.post("/grow/create-link", async (req, res) => {
  const parsed = CreateGrowLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      include: { customer: true },
    });
    if (!order) return res.status(404).json({ error: "ORDER_NOT_FOUND" });

    const baseUrl =
      env.PUBLIC_APP_BASE_URL ||
      `${req.protocol}://${req.get("host") || "localhost:4000"}`;
    const notifyUrl = `${baseUrl}/api/payments/grow/notify`;

    const link = await createGrowPaymentLink({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountAgorot: order.total,
      customerName: order.customer?.fullName ?? "",
      customerPhone: order.customer?.phone ?? "",
      customerEmail: order.customer?.email ?? "",
      notifyUrl,
      returnUrl: parsed.data.returnUrl ?? null,
    });

    return res.json({
      ok: true,
      paymentUrl: link.paymentUrl,
      providerReference: link.providerReference,
      order: { id: order.id, orderNumber: order.orderNumber, total: order.total },
    });
  } catch (error: any) {
    const code = String(error?.code || "");
    if (code === "MISSING_GROW_CREATE_LINK_URL") {
      return res.status(503).json({ error: "PAYMENT_NOT_CONFIGURED", message: "Missing GROW create-link URL configuration." });
    }
    return res.status(500).json({ error: "PAYMENT_LINK_CREATE_FAILED" });
  }
});

/**
 * Webhook verification middleware. The route is public (no admin auth) because
 * PayPlus calls it server-to-server. Signature verification runs against the
 * captured raw body; enforcement is gated by PAYPLUS_VERIFY_WEBHOOK=1 so dev
 * environments without a shared secret can still exercise the flow.
 */
function verifyPaymentWebhook(req: Request, res: Response, next: NextFunction) {
  const raw = (req as any).rawBody as string | undefined;
  const result = verifyPayPlusWebhookSignature(req.headers, raw ?? JSON.stringify(req.body ?? {}));
  (req as any).payplusSignatureVerified = result.verified;
  console.log(`[payplus.webhook] signature verified=${result.verified} reason=${result.reason}`);

  let enforce = false;
  try {
    enforce = getPayPlusConfig().verifyWebhook;
  } catch {
    enforce = false;
  }
  if (enforce && !result.verified) {
    return res.status(401).json({ ok: false, error: "INVALID_SIGNATURE" });
  }
  return next();
}

paymentsRouter.post("/payplus/webhook", verifyPaymentWebhook, async (req, res) => {
  const event = parseWebhookEvent(req.body);
  console.log(`[payplus.webhook] event outcome=${event.outcome} orderId=${event.orderId} paymentId=${event.paymentId ?? ""}`);

  if (!event.orderId || event.outcome === "unknown") {
    // Acknowledge 200 so PayPlus doesn't retry storms; unknowns are logged for
    // manual investigation.
    return res.status(200).json({ ok: true, ignored: true });
  }

  try {
    // orderId comes from provider `more_info` — we never trust the browser.
    const order = await prisma.order.findUnique({ where: { id: event.orderId } });
    if (!order) {
      console.warn(`[payplus.webhook] order not found id=${event.orderId}`);
      return res.status(404).json({ ok: false, error: "ORDER_NOT_FOUND" });
    }

    const currentPaymentStatus = String((order as any).paymentStatus ?? "pending");

    // Idempotency: if this order is already terminal, acknowledge without
    // re-processing. PayPlus may deliver the same callback multiple times.
    if (currentPaymentStatus === "paid" && event.outcome === "paid") {
      console.log(`[payplus.webhook] duplicate paid callback for ${order.orderNumber}, ignoring`);
      return res.status(200).json({ ok: true, duplicate: true });
    }
    if (currentPaymentStatus === "paid" && event.outcome !== "paid") {
      console.warn(`[payplus.webhook] ignoring ${event.outcome} callback for already-paid order ${order.orderNumber}`);
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (event.outcome === "paid") {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: "paid", paymentId: event.paymentId || null, status: "PAID" } as any,
        });
        if (order.couponId) {
          const existing = await tx.couponRedemption.findFirst({ where: { orderId: order.id } });
          if (!existing) {
            await tx.couponRedemption.create({
              data: {
                couponId: order.couponId,
                customerId: order.customerId,
                orderId: order.id,
                discountAmount: order.discountAmount,
              },
            });
            await tx.coupon.update({ where: { id: order.couponId }, data: { usageCount: { increment: 1 } } });
          }
        }
      });
      console.log(`[payplus.webhook] order ${order.orderNumber} -> paid`);
    } else if (event.outcome === "failed" || event.outcome === "cancelled") {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: event.outcome, paymentId: event.paymentId || (order as any).paymentId || null } as any,
      });
      console.log(`[payplus.webhook] order ${order.orderNumber} -> ${event.outcome}`);
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[payplus.webhook] FAILED", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "WEBHOOK_PROCESSING_FAILED" });
  }
});

paymentsRouter.post("/grow/notify", async (req, res) => {
  const tokenFromHeader = String(req.headers["x-grow-token"] || "");
  const tokenFromQuery = typeof req.query.token === "string" ? req.query.token : null;
  const token = tokenFromHeader || tokenFromQuery;
  if (!isGrowNotifyAuthorized(token || null)) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED_NOTIFY" });
  }

  const payload = req.body ?? {};
  const fields = extractGrowNotifyFields(payload);
  if (!fields.orderNumber) {
    return res.status(400).json({ ok: false, error: "MISSING_ORDER_NUMBER" });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: fields.orderNumber },
      include: { customer: true, coupon: true },
    });
    if (!order) {
      return res.status(404).json({ ok: false, error: "ORDER_NOT_FOUND" });
    }

    if (fields.success && order.status !== "PAID") {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "PAID" },
        });

        // Idempotent redemption recording after successful payment.
        if (order.couponId) {
          const existing = await tx.couponRedemption.findFirst({ where: { orderId: order.id } });
          if (!existing) {
            await tx.couponRedemption.create({
              data: {
                couponId: order.couponId,
                customerId: order.customerId,
                orderId: order.id,
                discountAmount: order.discountAmount,
              },
            });
            await tx.coupon.update({
              where: { id: order.couponId },
              data: { usageCount: { increment: 1 } },
            });
          }
        }
      });
    }

    // Best-effort acknowledge call so Grow won't retry callbacks repeatedly.
    try {
      await approveGrowTransaction(payload);
    } catch {
      // keep 200 to avoid duplicate notify storms; approval call can be retried manually.
    }

    return res.json({
      ok: true,
      orderNumber: order.orderNumber,
      providerTransactionId: fields.providerTransactionId,
      status: fields.success ? "paid" : "pending",
      rawStatus: fields.rawStatus,
    });
  } catch {
    return res.status(500).json({ ok: false, error: "NOTIFY_PROCESSING_FAILED" });
  }
});

