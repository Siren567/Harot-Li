import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Eye, Gift, Palette, Plus, Smile, Trash2 } from "lucide-react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import type { StudioSubcategory } from "../constants/studioData";
import { getApiBaseUrl } from "../lib/apiBase";
import { loadBootstrapOnce, loadPublicProductsOnce } from "../lib/studioDataLoader";
import { studioCategories, studioFonts, studioShippingMethods } from "../constants/studioData";
import CheckoutForm, { type CheckoutFormData } from "./checkout/CheckoutForm";
import Pendant3DPreview from "./Pendant3DPreview";

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

const COLOR_IMAGE_HINTS: Record<ColorKey, string[]> = {
  gold: ["gold", "זהב", "gld"],
  silver: ["silver", "כסף", "slv"],
  rose: ["rose", "rosegold", "רוז"],
  black: ["black", "שחור", "blk"],
};

const FONT_FAMILY_BY_ID: Record<string, string> = {
  assistant: '"Assistant", sans-serif',
  heebo: '"Heebo", sans-serif',
  david: '"David Libre", serif',
  rubik: '"Rubik", sans-serif',
  noto: '"Noto Sans Hebrew", sans-serif',
  alef: '"Alef", sans-serif',
  secular: '"Secular One", sans-serif',
  frank: '"Frank Ruhl Libre", serif',
  varela: '"Varela Round", sans-serif',
};

type EngravingItem = {
  id: string;
  text: string;
  font: string;
  size: number;
  x: number;
  y: number;
  angle: number;
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
  const allowedOrdered = (p.studioColors ?? []).map((t) => tokenToColorKey(String(t))).filter((k): k is ColorKey => Boolean(k));
  const allowed = new Set(allowedOrdered);

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
    if (rows.length > 0) {
      if (allowedOrdered.length === 0) return rows;
      return [...rows].sort((a, b) => {
        const ai = a.colorKey ? allowedOrdered.indexOf(a.colorKey) : -1;
        const bi = b.colorKey ? allowedOrdered.indexOf(b.colorKey) : -1;
        const normA = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
        const normB = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
        if (normA !== normB) return normA - normB;
        return 0;
      });
    }
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

function getProductTotalStock(p: PublicProduct, colors: StudioColorRow[]): number {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  if (variants.length > 0) {
    return variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);
  }
  if (colors.length > 0) {
    return colors.reduce((sum, c) => sum + Math.max(0, Number(c.stock) || 0), 0);
  }
  return Math.max(0, Number(p.stock) || 0);
}

function resolveImageIndexForColor(product: StudioRuntimeProduct, color: StudioColorRow | null | undefined): number {
  const images = Array.isArray(product.images) ? product.images : [];
  if (images.length === 0 || !color?.colorKey) return 0;
  const hints = COLOR_IMAGE_HINTS[color.colorKey] ?? [];
  if (hints.length === 0) return 0;
  const idx = images.findIndex((url) => {
    const normalized = decodeURIComponent(String(url || "")).toLowerCase();
    return hints.some((hint) => normalized.includes(hint));
  });
  return idx >= 0 ? idx : 0;
}

