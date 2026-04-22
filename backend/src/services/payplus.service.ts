// PayPlus integration (REST v1.0).
//
// Real server-side client for https://restapi.payplus.co.il. Creates hosted
// payment pages and normalizes webhook callbacks.
//
// Environment:
//   PAYPLUS_API_KEY            - merchant api-key header
//   PAYPLUS_SECRET_KEY         - merchant secret-key header (never leaves the server)
//   PAYPLUS_PAYMENT_PAGE_UID   - configured PayPlus payment page UID
//   PAYPLUS_API_BASE           - e.g. https://restapi.payplus.co.il/api/v1.0
//                                 or https://restapidev.payplus.co.il/api/v1.0 for staging
//   PAYPLUS_WEBHOOK_SECRET     - HMAC shared secret (optional until PayPlus doc is finalized)
//   PAYPLUS_VERIFY_WEBHOOK     - "1" to enforce signature verification, anything else = dev bypass
//   PUBLIC_SITE_URL            - public origin used to build return/callback URLs

import crypto from "crypto";
import { env } from "../env.js";

type PayPlusConfig = {
  apiKey: string;
  secretKey: string;
  paymentPageUid: string;
  apiBase: string;
  publicSiteUrl: string;
  webhookSecret: string | null;
  verifyWebhook: boolean;
};

let cachedConfig: PayPlusConfig | null = null;

/**
 * Lazily resolve PayPlus config. We do NOT throw at module load so unrelated
 * boot paths (dev without PayPlus creds, pure cash flow) still work — we only
 * throw when a PayPlus-specific code path actually runs.
 */
export function getPayPlusConfig(): PayPlusConfig {
  if (cachedConfig) return cachedConfig;
  const apiKey = env.PAYPLUS_API_KEY;
  const secretKey = env.PAYPLUS_SECRET_KEY;
  const paymentPageUid = env.PAYPLUS_PAYMENT_PAGE_UID;
  const apiBase = env.PAYPLUS_API_BASE || "https://restapi.payplus.co.il/api/v1.0";
  const publicSiteUrl = env.PUBLIC_SITE_URL || env.PUBLIC_APP_BASE_URL;
  const missing: string[] = [];
  if (!apiKey) missing.push("PAYPLUS_API_KEY");
  if (!secretKey) missing.push("PAYPLUS_SECRET_KEY");
  if (!paymentPageUid) missing.push("PAYPLUS_PAYMENT_PAGE_UID");
  if (!publicSiteUrl) missing.push("PUBLIC_SITE_URL");
  if (missing.length) {
    const err = new Error(`PAYPLUS_NOT_CONFIGURED:${missing.join(",")}`);
    (err as any).code = "PAYPLUS_NOT_CONFIGURED";
    (err as any).missing = missing;
    throw err;
  }
  cachedConfig = {
    apiKey: apiKey!,
    secretKey: secretKey!,
    paymentPageUid: paymentPageUid!,
    apiBase: apiBase!.replace(/\/+$/, ""),
    publicSiteUrl: publicSiteUrl!.replace(/\/+$/, ""),
    webhookSecret: env.PAYPLUS_WEBHOOK_SECRET || null,
    verifyWebhook: env.PAYPLUS_VERIFY_WEBHOOK === "1",
  };
  return cachedConfig;
}

export type PayPlusOrderRef = {
  id: string;
  orderNumber: string;
  /** Total in agorot (integer). Converted to shekels for the PayPlus payload. */
  totalAgorot: number;
};

export type PayPlusCustomerRef = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type PayPlusLineItem = {
  name: string;
  /** Unit price in agorot (integer). */
  unitPriceAgorot: number;
  qty: number;
};

export type CreatePaymentLinkResult = {
  success: boolean;
  paymentUrl: string | null;
  paymentRequestUid: string | null;
  raw: unknown;
};

function agorotToShekelsNumber(agorot: number): number {
  return Math.round(agorot) / 100;
}

