import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { StudioSubcategory } from "../constants/studioData";
import { getApiBaseUrl } from "../lib/apiBase";
import { loadBootstrapOnce, loadPublicProductsOnce } from "../lib/studioDataLoader";
import { studioCategories, studioFonts, studioPayments, studioShippingMethods } from "../constants/studioData";
import CheckoutForm, { type CheckoutFormData } from "./checkout/CheckoutForm";

type StudioPageProps = {
  onBackToLanding: () => void;
};

const stepLabels = ["בחירת מוצר", "עיצוב אישי", "פרטים ותשלום", "סיום הזמנה"];

const shekel = (n: number) => `₪${n.toLocaleString("he-IL")}`;

type PublicVariant = {
  id: string;
  color: string | null;
  pendantType: string | null;
  material: string | null;
  stock: number;
  price: number;
  lowThreshold?: number;
};

type PublicProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  images: string[];
  /** Prisma main category id (tabs from bootstrap use this). */
  mainCategoryId?: string | null;
  studioCategory: string;
  subcategoryLabel: string | null;
  subcategoryLabels?: string[];
  audience?: "men" | "women" | "couple" | null;
  audiences?: Array<"men" | "women" | "couple">;
  studioColors: string[];
  stock: number;
  allowCustomerImageUpload?: boolean;
  lowThreshold?: number;
  variants?: PublicVariant[];
};

type ColorKey = "gold" | "silver" | "rose" | "black";

type StudioColorRow = {
  name: string;
  swatch: string;
  variantId?: string;
  stock: number;
  pendantType?: string | null;
  material?: string | null;
  price: number;
  colorKey: ColorKey | null;
};

type StudioRuntimeProduct = {
  id: string;
  mainCategoryId: string | null;
  category: string;
  subcategory: StudioSubcategory;
  title: string;
  description: string;
  price: number;
  image: string | null;
  images: string[];
  colors: StudioColorRow[];
  totalStock: number;
  allowCustomerImageUpload: boolean;
  lowThreshold: number;
};

type EngravingItem = {
  id: string;
  text: string;
  font: string;
  size: number;
  x: number;
  y: number;
};

const COLOR_META: Record<ColorKey, { name: string; swatch: string }> = {
  gold: { name: "זהב", swatch: "#d4af37" },
  silver: { name: "כסף", swatch: "#c0c0c0" },
  rose: { name: "רוז גולד", swatch: "#d4a5a0" },
  black: { name: "שחור", swatch: "#2a2a2a" }
};

function tokenToColorKey(token: string): ColorKey | null {
  const x = String(token).trim().toLowerCase();
  if (!x) return null;
  if (x === "gold" || x === "זהב") return "gold";
  if (x === "silver" || x === "כסף") return "silver";
  if (x === "rose" || x === "רוז" || x.includes("רוז")) return "rose";
  if (x === "black" || x.includes("שחור")) return "black";
  return null;
}

function inferColorKeyFromLabel(raw: string | null | undefined): ColorKey | null {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("שחור") || s.includes("black")) return "black";
  if (s.includes("רוז") || s.includes("rose")) return "rose";
  if (s.includes("כסף") || s.includes("silver")) return "silver";
  if (s.includes("זהב") || s.includes("gold")) return "gold";
  return null;
}

function buildStudioColors(p: PublicProduct): StudioColorRow[] {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const allowed = new Set(
    (p.studioColors ?? []).map((t) => tokenToColorKey(String(t))).filter((k): k is ColorKey => Boolean(k))
  );

  if (variants.length > 0) {
    const mapped: Array<StudioColorRow | null> = variants.map((v) => {
      const key = inferColorKeyFromLabel(v.color) ?? tokenToColorKey(String(v.color ?? ""));
      // Keep color source-of-truth consistent with admin-assigned product colors.
      if (allowed.size > 0) {
        if (!key) return null;
        if (!allowed.has(key)) return null;
      }
      const meta = key ? COLOR_META[key] : { name: String(v.color || "צבע").trim() || "צבע", swatch: "#b8b8b8" };
      const row: StudioColorRow = {
        name: meta.name,
        swatch: meta.swatch,
        variantId: v.id,
        stock: Number(v.stock) || 0,
        pendantType: v.pendantType ?? null,
        material: v.material ?? null,
        price: Number(v.price) || Number(p.price) || 0,
        colorKey: key,
      };
      return row;
    });
    const rows = mapped.filter((x): x is StudioColorRow => x !== null);
    if (rows.length > 0) return rows;
  }

  const onlyKeys = (p.studioColors ?? []).map((t) => tokenToColorKey(String(t))).filter((k): k is ColorKey => Boolean(k));
  if (onlyKeys.length === 0) {
    return [
      {
        name: "מלאי כללי",
        swatch: "#c0c0c0",
        stock: Number(p.stock) || 0,
        price: Number(p.price) || 0,
        colorKey: null,
      },
    ];
  }
  return onlyKeys.map((key) => ({
    name: COLOR_META[key].name,
    swatch: COLOR_META[key].swatch,
    stock: Number(p.stock) || 0,
    price: Number(p.price) || 0,
    colorKey: key,
  }));
}

function pendantShapeClassName(pendantType: string | null | undefined): string {
  const t = String(pendantType ?? "").trim();
  if (!t) return "";
  if (t.includes("לב")) return "pendant-heart";
  if (t.includes("עיגול")) return "pendant-circle";
  if (t.includes("ריבוע")) return "pendant-square";
  if (t.includes("מלבן")) return "pendant-bar";
  return "";
}

const ENGRAVE_MIN_PX = 8;
const ENGRAVE_MAX_PX = 44;

