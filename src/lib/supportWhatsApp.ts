/** אותו מספר כמו כפתור הוואטסאפ הצף והסטודיו */
export const SUPPORT_WHATSAPP_PHONE_DIGITS = "972559433968";

const WA_TEXT_MAX = 1800;

export function formatCancelDealRequestMessage(parts: {
  orderNumber: string;
  fullName: string;
  phone: string;
  details: string;
}): string {
  return [
    "בקשה לביטול עסקה — חרוטלי",
    "",
    `מספר הזמנה: ${parts.orderNumber}`,
    `שם מלא: ${parts.fullName}`,
    `טלפון: ${parts.phone}`,
    "",
    "פירוט סיבת הביטול:",
    parts.details,
  ].join("\n");
}

function supportWhatsappUrlWithText(text: string): string {
  const trimmed =
    text.length > WA_TEXT_MAX ? `${text.slice(0, WA_TEXT_MAX)}\n\n…(הודעה קוצרה)` : text;
  return `https://wa.me/${SUPPORT_WHATSAPP_PHONE_DIGITS}?text=${encodeURIComponent(trimmed)}`;
}

/** בתגובה ללחיצת משתמש (submit) — פותח וואטסאפ עם טקסט מלא מראש */
export function openSupportWhatsAppWithText(text: string): void {
  const url = supportWhatsappUrlWithText(text);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
