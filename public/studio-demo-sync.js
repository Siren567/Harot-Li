/**
 * סנכרון דמו סטודיו ↔ פאנל ניהול (אותו מקור / דומיין — localStorage).
 * עדכן את המפתח רק יחד עם admin-panel/src/lib/studio-demo-storage.ts
 */
export const STUDIO_DEMO_ORDERS_KEY = "harotli_studio_demo_orders_v2";

export function studioCustomerId(phone, email) {
  const raw = `${String(phone || "").trim()}|${String(email || "").trim().toLowerCase()}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  return `studio-${Math.abs(h).toString(36)}`;
}

/**
 * @param {Record<string, unknown>} order — מבנה מלא כפי שנשמר ב־localStorage
 */
export function appendStudioDemoOrder(order) {
  try {
    const raw = localStorage.getItem(STUDIO_DEMO_ORDERS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) {
      localStorage.setItem(STUDIO_DEMO_ORDERS_KEY, JSON.stringify([order]));
      return;
    }
    arr.unshift(order);
    while (arr.length > 200) arr.pop();
    localStorage.setItem(STUDIO_DEMO_ORDERS_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn("[studio-demo-sync] appendStudioDemoOrder:", e);
  }
}
