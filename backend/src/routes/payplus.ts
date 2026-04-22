import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import {
  createPaymentLink,
  parseWebhookEvent,
  verifyPayPlusWebhookSignature,
  getPayPlusConfig,
} from "../services/payplus.service.js";
import type { Request, Response, NextFunction } from "express";

export const payplusRouter = Router();

const CreatePaymentSchema = z.object({
  orderId: z.string().min(1),
});

function verifyWebhook(req: Request, res: Response, next: NextFunction) {
  const raw = (req as any).rawBody as string | undefined;
  const result = verifyPayPlusWebhookSignature(req.headers, raw ?? JSON.stringify(req.body ?? {}));
  (req as any).payplusSignatureVerified = result.verified;

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

payplusRouter.post("/create-payment", async (req, res) => {
  const parsed = CreatePaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "VALIDATION", details: parsed.error.flatten() });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      include: {
        customer: true,
        orderItems: true,
      },
    });
    if (!order) return res.status(404).json({ ok: false, error: "ORDER_NOT_FOUND" });

    const current = order as any;
    if ((current.paymentStatus ?? "pending") === "paid") {
      return res.status(409).json({ ok: false, error: "ORDER_ALREADY_PAID" });
    }

    if (current.paymentUrl) {
      return res.json({
        ok: true,
        checkoutUrl: current.paymentUrl,
        paymentId: current.paymentId ?? null,
      });
    }

    const items = Array.isArray(order.orderItems) && order.orderItems.length > 0
      ? order.orderItems.map((it) => ({
          name: it.nameSnapshot || "מוצר",
          unitPriceAgorot: it.unitPrice,
          qty: it.qty,
        }))
      : [
          {
            name: `Order ${order.orderNumber}`,
            unitPriceAgorot: order.total,
            qty: 1,
          },
        ];

    const link = await createPaymentLink({
      order: { id: order.id, orderNumber: order.orderNumber, totalAgorot: order.total },
      customer: {
        fullName: order.customer?.fullName ?? null,
        email: order.customer?.email ?? null,
        phone: order.customer?.phone ?? null,
      },
      items,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMethod: "payplus",
        paymentStatus: "pending",
        paymentId: link.paymentRequestUid,
        paymentUrl: link.paymentUrl,
      } as any,
    });

    return res.json({
      ok: true,
      checkoutUrl: link.paymentUrl,
      paymentId: link.paymentRequestUid,
    });
  } catch (err: any) {
    const code = String(err?.code || "");
    if (code === "PAYPLUS_NOT_CONFIGURED") {
      return res.status(503).json({
        ok: false,
        error: "PAYPLUS_NOT_CONFIGURED",
        message: "PayPlus credentials are missing in server environment.",
      });
    }
    if (code === "PAYPLUS_HTTP_ERROR") {
      return res.status(502).json({
        ok: false,
        error: "PAYPLUS_PROVIDER_ERROR",
        message: "Payment provider returned an error while creating checkout session.",
      });
    }
    if (code === "PAYPLUS_REQUEST_FAILED") {
      return res.status(504).json({
        ok: false,
        error: "PAYPLUS_UNREACHABLE",
        message: "Payment provider did not respond in time. Please try again.",
      });
    }
    return res.status(500).json({
      ok: false,
      error: "PAYPLUS_CREATE_PAYMENT_FAILED",
      message: "Unexpected error while creating payment session.",
    });
  }
});

payplusRouter.post("/webhook", verifyWebhook, async (req, res) => {
  const event = parseWebhookEvent(req.body);
  if (!event.orderId || event.outcome === "unknown") {
    return res.status(200).json({ ok: true, ignored: true });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: event.orderId } });
    if (!order) {
      return res.status(404).json({ ok: false, error: "ORDER_NOT_FOUND" });
    }

    const currentPaymentStatus = String((order as any).paymentStatus ?? "pending");
    if (currentPaymentStatus === "paid" && event.outcome === "paid") {
      return res.status(200).json({ ok: true, duplicate: true });
    }
    if (currentPaymentStatus === "paid" && event.outcome !== "paid") {
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (event.outcome === "paid") {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: "paid", paymentId: event.paymentId || null, status: "PAID", paymentMethod: "payplus" } as any,
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
    } else if (event.outcome === "failed" || event.outcome === "cancelled") {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: event.outcome, paymentId: event.paymentId || (order as any).paymentId || null, paymentMethod: "payplus" } as any,
      });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: "WEBHOOK_PROCESSING_FAILED" });
  }
});
