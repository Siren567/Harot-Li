/**
 * שליחת אירועי גלישה לפאנל (קמפיינים / מטא) — נטען מ־index / design.
 * API: POST /api/public/marketing-events
 */
const SESSION_KEY = "harotli_mkt_session_v1";

function apiBases() {
  if (typeof window === "undefined") return [""];
  const host = window.location.hostname || "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) return ["http://localhost:4444", ""];
  // In production use relative + common proxy prefixes only — avoid mixed-content dev URLs.
  return ["", "/_/backend", "/backend"];
}

function sessionId() {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`;
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return `s-${Date.now()}`;
  }
}

function utmFromLocation() {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get("utm_source") || null,
      utm_medium: p.get("utm_medium") || null,
      utm_campaign: p.get("utm_campaign") || null,
      utm_content: p.get("utm_content") || null,
      utm_term: p.get("utm_term") || null,
      fbclid: p.get("fbclid") ? p.get("fbclid").slice(0, 200) : null,
      gclid: p.get("gclid") ? p.get("gclid").slice(0, 200) : null,
    };
  } catch {
    return {};
  }
}

function trimStr(v, max) {
  if (v == null) return null;
  const s = String(v);
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * @param {Record<string, unknown>} ev
 */
function buildPayload(ev) {
  const utm = utmFromLocation();
  const path =
    typeof window !== "undefined"
      ? trimStr(`${window.location.pathname || ""}${window.location.search || ""}`, 2000)
      : null;
  return {
    event_type: trimStr(ev.event_type, 64) || "custom",
    page_path: path,
    referrer: trimStr(typeof document !== "undefined" ? document.referrer : null, 2000),
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    utm_content: utm.utm_content,
    utm_term: utm.utm_term,
    fbclid: utm.fbclid,
    gclid: utm.gclid,
    product_id: trimStr(ev.product_id, 128),
    product_name: trimStr(ev.product_name, 500),
    session_id: sessionId(),
    user_agent: trimStr(typeof navigator !== "undefined" ? navigator.userAgent : null, 500),
    language: trimStr(typeof navigator !== "undefined" ? navigator.language : null, 32),
    screen_w: typeof screen !== "undefined" ? screen.width : null,
    screen_h: typeof screen !== "undefined" ? screen.height : null,
    meta: ev.meta && typeof ev.meta === "object" ? ev.meta : null,
  };
}

function postEvents(events) {
  const body = JSON.stringify({ events });
  const opts = {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body,
    keepalive: true,
  };
  (async () => {
    for (const base of apiBases()) {
      try {
        const res = await fetch(`${base}/api/public/marketing-events`, opts);
        if (res.ok) return;
      } catch {
        /* next */
      }
    }
  })();
}

let pageViewSent = false;

/**
 * קריאה אחת לדף (דף נחיתה / סטודיו).
 * @param {{ context?: string }} [opts]
 */
export function initMarketingBeacon(opts = {}) {
  if (pageViewSent || typeof window === "undefined") return;
  pageViewSent = true;
  postEvents([buildPayload({ event_type: "page_view", meta: { context: opts.context || "site" } })]);
}

/**
 * צפייה במוצר (סטודיו וכו׳).
 */
export function trackProductView(productId, productName) {
  if (typeof window === "undefined") return;
  postEvents([
    buildPayload({
      event_type: "product_view",
      product_id: productId,
      product_name: productName,
    }),
  ]);
}
