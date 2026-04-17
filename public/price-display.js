/**
 * תצוגת מחיר ללקוח באתר: תמיד שתי ספרות אחרי הנקודה (he-IL).
 * מחיר בשקלים שלמים: אם הספרה האחרונה היא 0 או 4 → (N−1).90 (למשל 204 → 203.90);
 * אחרת → N.90 (למשל 189 → 189.90).
 * ערכים שאינם שלמים מוצגים כפי שהם (עם שתי ספרות).
 */
const SHEKEL = "\u20aa";

export function formatShekelDisplay(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return `${SHEKEL}0.00`;
  if (num < 0) return `${SHEKEL}0.00`;

  const agorot = Math.round(num * 100);
  if (agorot === 0) return `${SHEKEL}0.00`;

  if (agorot % 100 !== 0) {
    return `${SHEKEL}${(agorot / 100).toLocaleString("he-IL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const shekels = agorot / 100;
  const last = shekels % 10;
  const base = last === 0 || last === 4 ? shekels - 1 : shekels;
  const displayAgorot = base * 100 + 90;
  return `${SHEKEL}${(displayAgorot / 100).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
