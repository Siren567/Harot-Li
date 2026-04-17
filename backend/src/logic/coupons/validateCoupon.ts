import type { Coupon, Customer, Prisma } from "@prisma/client";
import { CouponDiscountType } from "@prisma/client";

export type ValidateCouponInput = {
  coupon: Coupon;
  customer: Customer | null;
  customerOrdersCount: number;
  customerRedemptionsCount: number;
  cartSubtotal: number; // agorot
  itemsQuantity: number;
  now: Date;
  existingCouponCode?: string | null;
};

export type CouponInvalidReason =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "MIN_CART"
  | "MAX_CART"
  | "MIN_ITEMS"
  | "USAGE_LIMIT_REACHED"
  | "PER_CUSTOMER_LIMIT_REACHED"
  | "NEW_CUSTOMERS_ONLY"
  | "CANNOT_COMBINE"
  | "NOT_APPLICABLE";

export type ValidateCouponResult =
  | {
      ok: true;
      code: string;
      discountAmount: number; // agorot
      freeShipping: boolean;
    }
  | {
      ok: false;
      code?: string;
      reason: CouponInvalidReason;
    };

export function computeDiscountAmount(coupon: Coupon, cartSubtotal: number): number {
  if (cartSubtotal <= 0) return 0;
  if (coupon.discountType === CouponDiscountType.PERCENTAGE) {
    const pct = Math.max(0, Math.min(100, coupon.discountValue));
    return Math.floor((cartSubtotal * pct) / 100);
  }
  // FIXED_AMOUNT
  return Math.max(0, Math.min(cartSubtotal, coupon.discountValue));
}

export function validateCoupon(input: ValidateCouponInput): ValidateCouponResult {
  const { coupon, cartSubtotal, itemsQuantity, now } = input;

  if (!coupon.isActive) return { ok: false, code: coupon.code, reason: "INACTIVE" };

  if (!coupon.hasNoExpiry) {
    if (coupon.startsAt && now < coupon.startsAt) return { ok: false, code: coupon.code, reason: "NOT_STARTED" };
    if (coupon.endsAt && now > coupon.endsAt) return { ok: false, code: coupon.code, reason: "EXPIRED" };
  }

  if (coupon.minCartAmount != null && cartSubtotal < coupon.minCartAmount) return { ok: false, code: coupon.code, reason: "MIN_CART" };
  if (coupon.maxCartAmount != null && cartSubtotal > coupon.maxCartAmount) return { ok: false, code: coupon.code, reason: "MAX_CART" };
  if (coupon.minItemsQuantity != null && itemsQuantity < coupon.minItemsQuantity) return { ok: false, code: coupon.code, reason: "MIN_ITEMS" };

  if (coupon.usageLimitTotal != null && coupon.usageCount >= coupon.usageLimitTotal) return { ok: false, code: coupon.code, reason: "USAGE_LIMIT_REACHED" };

  if (coupon.usageLimitPerCustomer != null && input.customerRedemptionsCount >= coupon.usageLimitPerCustomer) {
    return { ok: false, code: coupon.code, reason: "PER_CUSTOMER_LIMIT_REACHED" };
  }

  if (coupon.newCustomersOnly) {
    if (input.customerOrdersCount > 0) return { ok: false, code: coupon.code, reason: "NEW_CUSTOMERS_ONLY" };
  }

  if (!coupon.allowCombining && input.existingCouponCode && input.existingCouponCode !== coupon.code) {
    return { ok: false, code: coupon.code, reason: "CANNOT_COMBINE" };
  }

  // Future-ready: targeting + sale-item exclusion not enforced yet without real product catalog.
  const discountAmount = computeDiscountAmount(coupon, cartSubtotal);

  if (discountAmount <= 0 && !coupon.freeShipping) {
    return { ok: false, code: coupon.code, reason: "NOT_APPLICABLE" };
  }

  return { ok: true, code: coupon.code, discountAmount, freeShipping: coupon.freeShipping };
}

export function reasonToHebrew(reason: CouponInvalidReason): string {
  if (reason === "INACTIVE") return "הקופון אינו בתוקף";
  if (reason === "NOT_STARTED") return "הקופון עדיין לא פעיל";
  if (reason === "EXPIRED") return "הקופון פג תוקף";
  if (reason === "MIN_CART") return "נדרש סכום מינימלי כדי להשתמש בקופון";
  if (reason === "MAX_CART") return "הקופון אינו תקף לסל זה";
  if (reason === "MIN_ITEMS") return "נדרשת כמות מינימלית של פריטים כדי להשתמש בקופון";
  if (reason === "USAGE_LIMIT_REACHED") return "הקופון כבר נוצל במספר הפעמים המקסימלי";
  if (reason === "PER_CUSTOMER_LIMIT_REACHED") return "הקופון כבר נוצל במספר הפעמים המקסימלי ללקוח";
  if (reason === "NEW_CUSTOMERS_ONLY") return "הקופון תקף ללקוחות חדשים בלבד";
  if (reason === "CANNOT_COMBINE") return "לא ניתן לשלב את הקופון עם קופון נוסף";
  if (reason === "NOT_APPLICABLE") return "הקופון אינו תקף לסל זה";
  return "הקופון אינו בתוקף";
}

