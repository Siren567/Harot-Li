import { env } from "../env.js";

type CreateGrowPaymentLinkInput = {
  orderId: string;
  orderNumber: string;
  amountAgorot: number;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  notifyUrl: string;
  returnUrl?: string | null;
};

function shekelsFromAgorot(amountAgorot: number) {
  return Number((Math.max(0, amountAgorot) / 100).toFixed(2));
}

function pickFirstString(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function createGrowPaymentLink(input: CreateGrowPaymentLinkInput) {
  if (!env.GROW_MAKE_CREATE_PAYMENT_LINK_URL) {
    throw Object.assign(new Error("MISSING_GROW_CREATE_LINK_URL"), { code: "MISSING_GROW_CREATE_LINK_URL" });
  }

  const payload = {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    amount: shekelsFromAgorot(input.amountAgorot),
    currency: "ILS",
    customerName: input.customerName ?? "",
    customerPhone: input.customerPhone ?? "",
    customerEmail: input.customerEmail ?? "",
    notifyUrl: input.notifyUrl,
    returnUrl: input.returnUrl ?? "",
    sendMethod: "none",
    metadata: {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
    },
  };

  const res = await fetch(env.GROW_MAKE_CREATE_PAYMENT_LINK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    throw Object.assign(new Error("GROW_CREATE_LINK_FAILED"), { code: "GROW_CREATE_LINK_FAILED", response: parsed });
  }

  const paymentUrl =
    pickFirstString(parsed, ["paymentUrl", "payment_url", "url", "link", "checkoutUrl"]) ||
    pickFirstString(parsed?.data, ["paymentUrl", "payment_url", "url", "link", "checkoutUrl"]);

  if (!paymentUrl) {
    throw Object.assign(new Error("GROW_LINK_MISSING_IN_RESPONSE"), { code: "GROW_LINK_MISSING_IN_RESPONSE", response: parsed });
  }

  const providerReference =
    pickFirstString(parsed, ["transactionId", "transaction_id", "requestId", "paymentRequestId"]) ||
    pickFirstString(parsed?.data, ["transactionId", "transaction_id", "requestId", "paymentRequestId"]) ||
    input.orderNumber;

  return { paymentUrl, providerReference, rawResponse: parsed };
}

export function isGrowNotifyAuthorized(token: string | null) {
  if (!env.GROW_NOTIFY_TOKEN) return true;
  return Boolean(token && token === env.GROW_NOTIFY_TOKEN);
}

export async function approveGrowTransaction(payload: unknown) {
  if (!env.GROW_MAKE_APPROVE_TRANSACTION_URL) {
    return { skipped: true as const };
  }
  const res = await fetch(env.GROW_MAKE_APPROVE_TRANSACTION_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload ?? {}),
  });
  const text = await res.text();
  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    throw Object.assign(new Error("GROW_APPROVE_FAILED"), { code: "GROW_APPROVE_FAILED", response: parsed });
  }
  return { skipped: false as const, response: parsed };
}

export function extractGrowNotifyFields(payload: any) {
  const read = (keys: string[]) => pickFirstString(payload, keys) || pickFirstString(payload?.data, keys);
  const orderNumber =
    read(["orderNumber", "order_number", "invoice", "invoiceNumber", "reference", "merchantReference"]) || null;
  const providerTransactionId =
    read(["transactionId", "transaction_id", "dealId", "deal_id", "paymentId", "payment_id"]) || null;
  const rawStatus = read(["status", "transactionStatus", "dealStatus", "result", "paymentStatus"]) || "";
  const normalized = rawStatus.toLowerCase();
  const success =
    normalized.includes("success") ||
    normalized.includes("approved") ||
    normalized.includes("paid") ||
    normalized === "ok" ||
    normalized === "0";

  return { orderNumber, providerTransactionId, rawStatus, success };
}