function canvasFontString(fontId: string, fontSize: number, weight = 600) {
  const fam =
    fontId === "assistant"
      ? "Assistant, Arial, sans-serif"
      : fontId === "david"
        ? '"David Libre", Georgia, serif'
        : "Heebo, Arial, sans-serif";
  return `${weight} ${fontSize}px ${fam}`;
}

function measureLineWidthPx(line: string, fontSize: number, fontId: string): number {
  if (typeof document === "undefined") return 0;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 99999;
  ctx.font = canvasFontString(fontId, fontSize);
  return ctx.measureText(line || " ").width;
}

function widestLinePx(text: string, fontSize: number, fontId: string): number {
  const lines = String(text ?? "").split("\n");
  let w = 0;
  for (const line of lines) w = Math.max(w, measureLineWidthPx(line, fontSize, fontId));
  return w;
}

function lineBlockHeightPx(text: string, fontSize: number): number {
  const n = Math.max(1, String(text ?? "").split("\n").length);
  return n * fontSize * 1.22;
}

/** Largest font size in [minPx, maxPx] that fits width+height; returns minPx-1 if none fit. */
function fitFontSizeToBox(text: string, fontId: string, maxWidthPx: number, maxHeightPx: number, startHigh: number): number {
  const hi = Math.min(ENGRAVE_MAX_PX, Math.max(ENGRAVE_MIN_PX, Math.round(startHigh)));
  for (let s = hi; s >= ENGRAVE_MIN_PX; s -= 1) {
    if (widestLinePx(text, s, fontId) <= maxWidthPx && lineBlockHeightPx(text, s) <= maxHeightPx) return s;
  }
  return ENGRAVE_MIN_PX - 1;
}

const DEFAULT_STUDIO_CATEGORY_ORDER: string[] = studioCategories.map((c) => c.id);

function normalizeCategoryKey(raw: string) {
  const v = String(raw || "").trim().toLowerCase();
  if (v.includes("זוג") || v.includes("couple")) return "couple";
  if (v.includes("bracelet") || v.includes("צמיד")) return "bracelets";
  if (v.includes("necklace") || v.includes("שרשר")) return "necklaces";
  if (v.includes("key") || v.includes("מחזיק")) return "keychains";
  if (v.includes("other") || v.includes("אחר")) return "other";
  return v;
}