const ENGRAVE_MIN_PX = 8;
const ENGRAVE_MAX_PX = 44;

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
    { id: "engraving-1", text: "לנצח שלך", font: "heebo", size: 28, x: 0, y: 0, angle: 0 },
  ]);
  const engravingsRef = useRef(engravings);
  engravingsRef.current = engravings;
  const [activeEngravingId, setActiveEngravingId] = useState("engraving-1");
  const [customerImageDataUrl, setCustomerImageDataUrl] = useState<string | null>(null);
  const [isImageDropActive, setIsImageDropActive] = useState(false);
  const customerImageInputRef = useRef<HTMLInputElement | null>(null);
  const [galleryModalUrl, setGalleryModalUrl] = useState<string | null>(null);
  const [engraveFitError, setEngraveFitError] = useState<string | null>(null);
  const [showEngravingHelp, setShowEngravingHelp] = useState(false);
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [greetingCard] = useState(false);
  const [giftGreetingText, setGiftGreetingText] = useState("");
  const [showProductColorPicker, setShowProductColorPicker] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<null | { code: string; discountAmount: number; freeShipping: boolean }>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const [shippingId, setShippingId] = useState("home");
  const [paymentId, setPaymentId] = useState<"card" | "bit" | "paypal">("card");
  const checkoutPaymentOptions: Array<{ id: "card" | "bit" | "paypal"; label: string; enabled: boolean; soon?: boolean }> = [
    { id: "card", label: "כרטיס אשראי", enabled: true },
    { id: "bit", label: "Bit", enabled: false, soon: true },
    { id: "paypal", label: "PayPal", enabled: false, soon: true },
  ];
  const selectedPaymentMethod: "payplus" = "payplus";

  const [emojiPickerForId, setEmojiPickerForId] = useState<string | null>(null);
  const personalizationRef = useRef<HTMLDivElement | null>(null);
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

  function clampPercent(value: number) {
    return Math.max(-45, Math.min(45, value));
  }

  function addEngraving() {
    if (engravingsRef.current.length >= 3) return;
    const id = `engraving-${Date.now()}`;
    setEngravings((prev) => {
      const idx = prev.length;
      const y = clampPercent(-18 + idx * 12);
      const next = [...prev, { id, text: "", font: activeEngraving?.font ?? "heebo", size: activeEngraving?.size ?? 26, x: 0, y, angle: 0 }];
      queueMicrotask(() => setActiveEngravingId(id));
      return next;
    });
  }

  function appendEmojiToEngraving(id: string, emoji: string) {
    setEngravings((prev) =>
      prev.map((item) => (item.id === id ? { ...item, text: `${item.text ?? ""}${emoji}` } : item))
    );
    setActiveEngravingId(id);
    setEmojiPickerForId(null);
  }

  function removeEngraving(id: string) {
    setEngravings((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((x) => x.id === id);
      if (idx <= 0) return prev; // never remove the first/default row
      const next = prev.filter((x) => x.id !== id);
      const fallback = next[Math.min(idx - 1, next.length - 1)]?.id ?? next[0]?.id ?? "engraving-1";
      queueMicrotask(() => setActiveEngravingId(fallback));
      return next;
    });
    setEmojiPickerForId((prev) => (prev === id ? null : prev));
  }

  function onEmojiPicked(id: string, emojiData: EmojiClickData) {
    appendEmojiToEngraving(id, emojiData.emoji);
  }

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
            totalStock: getProductTotalStock(p, colors),
            allowCustomerImageUpload: Boolean(p.allowCustomerImageUpload),
            lowThreshold: typeof p.lowThreshold === "number" ? p.lowThreshold : 5,
          };
        });
        if (!mounted) return;
        const uniqueProducts = Array.from(new Map(mapped.map((p) => [p.id, p])).values());
        setRuntimeProducts(uniqueProducts);
        setSelectedColorByProduct(Object.fromEntries(uniqueProducts.map((p) => [p.id, 0])));
        if (uniqueProducts.length > 0) {
          setProductId((prev) => (prev && uniqueProducts.some((p) => p.id === prev) ? prev : uniqueProducts[0].id));
        }
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

  const galleryUrls = activeProduct?.images?.length ? activeProduct.images : activeProduct?.image ? [activeProduct.image] : [];
  /** תמונת הרקע בתוך מודל החריטה — תמיד התמונה הראשית; שאר התמונות נצפות בגלריה למטה ובפופאפ בלבד. */
  const engraveStageImageUrl = galleryUrls[selectedGalleryIndex] ?? galleryUrls[0] ?? activeProduct?.image ?? null;
  const engravingPreviewText = useMemo(
    () => engravings.map((item) => item.text.trim()).filter(Boolean).slice(0, 3).join("\n"),
    [engravings]
  );

  useEffect(() => {
    setSelectedGalleryIndex(0);
  }, [activeProduct?.id]);

  useEffect(() => {
    if (!activeProduct || !activeColor) return;
    const imageIdx = resolveImageIndexForColor(activeProduct, activeColor);
    setSelectedGalleryIndex((prev) => (prev === imageIdx ? prev : imageIdx));
  }, [activeProduct, activeColor]);

  useEffect(() => {
    const onDocPointerDown = (event: PointerEvent) => {
      if (!showProductColorPicker) return;
      const root = personalizationRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setShowProductColorPicker(false);
      }
    };
    window.addEventListener("pointerdown", onDocPointerDown);
    return () => window.removeEventListener("pointerdown", onDocPointerDown);
  }, [showProductColorPicker]);

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
    const byTab = runtimeProducts.filter((p) => {
      return tabMatchesMainCategoryId
        ? p.mainCategoryId === category
        : category === p.category || normalizeCategoryKey(p.category) === normalizedTab;
    });

    const final = byTab.filter((p) => {
      // "couple" tab is explicit: only couple-audience products belong here.
      if (normalizedTab === "couple") return p.subcategory === "couple";
      // For bracelets/necklaces we used to drop products with a null audience, which
      // hid every seeded row that had no CategoryProduct link to a men/women sub-category.
      // Keep them: the `groupedProducts` memo already routes null-audience rows into
      // the `others` bucket so they remain visible under the tab.
      return true;
    });

    return final;
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
      const cartSubtotalAgorot = Math.round(subtotal * 100);
      const res = await fetch(`${apiBase}/api/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code,
          cartSubtotal: cartSubtotalAgorot,
          itemsQuantity: qty,
          customerEmail: null
        })
      });
      const data = await res.json();
      if (data.ok) {
        setAppliedCoupon({
          code: data.code,
          // API returns agorot; UI totals are in shekels.
          discountAmount: Number(data.discountAmount ?? 0) / 100,
          freeShipping: Boolean(data.freeShipping),
        });
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
        const extrasNote = [
          giftWrap ? "אריזת מתנה: כן" : null,
          greetingCard ? "כרטיס ברכה: כן" : null,
          giftWrap && giftGreetingText.trim() ? `ברכה למתנה: ${giftGreetingText.trim()}` : null,
        ]
          .filter(Boolean)
          .join(" | ");
        const mergedOrderNotes = [notes.trim(), extrasNote].filter(Boolean).join(" | ") || null;
        const res = await fetch(`${apiBase}/api/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            customer,
            shippingFee: effectiveShippingFee,
            shippingMethodId: shippingId,
            orderNotes: mergedOrderNotes,
            couponCode: appliedCoupon?.code || null,
            paymentMethod: customer.paymentMethod ?? "payplus",
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
        let data: {
          ok?: boolean;
          paymentMethod?: string;
          paymentUrl?: string | null;
          paymentStatus?: string;
          order?: { orderNumber?: string; paymentUrl?: string | null; paymentMethod?: string };
          message?: string;
          hint?: string;
        } = {};
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
        // PayPlus: redirect to the hosted payment page before showing the
        // success screen. The order is persisted with paymentStatus=pending and
        // the webhook finalizes it once PayPlus confirms.
        if (customer.paymentMethod === "payplus") {
          const paymentUrl = data.paymentUrl ?? data.order?.paymentUrl ?? null;
          if (!paymentUrl) {
            setCouponMsg("לא ניתן היה לאתחל את התשלום. נא לנסות שוב.");
            return;
          }
          setCouponMsg("מעביר אותך לתשלום...");
          window.location.href = paymentUrl;
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
      customerImageDataUrl,
      notes,
      shippingId,
      giftWrap,
      greetingCard,
      giftGreetingText
    ]
  );

  const goNext = () => setStep((s) => Math.min(3, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));
  const selectProductAndGoDesign = (id: string) => {
    const p = runtimeProducts.find((x) => x.id === id);
    if (!p || p.totalStock <= 0) return;
    setProductId(id);
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function handleCustomerImageFile(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCouponMsg("ניתן להעלות קובץ תמונה בלבד");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCustomerImageDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  const renderProductCard = (product: StudioRuntimeProduct) => {
    const outOfStock = product.totalStock <= 0;
    const lowStock = !outOfStock && product.totalStock <= product.lowThreshold;
    const selectedIndex = selectedColorByProduct[product.id] ?? 0;
    const selectedColor = product.colors[selectedIndex] ?? product.colors[0] ?? null;
    const colorImageIndex = resolveImageIndexForColor(product, selectedColor);
    const previewImage =
      product.images[colorImageIndex] ??
      product.images[selectedIndex] ??
      product.images[0] ??
      product.image ??
      null;
    return (
      <article
        key={product.id}
        className={`studio-product-card ${productId === product.id ? "selected" : ""} ${outOfStock ? "out-of-stock" : ""}`}
        aria-disabled={outOfStock}
      >
        <span className="studio-product-category-label">{categoryLabelById[product.category] ?? "קטגוריה"}</span>
        <div className={`studio-product-thumb ${product.category}`}>
          {previewImage ? (
            <img
              src={previewImage}
              alt={product.title}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
          {outOfStock ? <span className="studio-stock-badge studio-stock-badge--overlay">אזל מהמלאי</span> : null}
          {lowStock ? (
            <span className="studio-stock-badge studio-stock-badge--low studio-stock-badge--overlay studio-stock-badge--overlay-low">מלאי מוגבל</span>
          ) : null}
        </div>
        <h3>{product.title}</h3>
        <strong className="studio-product-price">{shekel(product.price)}</strong>
        <div className="studio-swatch-row">
          {product.colors.map((color, index) => (
            <button
              key={`${product.id}-${color.name}-${index}`}
              type="button"
              className={`studio-color-swatch ${index === selectedIndex ? "active" : ""}`}
              style={{ ["--swatch" as string]: color.swatch, opacity: color.stock > 0 ? 1 : 0.35 }}
              aria-label={color.name}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedColorByProduct((prev) => ({ ...prev, [product.id]: index }));
              }}
            />
          ))}
        </div>
        <button
          type="button"
          className="studio-select-btn"
          disabled={outOfStock}
          onClick={() => selectProductAndGoDesign(product.id)}
        >
          בחר
        </button>
      </article>
    );
  };

  return (
    <div className="studio-shell" dir="rtl">
      <header className="studio-topbar">
        <div className="studio-top-actions">
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
            {loadingProducts
              ? Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`studio-skeleton-${idx}`} className="studio-product-card studio-product-card--skeleton" />
                ))
              : null}
            {!loadingProducts && filteredProducts.length === 0 ? <p>אין מוצרים זמינים כרגע בקטגוריה זו.</p> : null}
            {isGroupedMenWomenCouple && groupedProducts.men.length > 0 ? (
              <>
                <div className="studio-subsection-title">גברים</div>
                {groupedProducts.men.map(renderProductCard)}
              </>
            ) : null}
            {isGroupedMenWomenCouple && groupedProducts.women.length > 0 ? (
              <>
                <div className="studio-subsection-divider" />
                <div className="studio-subsection-title">נשים</div>
                {groupedProducts.women.map(renderProductCard)}
              </>
            ) : null}
            {isGroupedMenWomenCouple && groupedProducts.couple.length > 0 ? (
              <>
                <div className="studio-subsection-divider" />
                <div className="studio-subsection-title">זוגיים</div>
                {groupedProducts.couple.map(renderProductCard)}
              </>
            ) : null}
            {(!isGroupedMenWomenCouple ? filteredProducts : groupedProducts.others).map(renderProductCard)}
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
              <div>
                <div className="studio-engraving-title-row">
                  <div className="studio-field-hint">טקסט לחריטה</div>
                  <div className="studio-engraving-title-actions">
                    <span className="studio-engraving-counter" aria-live="polite">
                      {engravings.length}/3
                    </span>
                    <button
                      type="button"
                      className="studio-icon-btn studio-icon-btn--add"
                      aria-label="הוסף שדה טקסט"
                      title="הוסף שדה טקסט"
                      onClick={addEngraving}
                      disabled={engravings.length >= 3}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="studio-engraving-input-list">
                  {engravings.map((item, idx) => (
                    <div key={item.id} className={`studio-engraving-input-wrap ${activeEngravingId === item.id ? "active" : ""}`}>
                      <textarea
                        className="studio-engraving-input studio-engraving-input--multiline"
                        value={item.text}
                        rows={2}
                        placeholder="הכנס טקסט לחריטה"
                        onFocus={() => setActiveEngravingId(item.id)}
                        onChange={(e) => {
                          setEngraveFitError(null);
                          updateEngraving(item.id, { text: e.target.value });
                        }}
                      />
                      <button
                        type="button"
                        className="studio-icon-btn studio-icon-btn--emoji-corner"
                        aria-label="בחר אימוגי"
                        title="בחר אימוגי"
                        onClick={() => setEmojiPickerForId((prev) => (prev === item.id ? null : item.id))}
                      >
                        <Smile size={12} />
                      </button>
                      {idx > 0 ? (
                        <button
                          type="button"
                          className="studio-icon-btn studio-icon-btn--trash-corner"
                          aria-label="מחק שדה טקסט"
                          title="מחק שדה טקסט"
                          onClick={() => removeEngraving(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                      {emojiPickerForId === item.id ? (
                        <div className="studio-emoji-popover studio-emoji-popover--full">
                          <EmojiPicker
                            onEmojiClick={(emojiData) => onEmojiPicked(item.id, emojiData)}
                            lazyLoadEmojis
                            autoFocusSearch={false}
                            skinTonesDisabled={false}
                            width={320}
                            height={360}
                            searchDisabled={false}
                            previewConfig={{ showPreview: false }}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {engraveFitError ? (
                  <p className="studio-engrave-fit-error" role="alert">
                    {engraveFitError}
                  </p>
                ) : null}
              </div>
              <div className="studio-personalization-row" aria-label="התאמה אישית" ref={personalizationRef}>
                <div className={`studio-personalization-tile studio-personalization-tile--font ${activeEngraving ? "is-active" : ""}`}>
                  <div className="studio-personalization-label">פונט</div>
                  <div className="studio-personalization-control studio-personalization-control--font">
                    <select
                      className="studio-personalization-select"
                      value={activeEngraving?.font ?? "heebo"}
                      style={{ fontFamily: FONT_FAMILY_BY_ID[activeEngraving?.font ?? "heebo"] ?? '"Heebo", sans-serif' }}
                      onChange={(e) => {
                        setEngraveFitError(null);
                        activeEngraving && updateEngraving(activeEngraving.id, { font: e.target.value });
                      }}
                    >
                      {studioFonts.map((f) => (
                        <option key={f.id} value={f.id} style={{ fontFamily: FONT_FAMILY_BY_ID[f.id] ?? '"Heebo", sans-serif' }}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="studio-font-chevron" aria-hidden />
                  </div>
                </div>

                <div
                  className={`studio-personalization-tile studio-personalization-tile--color ${showProductColorPicker ? "is-active" : ""}`}
                  style={{
                    position: "relative",
                    ["--selected-color" as string]: activeColor?.swatch ?? "#d4af37",
                  }}
                >
                  <button
                    type="button"
                    className="studio-personalization-btn"
                    onClick={() => setShowProductColorPicker((v) => !v)}
                    aria-label="בחירת צבע מוצר"
                    title="בחירת צבע מוצר"
                  >
                    <Palette size={16} />
                    <span className="studio-personalization-label">צבע</span>
                    <span
                      className="studio-personalization-dot studio-personalization-dot--large"
                      style={{ background: activeColor?.swatch ?? "linear-gradient(135deg,#111827,#d4af37)" }}
                      aria-hidden
                    />
                    <span className="studio-personalization-value">{activeColor?.name ?? "בחר צבע"}</span>
                  </button>
                  {showProductColorPicker && activeProduct ? (
                    <div className="studio-color-popover" role="dialog" aria-label="בחירת צבע מוצר">
                      <div className="studio-color-swatches">
                        {activeProduct.colors.map((c, i) => (
                          <button
                            key={`${activeProduct.id}-tile-color-${i}`}
                            type="button"
                            className={`studio-product-color-option ${i === (selectedColorByProduct[activeProduct.id] ?? 0) ? "active" : ""}`}
                            onClick={() => {
                              setSelectedColorByProduct((prev) => ({ ...prev, [activeProduct.id]: i }));
                              setShowProductColorPicker(false);
                            }}
                            aria-label={`בחר צבע ${c.name}`}
                            title={c.name}
                            style={{ ["--option-color" as string]: c.swatch }}
                          >
                            <span className="studio-product-color-option-dot" aria-hidden />
                            <span className="studio-product-color-option-label">{c.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={`studio-personalization-tile studio-personalization-tile--size ${activeEngraving ? "is-active" : ""}`}>
                  <div className="studio-personalization-size-head">
                    <span className="studio-personalization-label">גודל טקסט</span>
                    <span className="studio-size-value">{Math.round(activeEngraving?.size ?? 26)}px</span>
                  </div>
                  <div className="studio-size-controls">
                    <input
                      type="range"
                      min={ENGRAVE_MIN_PX}
                      max={ENGRAVE_MAX_PX}
                      step={1}
                      value={Math.round(activeEngraving?.size ?? 26)}
                      onChange={(e) => {
                        if (!activeEngraving) return;
                        setEngraveFitError(null);
                        const next = Math.min(ENGRAVE_MAX_PX, Math.max(ENGRAVE_MIN_PX, Number(e.target.value) || ENGRAVE_MIN_PX));
                        updateEngraving(activeEngraving.id, { size: next });
                      }}
                      className="studio-size-range"
                      aria-label="גודל טקסט"
                    />
                    <input
                      type="number"
                      min={ENGRAVE_MIN_PX}
                      max={ENGRAVE_MAX_PX}
                      step={1}
                      value={Math.round(activeEngraving?.size ?? 26)}
                      onChange={(e) => {
                        if (!activeEngraving) return;
                        setEngraveFitError(null);
                        const raw = Number(e.target.value);
                        const next = Number.isFinite(raw) ? Math.min(ENGRAVE_MAX_PX, Math.max(ENGRAVE_MIN_PX, raw)) : ENGRAVE_MIN_PX;
                        updateEngraving(activeEngraving.id, { size: next });
                      }}
                      className="studio-size-input"
                      aria-label="הקלדת גודל טקסט"
                    />
                  </div>
                </div>

                <div className={`studio-personalization-tile studio-personalization-tile--gift ${giftWrap ? "is-active" : ""}`}>
                  <button
                    type="button"
                    className="studio-personalization-btn studio-personalization-btn--gift"
                    onClick={() => setGiftWrap((prev) => !prev)}
                    aria-label="אריזת מתנה"
                    title="אריזת מתנה"
                  >
                    <span className="studio-gift-head-row">
                      <span className="studio-gift-head">
                        <Gift size={15} aria-hidden />
                        <span className="studio-personalization-label">אריזת מתנה</span>
                      </span>
                      <span className="studio-personalization-value studio-gift-state">{giftWrap ? "פעיל" : "כבוי"}</span>
                    </span>
                  </button>
                  <div className={`studio-gift-reveal-inline ${giftWrap ? "open" : ""}`} aria-hidden={!giftWrap}>
                    {giftWrap ? (
                      <textarea
                        className="studio-gift-note-input"
                        value={giftGreetingText}
                        maxLength={140}
                        rows={2}
                        placeholder="כתוב הקדשה קצרה למתנה..."
                        onChange={(e) => setGiftGreetingText(e.target.value)}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
              {activeProduct?.allowCustomerImageUpload ? (
                <div className="studio-customer-photo-block">
                  <div className="studio-field-hint">תמונה אישית</div>
                  <input
                    ref={customerImageInputRef}
                    type="file"
                    accept="image/*"
                    className="visually-hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      handleCustomerImageFile(f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className={`studio-upload-dropzone ${isImageDropActive ? "is-dragging" : ""}`}
                    onClick={() => customerImageInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsImageDropActive(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsImageDropActive(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsImageDropActive(false);
                      const f = e.dataTransfer?.files?.[0] ?? null;
                      handleCustomerImageFile(f);
                    }}
                  >
                    <strong>{customerImageDataUrl ? "התמונה נטענה בהצלחה" : "גרור תמונה לכאן"}</strong>
                    <span>{customerImageDataUrl ? "אפשר לגרור תמונה אחרת או ללחוץ להחלפה" : "PNG, JPG, JPEG עד 10MB"}</span>
                  </button>
                  <div className="studio-customer-photo-actions">
                    {customerImageDataUrl ? (
                      <button type="button" className="studio-chip light" onClick={() => setGalleryModalUrl(customerImageDataUrl)} title="תצוגה מקדימה" aria-label="תצוגה מקדימה">
                        <Eye size={14} />
                      </button>
                    ) : null}
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
              <div className="studio-preview-mockup-block">
                <button
                  type="button"
                  className="studio-help-btn studio-help-btn--mockup-corner"
                  aria-label="עזרה בבחירת טקסט"
                  title="עזרה בבחירת טקסט"
                  onClick={() => setShowEngravingHelp((v) => !v)}
                >
                  ?
                </button>
                {showEngravingHelp ? (
                  <div className="studio-engraving-help-pop studio-engraving-help-pop--mockup">
                    רעיונות לחריטה: שמות בני זוג, תאריך מיוחד, מילה קצרה עם משמעות, או אימוג׳י קטן שמוסיף טאץ׳ אישי.
                  </div>
                ) : null}
                <div className="studio-preview-stage">
                  <Pendant3DPreview
                    metalColor={activeColor?.swatch ?? "#d4af37"}
                    engravingText={engravingPreviewText}
                    fallbackImageUrl={engraveStageImageUrl}
                    modelUrl="/models/pendant.glb"
                    autoRotate
                  />
                </div>
                {galleryUrls.length > 0 ? (
                  <div className="studio-gallery-carousel" aria-label="גלריית תמונות המוצר">
                    <button
                      type="button"
                      className="studio-gallery-nav"
                      onClick={() => setSelectedGalleryIndex((prev) => (prev <= 0 ? galleryUrls.length - 1 : prev - 1))}
                      aria-label="תמונה קודמת"
                    >
                      ‹
                    </button>
                    <div className="studio-subgallery" role="list">
                      {galleryUrls.map((url, idx) => (
                        <button
                          key={`${url}-${idx}`}
                          type="button"
                          className={`studio-subgallery-thumb ${selectedGalleryIndex === idx ? "active" : ""}`}
                          onClick={() => {
                            setSelectedGalleryIndex(idx);
                            setGalleryModalUrl((prev) => (prev === url ? null : url));
                          }}
                          aria-label={galleryUrls.length > 1 ? `פתיחת תמונה ${idx + 1} בגודל מלא` : "פתיחת תמונה בגודל מלא"}
                        >
                          <img
                            src={url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="studio-gallery-nav"
                      onClick={() => setSelectedGalleryIndex((prev) => (prev >= galleryUrls.length - 1 ? 0 : prev + 1))}
                      aria-label="תמונה הבאה"
                    >
                      ›
                    </button>
                  </div>
                ) : null}
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
                paymentMethod={selectedPaymentMethod}
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
                    {"detail" in method && method.detail ? (
                      <span className="studio-ship-card-detail">{method.detail}</span>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="studio-pay-row">
                {checkoutPaymentOptions.map((payment) => (
                  <button
                    type="button"
                    key={payment.id}
                    className={`studio-chip ${paymentId === payment.id ? "active" : ""}`}
                    onClick={() => {
                      if (!payment.enabled) return;
                      setPaymentId(payment.id);
                    }}
                    disabled={!payment.enabled}
                    aria-disabled={!payment.enabled}
                  >
                    {payment.label}
                    {!payment.enabled && payment.soon ? " (בקרוב)" : ""}
                  </button>
                ))}
              </div>
            </div>
            <aside className="studio-order-summary">
              <h3>סיכום הזמנה</h3>
              <div className="studio-summary-product-head">
                {activeProduct?.image ? (
                  <img
                    src={activeProduct.image}
                    alt={activeProduct.title}
                    className="studio-summary-thumb"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="studio-summary-thumb studio-summary-thumb--placeholder">אין תמונה</div>
                )}
                <div className="studio-summary-title-block">
                  <strong className="studio-summary-product-title">{activeProduct?.title ?? "מוצר לא נבחר"}</strong>
                  {activeColor ? <span className="studio-summary-subtitle">{activeColor.name}</span> : null}
                </div>
                <div className="studio-summary-rows studio-summary-rows--inline">
                  <div className="studio-summary-row">
                    <span>כמות</span>
                    <strong>{qty}</strong>
                  </div>
                  {activeColor ? (
                    <div className="studio-summary-row">
                      <span>צבע</span>
                      <strong>{activeColor.name}</strong>
                    </div>
                  ) : null}
                  {activeColor?.material ? (
                    <div className="studio-summary-row">
                      <span>חומר</span>
                      <strong>{activeColor.material}</strong>
                    </div>
                  ) : null}
                  {activeColor?.pendantType ? (
                    <div className="studio-summary-row">
                      <span>סוג תליון</span>
                      <strong>{activeColor.pendantType}</strong>
                    </div>
                  ) : null}
                  <div className="studio-summary-row">
                    <span>משלוח</span>
                    <strong>{effectiveShippingFee === 0 ? `${shipping.label} (ללא עלות)` : shipping.label}</strong>
                  </div>
                </div>
              </div>

              {engravingSummary || notes.trim() ? (
                <div className="studio-summary-section">
                  <div className="studio-summary-section-title">התאמה אישית</div>
                  <div className="studio-summary-rows">
                    {customerImageDataUrl ? (
                      <div className="studio-summary-row studio-summary-row--stack">
                        <span>תמונה אישית</span>
                        <img
                          src={customerImageDataUrl}
                          alt="תמונה אישית שהועלתה"
                          className="studio-summary-customer-image"
                          onClick={() => setGalleryModalUrl(customerImageDataUrl)}
                        />
                      </div>
                    ) : null}
                    {engravingSummary ? (
                      <div className="studio-summary-row studio-summary-row--stack">
                        <span>חריטה</span>
                        <strong>{engravingSummary}</strong>
                      </div>
                    ) : null}
                    {notes.trim() ? (
                      <div className="studio-summary-row studio-summary-row--stack">
                        <span>הערות</span>
                        <strong>{notes.trim()}</strong>
                      </div>
                    ) : null}
                    {giftWrap ? (
                      <div className="studio-summary-row">
                        <span>אריזת מתנה</span>
                        <strong>כן</strong>
                      </div>
                    ) : null}
                    {greetingCard ? (
                      <div className="studio-summary-row">
                        <span>כרטיס ברכה</span>
                        <strong>כן</strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {!canPurchase ? <p style={{ color: "#b42318", fontWeight: 700 }}>אזל מהמלאי - לא ניתן להשלים הזמנה</p> : null}
              {activeColor && qty > activeColor.stock ? (
                <p style={{ color: "#b42318", fontWeight: 700 }}>הכמות גבוהה מהמלאי הזמין</p>
              ) : null}
              <div className="studio-summary-pricing">
                <div className="studio-summary-row">
                  <span>מחיר פריט</span>
                  <strong>{shekel(activeColor?.price ?? activeProduct?.price ?? 0)}</strong>
                </div>
                <div className="studio-summary-row">
                  <span>ביניים</span>
                  <strong>{shekel(subtotal)}</strong>
                </div>
                <div className="studio-summary-row">
                  <span>משלוח</span>
                  <strong>{effectiveShippingFee === 0 ? "משלוח חינם" : shekel(effectiveShippingFee)}</strong>
                </div>
                {appliedCoupon ? (
                  <div className="studio-summary-row">
                    <span>הנחה ({appliedCoupon.code})</span>
                    <strong>-{shekel(discount)}</strong>
                  </div>
                ) : null}
                <div className="studio-summary-row studio-summary-row--total">
                  <span>סה"כ לתשלום</span>
                  <strong>{shekel(total)}</strong>
                </div>
              </div>

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