function sanitizeForLog<T>(value: T): T {
  try {
    const clone = JSON.parse(JSON.stringify(value));
    if (clone && typeof clone === "object") {
      for (const k of Object.keys(clone)) {
        if (/secret|api[-_]?key|card|cvv/i.test(k)) (clone as any)[k] = "[REDACTED]";
      }
    }
    return clone as T;
  } catch {
    return value;
  }
}

/**
 * Create a hosted PayPlus payment page for the given order.
 */
export async function createPaymentLink(params: {
  order: PayPlusOrderRef;
  customer: PayPlusCustomerRef;
  items: PayPlusLineItem[];
}): Promise<CreatePaymentLinkResult> {
  const cfg = getPayPlusConfig();
  const { order, customer, items } = params;
  if (!Number.isFinite(order.totalAgorot) || order.totalAgorot <= 0) {
    const e = new Error("PAYPLUS_NON_POSITIVE_TOTAL");
    (e as any).code = "PAYPLUS_NON_POSITIVE_TOTAL";
    throw e;
  }

  const customerName =
    (customer.fullName && customer.fullName.trim()) ||
    `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() ||
    "לקוח";

  const body = {
    payment_page_uid: cfg.paymentPageUid,
    charge_method: 1,
    amount: agorotToShekelsNumber(order.totalAgorot),
    currency_code: "ILS",
    language_code: "he",
    sendEmailApproval: true,
    sendEmailFailure: false,
    refURL_success: `${cfg.publicSiteUrl}/checkout/payplus/success?orderId=${encodeURIComponent(order.id)}`,
    refURL_failure: `${cfg.publicSiteUrl}/checkout/payplus/failure?orderId=${encodeURIComponent(order.id)}`,
    refURL_cancel: `${cfg.publicSiteUrl}/checkout/payplus/cancel?orderId=${encodeURIComponent(order.id)}`,
    refURL_callback: `${cfg.publicSiteUrl}/api/payplus/webhook`,
    send_failure_callback: true,
    more_info: order.id,
    customer: {
      customer_name: customerName,
      email: customer.email ?? "",
      phone: customer.phone ?? "",
    },
    items: items.map((it) => ({
      name: it.name.slice(0, 150),
      quantity: Math.max(1, Math.floor(it.qty)),
      price: agorotToShekelsNumber(it.unitPriceAgorot),
    })),
  };

  const url = `${cfg.apiBase}/PaymentPages/generateLink`;
  console.log("[payplus.createPaymentLink] request", {
    url,
    orderNumber: order.orderNumber,
    amount: body.amount,
    items: body.items.length,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": cfg.apiKey,
        "secret-key": cfg.secretKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    const e = new Error(`PAYPLUS_REQUEST_FAILED:${err?.message ?? err}`);
    (e as any).code = "PAYPLUS_REQUEST_FAILED";
    throw e;
  }
  clearTimeout(timeout);

  let rawJson: any;
  const text = await response.text();
  try {
    rawJson = text ? JSON.parse(text) : {};
  } catch {
    rawJson = { _nonJsonResponse: text.slice(0, 500) };
  }

  if (!response.ok) {
    console.error("[payplus.createPaymentLink] HTTP not ok", response.status, sanitizeForLog(rawJson));
    const e = new Error(`PAYPLUS_HTTP_${response.status}`);
    (e as any).code = "PAYPLUS_HTTP_ERROR";
    (e as any).status = response.status;
    (e as any).body = rawJson;
    throw e;
  }

  const data = rawJson?.data ?? rawJson ?? {};
  const status = String(rawJson?.results?.status ?? rawJson?.status ?? "").toLowerCase();
  const paymentUrl: string | null =
    data.payment_page_link || data.paymentPageLink || data.payment_url || data.redirect_url || null;
  const paymentRequestUid: string | null =
    data.page_request_uid || data.payment_request_uid || data.page_uid || null;

  if (!paymentUrl) {
    console.error("[payplus.createPaymentLink] malformed response", sanitizeForLog(rawJson));
    const e = new Error("PAYPLUS_MALFORMED_RESPONSE");
    (e as any).code = "PAYPLUS_MALFORMED_RESPONSE";
    (e as any).body = rawJson;
    throw e;
  }

  console.log("[payplus.createPaymentLink] ok", {
    orderNumber: order.orderNumber,
    paymentRequestUid,
    status,
  });

  return {
    success: status ? status === "success" : true,
    paymentUrl,
    paymentRequestUid,
    raw: sanitizeForLog(rawJson),
  };
}

// ---------------------------------------------------------------------------
// Webhook handling
// ---------------------------------------------------------------------------

export type PayPlusWebhookOutcome = "paid" | "failed" | "cancelled" | "unknown";

export type PayPlusWebhookEvent = {
  outcome: PayPlusWebhookOutcome;
  /** Our internal Order.id, taken from PayPlus `more_info`. */
  orderId: string;
  /** Provider-side identifier (transaction uid / page request uid). */
  paymentId: string | null;
  raw: unknown;
};

function pickFirstString(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

export function parseWebhookEvent(body: unknown): PayPlusWebhookEvent {
  const b = (body ?? {}) as Record<string, any>;
  const data = (b.data ?? b.transaction ?? b) as Record<string, any>;
  const transaction = (data.transaction ?? data) as Record<string, any>;

  const orderId = pickFirstString(
    data.more_info,
    b.more_info,
    transaction.more_info,
    data.metadata?.orderId,
    b.metadata?.orderId
  );

  const paymentId =
    pickFirstString(
      transaction.transaction_uid,
      data.transaction_uid,
      data.page_request_uid,
      b.page_request_uid,
      transaction.uid,
      data.uid
    ) || null;

  const statusCode = pickFirstString(
    transaction.status_code,
    data.status_code,
    b.status_code,
    transaction.status,
    data.status,
    b.status
  ).toLowerCase();

  let outcome: PayPlusWebhookOutcome = "unknown";
  // PayPlus success code is "000" for approved transactions; treat common textual
  // markers defensively too.
  if (statusCode === "000" || statusCode === "success" || statusCode === "approved" || statusCode === "paid") {
    outcome = "paid";
  } else if (statusCode === "cancel" || statusCode === "cancelled" || statusCode === "canceled") {
    outcome = "cancelled";
  } else if (statusCode === "failed" || statusCode === "declined" || statusCode === "error" || /^[1-9]/.test(statusCode)) {
    outcome = "failed";
  }

  return { outcome, orderId, paymentId, raw: sanitizeForLog(body) };
}

/**
 * Verify the PayPlus webhook signature.
 *
 * NOTE: the exact header name + canonical body format PayPlus uses for HMAC is
 * not fully documented in this repo yet. The helper is shaped so only the inner
 * comparison needs to change once confirmed. Until PAYPLUS_VERIFY_WEBHOOK=1 is
 * set, we do not reject requests on the basis of this check.
 */
export function verifyPayPlusWebhookSignature(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string | Buffer
): { verified: boolean; reason: string } {
  let cfg: PayPlusConfig;
  try {
    cfg = getPayPlusConfig();
  } catch {
    return { verified: false, reason: "NOT_CONFIGURED" };
  }
  if (!cfg.webhookSecret) return { verified: false, reason: "NO_WEBHOOK_SECRET" };

  // TODO(payplus): replace header name + canonicalization with the values PayPlus
  // publishes. Until then we compute a generic HMAC-SHA256 of the raw body so
  // the plumbing is wired end-to-end and switching to the real scheme is a
  // one-line change.
  const signatureHeader =
    (headers["x-payplus-signature"] as string | undefined) ??
    (headers["x-signature"] as string | undefined) ??
    "";
  if (!signatureHeader) return { verified: false, reason: "MISSING_SIGNATURE_HEADER" };

  const expected = crypto.createHmac("sha256", cfg.webhookSecret).update(rawBody).digest("hex");
  const got = signatureHeader.trim();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(got, "utf8");
  const verified = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { verified, reason: verified ? "OK" : "MISMATCH" };
}