const StudioPage = ({ onBackToLanding }: StudioPageProps) => {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<string>("bracelets");
  const [categoryOrder, setCategoryOrder] = useState<string[]>(DEFAULT_STUDIO_CATEGORY_ORDER);
  const [categoryLabelById, setCategoryLabelById] = useState<Record<string, string>>(
    Object.fromEntries(studioCategories.map((c) => [c.id, c.label]))
  );
  const [runtimeProducts, setRuntimeProducts] = useState<StudioRuntimeProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productId, setProductId] = useState<string>("");
  const [selectedColorByProduct, setSelectedColorByProduct] = useState<Record<string, number>>({});

  const [engravings, setEngravings] = useState<EngravingItem[]>([
    { id: "engraving-1", text: "לנצח שלך", font: "heebo", size: 28, x: 0, y: 0 },
  ]);
  const engravingsRef = useRef(engravings);
  engravingsRef.current = engravings;
  const [activeEngravingId, setActiveEngravingId] = useState("engraving-1");
  const [activeTextDraft, setActiveTextDraft] = useState("לנצח שלך");
  const [customerImageDataUrl, setCustomerImageDataUrl] = useState<string | null>(null);
  const customerImageInputRef = useRef<HTMLInputElement | null>(null);
  const [galleryModalUrl, setGalleryModalUrl] = useState<string | null>(null);
  const [engraveFitError, setEngraveFitError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(14);
  const [zoom, setZoom] = useState(1);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<null | { code: string; discountAmount: number; freeShipping: boolean }>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const [shippingId, setShippingId] = useState("home");
  const [paymentId, setPaymentId] = useState("card");
  const objectRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const apiBase = useMemo(() => getApiBaseUrl(), []);

  const activeEngraving = useMemo(
    () => engravings.find((item) => item.id === activeEngravingId) ?? engravings[0] ?? null,
    [activeEngravingId, engravings]
  );
  const engravingSummary = useMemo(
    () => engravings.map((item) => item.text.trim()).filter(Boolean).join(" | "),
    [engravings]
  );

  function updateEngraving(id: string, patch: Partial<EngravingItem>) {
    setEngravings((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addEngraving() {
    const id = `engraving-${Date.now()}`;
    setEngravings((prev) => {
      const idx = prev.length;
      const y = clampPercent(-18 + idx * 12);
      const next = [...prev, { id, text: "שורה חדשה", font: "heebo", size: 26, x: 0, y }];
      queueMicrotask(() => setActiveEngravingId(id));
      return next;
    });
  }

  function removeActiveEngraving() {
    if (engravings.length <= 1 || !activeEngraving) return;
    const next = engravings.filter((item) => item.id !== activeEngraving.id);
    setEngravings(next);
    setActiveEngravingId(next[0]?.id ?? "");
  }

  function clampPercent(value: number) {
    return Math.max(-45, Math.min(45, value));
  }

  function autoFitEngravingSizes() {
    setEngraveFitError(null);
    const el = objectRef.current;
    if (!el || typeof document === "undefined") {
      setEngraveFitError("לא ניתן לחשב התאמה כרגע — נסה שוב בעוד רגע.");
      return;
    }
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      setEngraveFitError("לא ניתן לחשב התאמה כרגע.");
      return;
    }
    const maxW = rect.width * 0.8;
    const items = engravingsRef.current;
    const n = Math.max(1, items.length);
    const maxHPer = (rect.height * 0.48) / n;

    const updates = new Map<string, number>();
    for (const item of items) {
      const fitted = fitFontSizeToBox(item.text || " ", item.font, maxW, maxHPer, item.size);
      if (fitted < ENGRAVE_MIN_PX) {
        setEngraveFitError(
          "הטקסט ארוך מדי גם בגודל המינימלי על התכשיט. יש לקצר, לרדת שורה (Enter), או לפצל למספר שדות."
        );
        return;
      }
      updates.set(item.id, fitted);
    }
    setEngravings((prev) => prev.map((it) => (updates.has(it.id) ? { ...it, size: updates.get(it.id)! } : it)));
  }

  function startDragEngraving(id: string) {
    setActiveEngravingId(id);
    setDraggingId(id);
  }

  // Only sync the textarea draft when switching which engraving box is active. Including `engravings`
  // here re-ran the effect on every keystroke and could steal focus / reset caret in some cases.
  useEffect(() => {
    const selected =
      engravingsRef.current.find((item) => item.id === activeEngravingId) ?? engravingsRef.current[0] ?? null;
    setActiveTextDraft(selected?.text ?? "");
  }, [activeEngravingId]);

  useEffect(() => {
    if (!draggingId) return;
    let rafId: number | null = null;
    let pending: { x: number; y: number } | null = null;
    const flush = () => {
      rafId = null;
      if (!pending || !draggingId) return;
      updateEngraving(draggingId, pending);
      pending = null;
    };
    const onMove = (event: PointerEvent) => {
      const target = objectRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100 - 50);
      const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100 - 50);
      pending = { x, y };
      if (rafId == null) rafId = requestAnimationFrame(flush);
    };
    const onUp = () => setDraggingId(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [draggingId]);

  useEffect(() => {
    if (!galleryModalUrl) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGalleryModalUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [galleryModalUrl]);

  useEffect(() => {
    let mounted = true;
    // Bootstrap (category order) is non-critical; load in parallel without blocking products.
    loadBootstrapOnce(apiBase)
      .then((bootstrap) => {
        if (!mounted || !bootstrap) return;
        const dbCategories = Array.isArray((bootstrap as any)?.categories)
          ? ((bootstrap as any).categories as Array<{ id?: string; name?: string; isActive?: boolean }>)
          : [];
        const activeDbCategories = dbCategories
          .filter((c) => c?.isActive !== false && typeof c?.id === "string" && c.id)
          .map((c) => ({ id: String(c.id), label: String(c.name || c.id) }));
        if (activeDbCategories.length > 0) {
          setCategoryLabelById((prev) => ({
            ...prev,
            ...Object.fromEntries(activeDbCategories.map((c) => [c.id, c.label])),
          }));
        }
        const ordered = activeDbCategories.length > 0
          ? activeDbCategories.map((c) => c.id)
          : DEFAULT_STUDIO_CATEGORY_ORDER;
        if (ordered.length === 0) return;
        setCategoryOrder(ordered);
        setCategory((prev) => (ordered.includes(prev) ? prev : ordered[0]));
      })
      .catch(() => undefined);
    (async () => {
      try {
        const data = await loadPublicProductsOnce(apiBase);
        const rows = Array.isArray(data.products) ? data.products : [];
        const mapped: StudioRuntimeProduct[] = rows.map((p) => {
          const colors = buildStudioColors(p);
          const explicitAudience =
            p.audience === "men" || p.audience === "women" || p.audience === "couple" ? p.audience : null;
          const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
          return {
            id: p.id,
            mainCategoryId: typeof p.mainCategoryId === "string" && p.mainCategoryId ? p.mainCategoryId : null,
            category: p.studioCategory,
            subcategory: explicitAudience,
            title: p.name,
            description: p.description || "",
            price: Number(p.price) || 0,
            image: p.image ?? imgs[0] ?? null,
            images: imgs.length ? imgs : (p.image ? [p.image] : []).filter(Boolean) as string[],
            colors,
            totalStock: Number(p.stock) || 0,
            allowCustomerImageUpload: Boolean(p.allowCustomerImageUpload),
            lowThreshold: typeof p.lowThreshold === "number" ? p.lowThreshold : 5,
          };
        });
        if (!mounted) return;
        setRuntimeProducts(mapped);
        setSelectedColorByProduct(Object.fromEntries(mapped.map((p) => [p.id, 0])));
        if (mapped.length > 0) setProductId((prev) => (prev && mapped.some((p) => p.id === prev) ? prev : mapped[0].id));
      } catch {
        if (!mounted) return;
        setRuntimeProducts([]);
        setCouponMsg("לא ניתן לטעון מוצרים כרגע");
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiBase]);

  useEffect(() => {
    setCustomerImageDataUrl(null);
  }, [productId]);

  const activeProduct = useMemo(() => {
    if (runtimeProducts.length === 0) return null;
    return runtimeProducts.find((p) => p.id === productId) ?? runtimeProducts[0];
  }, [productId, runtimeProducts]);
  const activeColor = activeProduct
    ? activeProduct.colors[selectedColorByProduct[activeProduct.id] ?? 0] ?? activeProduct.colors[0]
    : null;

  const pendantExtraClass = useMemo(() => pendantShapeClassName(activeColor?.pendantType), [activeColor?.pendantType]);

  const galleryUrls = activeProduct?.images?.length ? activeProduct.images : activeProduct?.image ? [activeProduct.image] : [];
  /** תמונת הרקע בתוך מודל החריטה — תמיד התמונה הראשית; שאר התמונות נצפות בגלריה למטה ובפופאפ בלבד. */
  const engraveStageImageUrl = galleryUrls[0] ?? activeProduct?.image ?? null;

  const normalizedTab = useMemo(() => {
    const n = normalizeCategoryKey(category);
    if (n === "bracelets" || n === "necklaces" || n === "keychains" || n === "other" || n === "couple") return n;
    const hit = runtimeProducts.find((p) => p.mainCategoryId === category);
    if (hit?.category) return normalizeCategoryKey(hit.category);
    return n;
  }, [category, runtimeProducts]);

  const tabMatchesMainCategoryId = useMemo(
    () => runtimeProducts.some((p) => p.mainCategoryId === category),
    [category, runtimeProducts]
  );

  const isGroupedMenWomenCouple = useMemo(() => {
    return normalizedTab === "bracelets" || normalizedTab === "necklaces";
  }, [normalizedTab]);

  const filteredProducts = useMemo(() => {
    return runtimeProducts.filter((p) => {
      const inTab = tabMatchesMainCategoryId
        ? p.mainCategoryId === category
        : category === p.category || normalizeCategoryKey(p.category) === normalizedTab;

      if (!inTab) return false;

      if (normalizedTab === "couple") {
        return p.subcategory === "couple";
      }
      if ((normalizedTab === "bracelets" || normalizedTab === "necklaces") && !p.subcategory) {
        return false;
      }
      return true;
    });
  }, [category, runtimeProducts, normalizedTab, tabMatchesMainCategoryId]);

  const groupedProducts = useMemo(() => {
    const men: StudioRuntimeProduct[] = [];
    const women: StudioRuntimeProduct[] = [];
    const couple: StudioRuntimeProduct[] = [];
    const others: StudioRuntimeProduct[] = [];
    for (const p of filteredProducts) {
      if (p.subcategory === "men") men.push(p);
      else if (p.subcategory === "women") women.push(p);
      else if (p.subcategory === "couple") couple.push(p);
      else others.push(p);
    }
    return { men, women, couple, others };
  }, [filteredProducts]);

  const shipping = studioShippingMethods.find((s) => s.id === shippingId) ?? studioShippingMethods[0];
  const subtotal = (activeColor?.price ?? activeProduct?.price ?? 0) * qty;
  const discount = appliedCoupon?.discountAmount ?? 0;
  const effectiveShippingFee = appliedCoupon?.freeShipping ? 0 : shipping.fee;
  const total = Math.max(0, subtotal + effectiveShippingFee - discount);
  const maxPurchasableQty = Math.max(1, Number(activeColor?.stock ?? 0));
  const qtyInStock = Boolean(activeColor && qty <= (activeColor.stock || 0));
  const canPurchase = Boolean(activeProduct && activeColor && activeColor.stock > 0 && activeProduct.totalStock > 0 && qtyInStock);

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code,
          cartSubtotal: subtotal,
          itemsQuantity: qty,
          customerEmail: null
        })
      });
      const data = await res.json();
      if (data.ok) {
        setAppliedCoupon({ code: data.code, discountAmount: data.discountAmount, freeShipping: data.freeShipping });
        setCouponMsg("הקופון הוחל בהצלחה");
      } else {
        setAppliedCoupon(null);
        setCouponMsg(data.message || "הקופון אינו בתוקף");
      }
    } catch {
      setAppliedCoupon(null);
      setCouponMsg("לא ניתן לאמת את הקופון כרגע");
    }
  }

  function clearCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponMsg(null);
  }

  const submitOrder = useCallback(
    async (customer: CheckoutFormData) => {
      if (submitting) return;
      if (!activeProduct || !activeColor) {
        setCouponMsg("לא נבחר מוצר תקין");
        return;
      }
      if (!activeColor.variantId || !activeProduct.id) {
        setCouponMsg("לא ניתן להשלים הזמנה ללא וריאציה תקינה");
        return;
      }
      if (activeColor.stock <= 0 || activeProduct.totalStock <= 0) {
        setCouponMsg("המוצר שנבחר אזל מהמלאי");
        return;
      }
      if (qty > activeColor.stock) {
        setCouponMsg(`הכמות שבחרת גבוהה מהמלאי הזמין (${activeColor.stock})`);
        return;
      }
      setSubmitting(true);
      setCouponMsg(null);
      try {
        const res = await fetch(`${apiBase}/api/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            customer,
            shippingFee: shipping.fee,
            couponCode: appliedCoupon?.code || null,
            items: [
              {
                name: `${activeProduct.title} (${activeColor.name})`,
                productId: activeProduct.id,
                variantId: activeColor.variantId,
                qty,
                unitPrice: Math.round((activeColor.price ?? activeProduct.price) * 100),
                color: activeColor.name,
                pendantShape: activeColor.pendantType ?? null,
                material: activeColor.material ?? null,
                engravingText: engravingSummary || null,
                customerImageUrl: activeProduct.allowCustomerImageUpload ? customerImageDataUrl : null,
              }
            ]
          })
        });
        let data: { ok?: boolean; order?: { orderNumber?: string }; message?: string; hint?: string } = {};
        try {
          const text = await res.text();
          if (text) data = JSON.parse(text);
        } catch {
          data = {};
        }
        if (!res.ok || !data?.ok || !data.order?.orderNumber) {
          const hint =
            res.status === 500 || res.status === 0
              ? " ודאו שהשרת (בקאנד) רץ ושמסד הנתונים מחובר."
              : "";
          setCouponMsg(
            (data?.message || (res.status === 500 ? "שגיאת שרת" : "הזמנה נכשלה")) +
              (data?.hint ? ` (${String(data.hint).slice(0, 120)})` : "") +
              hint
          );
          return;
        }
        setOrderNumber(data.order.orderNumber);
        setStep(3);
      } catch {
        setCouponMsg(
          "לא ניתן להתחבר לשרת. ודאו שהבקאנד רץ (למשל npm run dev ב-backend) ושהאתר נטען דרך npm run dev כדי ש־/api יעבוד."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      submitting,
      activeProduct,
      activeColor,
      qty,
      appliedCoupon,
      shipping,
      apiBase,
      engravingSummary,
      customerImageDataUrl
    ]
  );

  const goNext = () => setStep((s) => Math.min(3, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));
  const selectProductAndGoDesign = (id: string) => {
    setProductId(id);
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="studio-shell" dir="rtl">
      <header className="studio-topbar">
        <div className="studio-top-actions">
          {step === 1 ? (
            <button type="button" className="studio-secondary-btn studio-top-fit" onClick={autoFitEngravingSizes}>
              התאמת טקסט לתכשיט
            </button>
          ) : null}
          <button
            type={step === 2 ? "submit" : "button"}
            form={step === 2 ? "studio-checkout-form" : undefined}
            className="studio-primary-btn studio-top-next"
            onClick={() => {
              if (step !== 2) goNext();
            }}
            disabled={step === 3 || submitting || (step === 0 && !activeProduct) || (step === 2 && !canPurchase)}
          >
            {step === 2 ? (submitting ? "מעבד תשלום..." : "לתשלום מאובטח") : step === 3 ? "הושלם" : "השלב הבא"}
          </button>
          <button type="button" className="studio-secondary-btn studio-top-back" onClick={goBack} disabled={step === 0}>
            חזרה
          </button>
        </div>
        <div className="studio-progress">
          {stepLabels.map((label, idx) => (
            <div key={label} className={`studio-step-pill ${idx === step ? "active" : idx < step ? "done" : ""}`}>
              <span>{idx + 1}</span>
              {label}
            </div>
          ))}
        </div>
      </header>

      {step === 0 ? (
        <section className="studio-step-section">
          <h2>בוחרים מוצר להתחלה</h2>
          <div className="studio-chip-row">
            {categoryOrder.map((catId) => {
              const label = categoryLabelById[catId] ?? (normalizeCategoryKey(catId) === "couple" ? "זוגיים" : catId);
              return (
                <button
                  type="button"
                  key={catId}
                  className={`studio-chip ${category === catId ? "active" : ""}`}
                  onClick={() => {
                    setCategory(catId);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="studio-products-grid studio-products-grid--uniform">
            {loadingProducts ? <p>טוען מוצרים...</p> : null}
            {!loadingProducts && filteredProducts.length === 0 ? <p>אין מוצרים זמינים כרגע בקטגוריה זו.</p> : null}
            {isGroupedMenWomenCouple && groupedProducts.men.length > 0 ? (
              <>
                <div className="studio-subsection-title">גברים</div>
                {groupedProducts.men.map((product) => {
                  const outOfStock = product.totalStock <= 0;
                  const lowStock = !outOfStock && product.totalStock > 0 && product.totalStock <= product.lowThreshold;
                  return (
                    <article
                      key={product.id}
                      className={`studio-product-card ${productId === product.id ? "selected" : ""} ${outOfStock ? "out-of-stock" : ""}`}
                      onClick={() => selectProductAndGoDesign(product.id)}
                    >
                      <span className="studio-product-category-label">
                        {categoryLabelById[product.category] ?? "קטגוריה"}
                      </span>
                      {outOfStock ? <span className="studio-stock-badge">אזל מהמלאי</span> : null}
                      {lowStock ? <span className="studio-stock-badge studio-stock-badge--low">מלאי מוגבל</span> : null}
                      <div className={`studio-product-thumb ${product.category}`}>
                        {product.image ? <img src={product.image} alt={product.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                      </div>
                      <h3>{product.title}</h3>
                      <strong className="studio-product-price">{shekel(product.price)}</strong>
                      <div className="studio-swatch-row">
                        {product.colors.map((color, index) => (
                          <button
                            key={`${product.id}-${color.name}-${index}`}
                            type="button"
                            className={`studio-color-swatch ${index === (selectedColorByProduct[product.id] ?? 0) ? "active" : ""}`}
                            style={{ ["--swatch" as string]: color.swatch, opacity: color.stock > 0 ? 1 : 0.35 }}
                            aria-label={color.name}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedColorByProduct((prev) => ({ ...prev, [product.id]: index }));
                            }}
                          />
                        ))}
                      </div>
                      <button type="button" className="studio-select-btn" disabled={outOfStock}>
                        {outOfStock ? "אזל המלאי" : "בחר"}
                      </button>
                    </article>
                  );
                })}
              </>
            ) : null}
            {isGroupedMenWomenCouple && groupedProducts.women.length > 0 ? (
              <>
                <div className="studio-subsection-divider" />
                <div className="studio-subsection-title">נשים</div>
                {groupedProducts.women.map((product) => {
                  const outOfStock = product.totalStock <= 0;
                  const lowStock = !outOfStock && product.totalStock > 0 && product.totalStock <= product.lowThreshold;
                  return (
                    <article
                      key={product.id}
                      className={`studio-product-card ${productId === product.id ? "selected" : ""} ${outOfStock ? "out-of-stock" : ""}`}
                      onClick={() => selectProductAndGoDesign(product.id)}
                    >
                      <span className="studio-product-category-label">
                        {categoryLabelById[product.category] ?? "קטגוריה"}
                      </span>
                      {outOfStock ? <span className="studio-stock-badge">אזל מהמלאי</span> : null}
                      {lowStock ? <span className="studio-stock-badge studio-stock-badge--low">מלאי מוגבל</span> : null}
                      <div className={`studio-product-thumb ${product.category}`}>
                        {product.image ? <img src={product.image} alt={product.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                      </div>
                      <h3>{product.title}</h3>
                      <strong className="studio-product-price">{shekel(product.price)}</strong>
                      <div className="studio-swatch-row">
                        {product.colors.map((color, index) => (
                          <button
                            key={`${product.id}-${color.name}-${index}`}
                            type="button"
                            className={`studio-color-swatch ${index === (selectedColorByProduct[product.id] ?? 0) ? "active" : ""}`}
                            style={{ ["--swatch" as string]: color.swatch, opacity: color.stock > 0 ? 1 : 0.35 }}
                            aria-label={color.name}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedColorByProduct((prev) => ({ ...prev, [product.id]: index }));
                            }}
                          />
                        ))}
                      </div>
                      <button type="button" className="studio-select-btn" disabled={outOfStock}>
                        {outOfStock ? "אזל המלאי" : "בחר"}
                      </button>
                    </article>
                  );
                })}
              </>
            ) : null}
            {isGroupedMenWomenCouple && groupedProducts.couple.length > 0 ? (
              <>
                <div className="studio-subsection-divider" />
                <div className="studio-subsection-title">זוגיים</div>
                {groupedProducts.couple.map((product) => {
                  const outOfStock = product.totalStock <= 0;
                  const lowStock = !outOfStock && product.totalStock > 0 && product.totalStock <= product.lowThreshold;
                  return (
                    <article
                      key={product.id}
                      className={`studio-product-card ${productId === product.id ? "selected" : ""} ${outOfStock ? "out-of-stock" : ""}`}
                      onClick={() => selectProductAndGoDesign(product.id)}
                    >
                      <span className="studio-product-category-label">
                        {categoryLabelById[product.category] ?? "קטגוריה"}
                      </span>
                      {outOfStock ? <span className="studio-stock-badge">אזל מהמלאי</span> : null}
                      {lowStock ? <span className="studio-stock-badge studio-stock-badge--low">מלאי מוגבל</span> : null}
                      <div className={`studio-product-thumb ${product.category}`}>
                        {product.image ? <img src={product.image} alt={product.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                      </div>
                      <h3>{product.title}</h3>
                      <strong className="studio-product-price">{shekel(product.price)}</strong>
                      <div className="studio-swatch-row">
                        {product.colors.map((color, index) => (
                          <button
                            key={`${product.id}-${color.name}-${index}`}
                            type="button"
                            className={`studio-color-swatch ${index === (selectedColorByProduct[product.id] ?? 0) ? "active" : ""}`}
                            style={{ ["--swatch" as string]: color.swatch, opacity: color.stock > 0 ? 1 : 0.35 }}
                            aria-label={color.name}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedColorByProduct((prev) => ({ ...prev, [product.id]: index }));
                            }}
                          />
                        ))}
                      </div>
                      <button type="button" className="studio-select-btn" disabled={outOfStock}>
                        {outOfStock ? "אזל המלאי" : "בחר"}
                      </button>
                    </article>
                  );
                })}
              </>
            ) : null}
            {(!isGroupedMenWomenCouple ? filteredProducts : groupedProducts.others).map((product) => {
              const outOfStock = product.totalStock <= 0;
              const lowStock = !outOfStock && product.totalStock > 0 && product.totalStock <= product.lowThreshold;
              return (
                <article
                  key={product.id}
                  className={`studio-product-card ${productId === product.id ? "selected" : ""} ${outOfStock ? "out-of-stock" : ""}`}
                  onClick={() => selectProductAndGoDesign(product.id)}
                >
                  <span className="studio-product-category-label">
                    {categoryLabelById[product.category] ?? "קטגוריה"}
                  </span>
                  {outOfStock ? <span className="studio-stock-badge">אזל מהמלאי</span> : null}
                  {lowStock ? <span className="studio-stock-badge studio-stock-badge--low">מלאי מוגבל</span> : null}
                  <div className={`studio-product-thumb ${product.category}`}>
                    {product.image ? <img src={product.image} alt={product.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                  </div>
                  <h3>{product.title}</h3>
                  <strong className="studio-product-price">{shekel(product.price)}</strong>
                  <div className="studio-swatch-row">
                    {product.colors.map((color, index) => (
                      <button
                        key={`${product.id}-${color.name}-${index}`}
                        type="button"
                        className={`studio-color-swatch ${index === (selectedColorByProduct[product.id] ?? 0) ? "active" : ""}`}
                        style={{ ["--swatch" as string]: color.swatch, opacity: color.stock > 0 ? 1 : 0.35 }}
                        aria-label={color.name}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedColorByProduct((prev) => ({ ...prev, [product.id]: index }));
                        }}
                      />
                    ))}
                  </div>
                  <button type="button" className="studio-select-btn" disabled={outOfStock}>
                    {outOfStock ? "אזל המלאי" : "בחר"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="studio-step-section">
          <h2>מעצבים את התכשיט שלך</h2>
          {!activeProduct || !activeColor ? (
            <p>בחר מוצר מהשלב הראשון כדי להמשיך לעיצוב.</p>
          ) : null}
          <div className="studio-custom-layout">
            <aside className="studio-control-panel">
              <label>
                טקסט לחריטה (הבוקס הפעיל)
                <textarea
                  rows={4}
                  value={activeTextDraft}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEngraveFitError(null);
                    setActiveTextDraft(value);
                    if (activeEngraving) updateEngraving(activeEngraving.id, { text: value });
                  }}
                />
              </label>
              <label>
                פונט
                <select
                  value={activeEngraving?.font ?? "heebo"}
                  onChange={(e) => {
                    setEngraveFitError(null);
                    activeEngraving && updateEngraving(activeEngraving.id, { font: e.target.value });
                  }}
                >
                  {studioFonts.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                גודל טקסט (חריטה)
                <input
                  type="range"
                  min={ENGRAVE_MIN_PX}
                  max={ENGRAVE_MAX_PX}
                  value={activeEngraving?.size ?? 28}
                  onChange={(e) => {
                    setEngraveFitError(null);
                    activeEngraving && updateEngraving(activeEngraving.id, { size: Number(e.target.value) });
                  }}
                />
              </label>
              <div className="studio-engraving-tools">
                <button type="button" className="studio-chip" onClick={addEngraving}>
                  הוסף בוקס טקסט / אימוג'י
                </button>
                <button type="button" className="studio-chip light" onClick={removeActiveEngraving} disabled={engravings.length <= 1}>
                  מחק בוקס נבחר
                </button>
                <button type="button" className="studio-chip light" onClick={autoFitEngravingSizes} title="מקטין או מגדיל כך שכל הטקסט ייכנס לתכשיט">
                  התאמת גודל אוטומטית
                </button>
              </div>
              {engraveFitError ? (
                <p className="studio-engrave-fit-error" role="alert">
                  {engraveFitError}
                </p>
              ) : null}
              <div className="studio-engraving-list">
                {engravings.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`studio-chip ${activeEngravingId === item.id ? "active" : ""}`}
                    onClick={() => setActiveEngravingId(item.id)}
                  >
                    טקסט {idx + 1}: {item.text.trim() || "ריק"}
                  </button>
                ))}
              </div>
              {activeProduct ? (
                <div className="studio-chip-row studio-color-pick-row" aria-label="צבע מוצר">
                  {activeProduct.colors.map((c, i) => (
                    <button
                      type="button"
                      key={`${activeProduct.id}-color-${i}`}
                      className={`studio-chip material ${(selectedColorByProduct[activeProduct.id] ?? 0) === i ? "active" : ""}`}
                      style={{ ["--mat" as string]: c.swatch }}
                      onClick={() => setSelectedColorByProduct((prev) => ({ ...prev, [activeProduct.id]: i }))}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {activeProduct?.allowCustomerImageUpload ? (
                <div className="studio-customer-photo-block">
                  <div className="studio-field-hint">תמונה אישית (אופציונלי)</div>
                  <input
                    ref={customerImageInputRef}
                    type="file"
                    accept="image/*"
                    className="visually-hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () => setCustomerImageDataUrl(typeof reader.result === "string" ? reader.result : null);
                      reader.readAsDataURL(f);
                      e.target.value = "";
                    }}
                  />
                  <div className="studio-customer-photo-actions">
                    <button type="button" className="studio-chip" onClick={() => customerImageInputRef.current?.click()}>
                      {customerImageDataUrl ? "החלפת תמונה" : "העלאת תמונה"}
                    </button>
                    {customerImageDataUrl ? (
                      <button type="button" className="studio-chip light" onClick={() => setCustomerImageDataUrl(null)}>
                        הסר תמונה
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <label>
                כמות
                <input
                  type="number"
                  min={1}
                  max={maxPurchasableQty}
                  value={qty}
                  onChange={(e) => {
                    const next = Math.max(1, Number(e.target.value) || 1);
                    setQty(Math.min(maxPurchasableQty, next));
                  }}
                />
              </label>
              <label>
                הערות להזמנה
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="לדוגמה: אריזת מתנה, בקשות מיוחדות" />
              </label>
            </aside>

            <div className="studio-preview-panel">
              <div className="studio-preview-stage">
                <div
                  ref={objectRef}
                  className={`studio-3d-object ${activeProduct?.category ?? "other"} ${pendantExtraClass} ${engraveStageImageUrl ? "has-photo" : ""}`}
                  style={
                    {
                      transform: `rotateY(${rotation}deg) rotateX(8deg) scale(${zoom})`,
                      ["--studio-metal" as string]: activeColor?.swatch ?? "#d4af37"
                    } as CSSProperties
                  }
                >
                  {engraveStageImageUrl ? (
                    <img className="studio-3d-fill" src={engraveStageImageUrl} alt="" loading="eager" decoding="async" />
                  ) : null}
                  {customerImageDataUrl ? (
                    <img className="studio-customer-overlay" src={customerImageDataUrl} alt="" />
                  ) : null}
                  {engravings.map((item) => {
                    const inkDark = activeColor?.colorKey !== "black";
                    const px = Math.min(ENGRAVE_MAX_PX, Math.max(ENGRAVE_MIN_PX, Math.round(item.size)));
                    return (
                      <span
                        key={item.id}
                        className={`studio-engrave-text ${item.font} ${activeEngravingId === item.id ? "is-active" : ""} ${
                          inkDark ? "engrave-ink--dark" : "engrave-ink--light"
                        }`}
                        style={
                          {
                            left: `calc(50% + ${item.x}%)`,
                            top: `calc(50% + ${item.y}%)`,
                            fontSize: `${px}px`,
                          } as CSSProperties
                        }
                        onPointerDown={() => startDragEngraving(item.id)}
                      >
                        {item.text !== "" ? item.text : "•"}
                      </span>
                    );
                  })}
                </div>
              </div>
              {galleryUrls.length > 0 ? (
                <div className="studio-subgallery" role="list" aria-label="גלריית תמונות המוצר">
                  {galleryUrls.map((url, idx) => (
                    <button
                      key={`${url}-${idx}`}
                      type="button"
                      className={`studio-subgallery-thumb ${galleryModalUrl === url ? "active" : ""}`}
                      onClick={() => setGalleryModalUrl(url)}
                      aria-label={galleryUrls.length > 1 ? `פתיחת תמונה ${idx + 1} בגודל מלא` : "פתיחת תמונה בגודל מלא"}
                    >
                      <img src={url} alt="" loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="studio-slider-row">
                <label>
                  זווית
                  <input type="range" min={-28} max={28} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} />
                </label>
                <label>
                  זום
                  <input
                    type="range"
                    min={80}
                    max={130}
                    value={Math.round(zoom * 100)}
                    onChange={(e) => setZoom(Number(e.target.value) / 100)}
                  />
                </label>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="studio-step-section studio-step-section--checkout">
          <h2>פרטים ותשלום</h2>
          <div className="studio-checkout-grid">
            <div className="studio-checkout-col">
              <CheckoutForm
                id="studio-checkout-form"
                className="studio-checkout-form"
                disabled={submitting || !canPurchase}
                onSubmit={submitOrder}
              />
              <div className="studio-shipping-row">
                {studioShippingMethods.map((method) => (
                  <button
                    type="button"
                    key={method.id}
                    className={`studio-ship-card ${shippingId === method.id ? "active" : ""}`}
                    onClick={() => setShippingId(method.id)}
                  >
                    <strong>{method.label}</strong>
                    <span>{method.fee === 0 ? "חינם" : shekel(method.fee)}</span>
                    <small>{method.eta}</small>
                  </button>
                ))}
              </div>
              <div className="studio-pay-row">
                {studioPayments.map((payment) => (
                  <button
                    type="button"
                    key={payment.id}
                    className={`studio-chip ${paymentId === payment.id ? "active" : ""}`}
                    onClick={() => setPaymentId(payment.id)}
                  >
                    {payment.label}
                  </button>
                ))}
              </div>
            </div>
            <aside className="studio-order-summary">
              <h3>סיכום הזמנה</h3>
              <p>{activeProduct?.title ?? "—"}</p>
              <p>צבע: {activeColor?.name ?? "—"}</p>
              <p>חריטה: {engravingSummary || "ללא טקסט"}</p>
              <p>כמות: {qty}</p>
              {activeColor ? (
                <p style={{ fontSize: "0.85rem", opacity: 0.85 }}>
                  מלאי זמין לווריאציה: {activeColor.stock}
                </p>
              ) : null}
              <p>משלוח: {shipping.label}</p>
              {!canPurchase ? <p style={{ color: "#b42318", fontWeight: 700 }}>אזל מהמלאי - לא ניתן להשלים הזמנה</p> : null}
              {activeColor && qty > activeColor.stock ? (
                <p style={{ color: "#b42318", fontWeight: 700 }}>הכמות גבוהה מהמלאי הזמין</p>
              ) : null}
              <hr />
              <p>ביניים: {shekel(subtotal)}</p>
              <p>משלוח: {effectiveShippingFee === 0 ? "חינם" : shekel(effectiveShippingFee)}</p>
              {appliedCoupon ? <p>הנחה ({appliedCoupon.code}): -{shekel(discount)}</p> : null}
              <strong>סה"כ לתשלום: {shekel(total)}</strong>

              <div style={{ marginTop: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", opacity: 0.85 }}>
                  קופון
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="הכנס קוד קופון"
                    style={{ marginTop: "6px" }}
                  />
                </label>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <button type="button" className="studio-chip" onClick={applyCoupon} disabled={!couponCode.trim()}>
                    החל קופון
                  </button>
                  {appliedCoupon ? (
                    <button type="button" className="studio-chip light" onClick={clearCoupon}>
                      הסר
                    </button>
                  ) : null}
                </div>
                {couponMsg ? <p style={{ marginTop: "8px", fontSize: "12px", opacity: 0.85 }}>{couponMsg}</p> : null}
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="studio-step-section studio-success">
          <div className="studio-success-card">
            <div className="studio-success-icon">✓</div>
            <h2>ההזמנה התקבלה בהצלחה</h2>
            <p>מספר הזמנה: {orderNumber ? `#${orderNumber}` : "—"}</p>
            <p style={{ fontSize: "0.88rem", opacity: 0.85, lineHeight: 1.5 }}>
              לבדיקת סטטוס מהדף הראשי: העתיקו את המספר המלא (כולל HG-) או את הספרות האחרונות.
            </p>
            <p>המוצר שלך ייכנס לייצור אישי ונעדכן אותך בכל שלב.</p>
            <button type="button" className="studio-primary-btn" onClick={onBackToLanding}>
              חזרה לדף הבית
            </button>
          </div>
        </section>
      ) : null}

      {galleryModalUrl ? (
        <div
          className="studio-gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="תצוגת תמונה מוגדלת"
          onClick={() => setGalleryModalUrl(null)}
        >
          <button
            type="button"
            className="studio-gallery-lightbox__close"
            aria-label="סגירה"
            onClick={(e) => {
              e.stopPropagation();
              setGalleryModalUrl(null);
            }}
          >
            ×
          </button>
          <img
            src={galleryModalUrl}
            alt=""
            className="studio-gallery-lightbox__img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      <footer className="studio-nav-footer">
        <a
          href="https://wa.me/972559433968"
          target="_blank"
          rel="noreferrer"
          className="studio-whatsapp-btn"
          aria-label="צריכים עזרה? מעבר לווצאפ"
        >
          צריכים עזרה?
        </a>
        <button type="button" className="studio-secondary-btn studio-home-btn" onClick={onBackToLanding}>
          חזרה לדף הבית
        </button>
      </footer>
    </div>
  );
};

export default StudioPage;
