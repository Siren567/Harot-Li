import {
  STUDIO_STEPS,
  PRODUCT_CATEGORIES,
  PRODUCT_ITEMS,
  PENDANT_SHAPE_OPTIONS,
  FONT_OPTIONS,
  MATERIAL_OPTIONS,
  STUDIO_VARIANT_BY_KEY,
  ICON_OPTIONS,
  SHIPPING_METHODS,
  PAYMENT_METHOD_OPTIONS,
} from "./studio-data.js";
import { formatShekelDisplay as formatPrice } from "./price-display.js";
import { appendStudioDemoOrder, studioCustomerId, STUDIO_DEMO_ORDERS_KEY } from "./studio-demo-sync.js";
import { initMarketingBeacon, trackProductView } from "./marketing-beacon.js";
import { playOrderAnimation } from "./order-animation.js";

let runtimeCategories = [...PRODUCT_CATEGORIES];
let runtimeItems = [];

const DEFAULT_STUDIO_COLOR_KEYS = ["gold", "silver", "rose", "black"];

function toStudioCategoryId(rawSlug = "", rawName = "") {
  const slug = String(rawSlug).toLowerCase();
  const name = String(rawName).toLowerCase();
  if (slug.includes("bracelet") || name.includes("צמיד")) return "bracelets";
  if (slug.includes("key") || name.includes("מחזיק")) return "keychains";
  if (slug.includes("necklace") || name.includes("שרשר")) return "necklaces";
  return "other";
}

function isGenderSubcategoryLabel(rawValue = "") {
  const v = String(rawValue).trim().toLowerCase();
  if (!v) return false;
  return (
    v === "גברים" ||
    v === "גבר" ||
    v === "men" ||
    v === "man" ||
    v === "male" ||
    v === "נשים" ||
    v === "אישה" ||
    v === "אשה" ||
    v === "woman" ||
    v === "women" ||
    v === "female"
  );
}

function buildVariantsFromColors(colorKeys, imageUrls, fallbackImage) {
  const keys =
    colorKeys?.length > 0
      ? colorKeys.filter((k) => STUDIO_VARIANT_BY_KEY[k])
      : [...DEFAULT_STUDIO_COLOR_KEYS];
  const urls = imageUrls?.length ? imageUrls : fallbackImage ? [fallbackImage] : [];
  const img0 = urls[0] || fallbackImage || "";
  return keys.map((k, i) => ({
    ...STUDIO_VARIANT_BY_KEY[k],
    image: urls[i % Math.max(urls.length, 1)] || img0,
  }));
}

function enrichMockCatalogItem(p) {
  const fromVariants = [...new Set(p.variants.map((v) => v.image).filter(Boolean))];
  const imageUrls = p.imageUrls?.length ? [...p.imageUrls] : fromVariants;
  return { ...p, imageUrls };
}

function buildApiBases() {
  const host = (window.location.hostname || "localhost").toLowerCase();
  const origin = window.location.origin || "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) {
    return ["", origin, "http://localhost:4000", "http://localhost:4444", `http://${host}:4444`, `http://${host}:3000`];
  }
  const canonical = "https://www.harot-li.store/_/backend";
  const onHarot = host === "www.harot-li.store" || host === "harot-li.store";
  // Same-origin /api and /_/backend first; absolute www last (CORS-safe with credentials omitted in callers if needed).
  if (onHarot) return ["", "/_/backend", `${origin}/_/backend`, canonical];
  return ["/_/backend", canonical];
}

/** +972 55-943-3968 — ברירת מחדל לסטודיו; ה־API יכול לדרוס אם מוגדר בפאנל */
const DEFAULT_STUDIO_WHATSAPP = "972559433968";

async function fetchWithTimeout(url, options = {}, ms = 5000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { credentials: "omit", ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function postJsonBases(path, jsonBody) {
  for (const base of buildApiBases()) {
    try {
      const res = await fetchWithTimeout(
        `${base}${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(jsonBody),
        },
        8000
      );
      const j = await res.json().catch(() => ({}));
      if (res.ok) return j;
      return { ok: false, error: j.error || String(res.status) };
    } catch {
      /* try next base */
    }
  }
  return null;
}

function clearCouponOnCartChange() {
  if (state.couponApplied) {
    state.couponApplied = null;
    renderCouponBox();
  }
}

function renderCouponBox() {
  if (!couponBoxEl) return;
  const a = state.couponApplied;
  if (a) {
    couponBoxEl.innerHTML = `<div class="coupon-row-inner coupon-applied">
      <span>קופון <strong>${escHtml(a.code)}</strong> · הנחה ${formatPrice(a.discount)}</span>
      <button type="button" class="btn secondary" data-action="remove-coupon">הסר</button>
    </div>`;
  } else {
    couponBoxEl.innerHTML = `<div class="coupon-row-inner">
      <input type="text" id="couponCodeInput" placeholder="הזן קוד קופון" dir="ltr" autocomplete="off" style="text-transform:uppercase" />
      <button type="button" class="btn primary" data-action="apply-coupon">החל קופון</button>
    </div>
    <p id="couponErr" style="font-size:11px;margin-top:6px;color:#b91c1c;min-height:14px"></p>`;
  }
}

async function applyCouponFromUi() {
  const input = document.getElementById("couponCodeInput");
  const errEl = document.getElementById("couponErr");
  const code = (input?.value || "").trim();
  if (!code) {
    if (errEl) errEl.textContent = "הזן קוד קופון";
    return;
  }
  const product = currentProduct();
  if (!product) return;
  const subtotal = product.price * state.customization.qty;
  const res = await postJsonBases("/api/public/validate-coupon", { code, subtotal });
  if (!res?.ok) {
    if (errEl) errEl.textContent = res?.error || "לא ניתן לאמת את הקופון";
    return;
  }
  if (errEl) errEl.textContent = "";
  state.couponApplied = {
    id: res.coupon_id,
    code: res.coupon_code,
    discount: Number(res.discount_amount) || 0,
  };
  renderCouponBox();
  updatePricingUI();
}

function removeCoupon() {
  state.couponApplied = null;
  renderCouponBox();
  updatePricingUI();
}

async function loadProductsFromDatabase() {
  async function loadRuntimeCategoriesFromApi() {
    const bases = buildApiBases();
    for (const base of bases) {
      try {
        const res = await fetchWithTimeout(`${base}/api/categories/tree`, { headers: { Accept: "application/json" } }, 6000);
        if (!res.ok) continue;
        const json = await res.json();
        const mains = Array.isArray(json?.categories) ? json.categories : [];
        const fromApi = mains
          .filter((c) => !c?.parentId && !c?.parent_id)
          .map((c) => ({
            id: String(c.id || "").trim() || toStudioCategoryId(c.slug || "", c.name || ""),
            title: String(c.name || "").trim(),
            useSubcategories: Array.isArray(c.subcategories) ? c.subcategories.length > 0 : false,
            studioCategoryKey: toStudioCategoryId(c.slug || "", c.name || ""),
          }))
          .filter((c) => c.title)
          .filter((c) => !isGenderSubcategoryLabel(c.title));
        if (fromApi.length) return fromApi;
      } catch {
        // try next base
      }
    }
    return [];
  }

  const dynamicCategories = await loadRuntimeCategoriesFromApi();
  if (dynamicCategories.length) runtimeCategories = dynamicCategories;

  const bases = buildApiBases();
  let rows = [];

  for (const base of bases) {
    try {
      const res = await fetchWithTimeout(`${base}/api/public/products`, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const json = await res.json();
      rows = Array.isArray(json?.products) ? json.products : [];
      if (rows.length > 0) break;
    } catch {
      // try next candidate
    }
  }

  if (!rows.length) {
    // No demo fallback: studio shows only real DB products.
    runtimeItems = [];
    if (!runtimeCategories.length) runtimeCategories = [...PRODUCT_CATEGORIES];
    return;
  }

  const mapped = rows
    .filter((p) => p?.id && p?.name)
    .map((p) => {
      const studioCategoryKey = p.studioCategory || toStudioCategoryId(p.categorySlug || "", p.categoryName || "");
      const category = String(p.mainCategoryId || "").trim() || studioCategoryKey;
      const explicitSubcategories = Array.isArray(p.subcategoryLabels)
        ? p.subcategoryLabels.map((x) => String(x || "").trim()).filter(Boolean)
        : [];
      const forcedSubcategory =
        String(p?.name || "").includes("פרח")
          ? "נשים"
          : p.subcategoryLabel ?? p.subcategoryName ?? p.categoryName ?? null;
      const normalizedSubcategories = explicitSubcategories.length
        ? explicitSubcategories
        : forcedSubcategory
          ? [String(forcedSubcategory).trim()]
          : [];
      const imgs = Array.isArray(p.images) && p.images.length ? p.images : p.image ? [p.image] : [];
      const fallback =
        p.image ||
        "https://images.pexels.com/photos/10983791/pexels-photo-10983791.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop";
      const variants = buildVariantsFromColors(p.studioColors, imgs, fallback);
      return {
        id: p.id,
        category,
        studioCategoryKey,
        subcategory: normalizedSubcategories[0] || null,
        subcategories: normalizedSubcategories,
        pendantShape: p.pendantShape || p.pendant_shape || p.studioPendantShape || null,
        title: p.name,
        description: p.description || "",
        price: Number(p.price) || 0,
        allowCustomerImageUpload: !!p.allowCustomerImageUpload,
        imageUrls: imgs.length ? imgs : [fallback],
        variants: variants.length ? variants : [{ color: "ברירת מחדל", swatch: "#D4AF37", image: fallback }],
      };
    });

  runtimeItems = mapped;
  if (!runtimeCategories.length) runtimeCategories = [...PRODUCT_CATEGORIES];
}

const state = {
  step: 0,
  selectedProductId: "",
  activeCategoryId: "",
  activeSubcategory: "",
  userPickedCategory: false,
  previewGalleryIndex: 0,
  whatsappPhone: "",
  previewAngle: "front",
  zoom: 1,
  rotate: 0,
  dragRotateY: 0,
  dragRotateX: 0,
  processing: false,
  selectionTimer: null,
  typingTimer: null,
  emojiPickerTargetId: null,
  draftText: "באהבה גדולה",
  previewMode: "after",
  pendantShapeOverride: "",
  savedDesignAt: "",
  lastTotal: null,
  customization: {
    text: "באהבה גדולה",
    textBlocks: [{ id: "t1", text: "באהבה גדולה" }],
    emojiBlocks: [{ id: "e1", symbol: ICON_OPTIONS[0] }],
    fontId: FONT_OPTIONS[0].id,
    size: 28,
    position: "center",
    align: "center",
    materialId: MATERIAL_OPTIONS[0].id,
    qty: 1,
    notes: "",
    customerUpload: null,
    giftMode: false,
    giftNote: "",
    giftCardStyle: "classic",
    textRotation: 0,
    previewOffsets: { e1: { xPct: 26, yPct: 26 }, t1: { xPct: 50, yPct: 50 } },
  },
  /** מספר הזמנה קבוע אחרי תשלום דמה — לתצוגה ול־localStorage */
  placedOrderNumber: null,
  /** { id, code, discount } אחרי אימות מול השרת */
  couponApplied: null,
  checkout: {
    fullName: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    house: "",
    aptFloor: "",
    zip: "",
    deliveryNotes: "",
    shippingId: SHIPPING_METHODS[0].id,
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    paymentMethod: "card",
  },
  checkoutErrors: {},
  checkoutGlobalError: "",
  selectedVariantByProduct: Object.fromEntries(runtimeItems.map((p) => [p.id, 0])),
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const steps = $$("[data-step]");

const progressEl = $("#progress");
const categoryChipsEl = $("#categoryChips");
const catalogSectionsEl = $("#catalogSections");
const mockProductEl = $("#mockProduct");
const mockEngraveSurfaceEl = $("#mockEngraveSurface");
const orderSummaryEl = $("#orderSummary");
const finalSummaryEl = $("#finalSummary");
const flowNav = $("#flowNav");
const nextBtn = document.querySelector('.app-shell [data-action="next"]');
const backBtn = document.querySelector('.app-shell [data-action="back"]');

const fontSelect = $("#fontSelect");
const textSize = $("#textSize");
const qtyInput = $("#qtyInput");
const notesInput = $("#notesInput");
const customerUploadBoxEl = $("#customerUploadBox");
const previewGalleryEl = $("#previewGallery");
const studioWhatsappBtn = $("#studioWhatsappBtn");
const stageEl = document.querySelector(".stage");
const textBlocksEl = $("#textBlocks");
const emojiBlocksEl = $("#emojiBlocks");
const addTextBlockBtn = $("#addTextBlock");
const addEmojiBlockBtn = $("#addEmojiBlock");
const emojiPickerEl = $("#emojiPicker");
const walletMenuTrigger = $("#walletMenuTrigger");
const walletMenu = $("#walletMenu");
const walletTriggerInner = $("#walletTriggerInner");
const cardFieldsGrid = $("#cardFieldsGrid");
const walletMockHint = $("#walletMockHint");
const couponBoxEl = $("#couponBox");
const orderStatusLookupToggleBtn = $("#orderStatusLookupToggle");
const orderStatusLookupFooterBtn = $("#orderStatusLookupFooterBtn");
const orderStatusLookupPanel = $("#orderStatusLookupPanel");
const orderStatusLookupInput = $("#orderStatusLookupInput");
const orderStatusLookupBtn = $("#orderStatusLookupBtn");
const orderStatusLookupMsg = $("#orderStatusLookupMsg");
const orderStatusLookupResult = $("#orderStatusLookupResult");
const orderStatusSummaryGrid = $("#orderStatusSummaryGrid");
const orderStatusTimeline = $("#orderStatusTimeline");
const orderStatusItems = $("#orderStatusItems");
const beforeAfterToggleEl = $("#beforeAfterToggle");
const previewModeSwitch = $("#previewModeSwitch");
const previewModeKnob = $("#previewModeKnob");
const pendantShapeDevWrap = $("#pendantShapeDevWrap");
const pendantShapeDevSelect = $("#pendantShapeDevSelect");
const saveDesignBtn = $("#saveDesignBtn");
const restoreDesignBtn = $("#restoreDesignBtn");
const saveStatusText = $("#saveStatusText");
const designAssistFab = $("#designAssistFab");
const designAssistModal = $("#designAssistModal");
const designAssistGenerateBtn = $("#designAssistGenerateBtn");
const assistRecipientInput = $("#assistRecipientInput");
const assistStyleSelect = $("#assistStyleSelect");
const assistSuggestionText = $("#assistSuggestionText");
const saveDesignModal = $("#saveDesignModal");
const savedDesignIdText = $("#savedDesignIdText");
const savedDesignLinkInput = $("#savedDesignLinkInput");
const copySavedDesignLinkBtn = $("#copySavedDesignLinkBtn");
const restoreDesignModal = $("#restoreDesignModal");
const restoreDesignIdInput = $("#restoreDesignIdInput");
const restoreDesignConfirmBtn = $("#restoreDesignConfirmBtn");
const restoreDesignMsg = $("#restoreDesignMsg");
const giftModeToggle = $("#giftModeToggle");
const giftModeFields = $("#giftModeFields");
const giftNoteInput = $("#giftNoteInput");
const giftCardStyleRow = $("#giftCardStyleRow");
const rotateEngraveBtn = $("#rotateEngraveBtn");
const rotateEngraveLabel = $("#rotateEngraveLabel");
const engraveCharHintEl = $("#engraveCharHint");
const engraveFitErrorEl = $("#engraveFitError");

const STUDIO_SAVES_KEY = "harotli_studio_saved_designs_v2";

function socialProofBadgeMarkup(product) {
  const id = String(product?.id || "");
  if (!id) return "";
  const score = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  // Show only on some products (not all).
  if (score % 5 > 1) return "";
  const views = 8 + (score % 17);
  return `<span class="product-social-proof" aria-label="${views} צפיות היום" title="צפיות">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 5C6.5 5 2 9.2 1 12c1 2.8 5.5 7 11 7s10-4.2 11-7c-1-2.8-5.5-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2.2a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z"/>
    </svg>
    <strong>${views}</strong>
  </span>`;
}

const formatShippingFeeDisplay = (fee) => (fee <= 0 ? "חינם" : formatPrice(fee));

function paymentOptionById(id) {
  return PAYMENT_METHOD_OPTIONS.find((p) => p.id === id) || PAYMENT_METHOD_OPTIONS[0];
}

function brandMarkHtml(brand) {
  if (!brand) return `<span class="wallet-card-ico" aria-hidden="true">💳</span>`;
  if (brand === "google") {
    return `<svg class="wallet-svg" width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;
  }
  if (brand === "apple") {
    return `<span class="pay-badge-apple" aria-hidden="true"><svg class="wallet-svg" width="11" height="13" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.3 40.8-165.9 40.8s-105.6-57-155.5-127C46.6 791.8 0 663 0 541.5c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.5zM554.1 159.4c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 84-55.1 136.5 0 7.8 1.3 15.6 2.6 18.1 3.2.6 8.5 1.3 13.6 1.3 45.4 0 102.5-30.4 135.8-71.3z"/></svg><span>Pay</span></span>`;
  }
  if (brand === "bit") {
    return `<span class="pay-badge-bit" aria-hidden="true">ביט</span>`;
  }
  if (brand === "paypal") {
    return `<span class="pay-badge-paypal" aria-hidden="true"><span class="pp-p">Pay</span><span class="pp-pal">Pal</span></span>`;
  }
  return "";
}

function paymentOptionRowMarkup(opt) {
  return `<span class="wallet-row">${brandMarkHtml(opt.brand)}<span class="wallet-row-label">${opt.label}</span></span>`;
}

function setWalletMenuOpen(open) {
  if (!walletMenu || !walletMenuTrigger) return;
  walletMenu.hidden = !open;
  walletMenuTrigger.setAttribute("aria-expanded", open ? "true" : "false");
}

function renderWalletMenuList() {
  if (!walletMenu) return;
  const cur = state.checkout.paymentMethod;
  walletMenu.innerHTML = PAYMENT_METHOD_OPTIONS.map(
    (opt) =>
      `<button type="button" class="wallet-menu-item ${cur === opt.id ? "is-selected" : ""}" data-pay-method="${opt.id}" role="option" aria-selected="${cur === opt.id ? "true" : "false"}">${paymentOptionRowMarkup(opt)}</button>`
  ).join("");
}

function renderWalletPaymentUI() {
  if (!walletTriggerInner) return;
  const opt = paymentOptionById(state.checkout.paymentMethod);
  walletTriggerInner.innerHTML = paymentOptionRowMarkup(opt);
  renderWalletMenuList();
  const isCard = state.checkout.paymentMethod === "card";
  if (cardFieldsGrid) cardFieldsGrid.hidden = !isCard;
  if (walletMockHint) walletMockHint.hidden = isCard;
}
const categoryTitleById = () => Object.fromEntries(runtimeCategories.map((c) => [c.id, c.title]));
const currentProduct = () => runtimeItems.find((p) => p.id === state.selectedProductId) || null;
function previewTypeForProduct(product) {
  if (!product) return "other";
  const rawType = String(product.productType || product.typeId || "").toLowerCase();
  const rawCategory = String(product.studioCategoryKey || product.category || product.categoryId || "").toLowerCase();
  if (rawType.includes("ring") || rawCategory.includes("ring")) return "ring";
  if (rawType.includes("necklace") || rawCategory.includes("necklace")) return "necklace";
  if (rawType.includes("bracelet") || rawCategory.includes("bracelet")) return "bracelet";
  if (rawType.includes("keychain") || rawCategory.includes("keychain")) return "keychain";
  return "other";
}

function resolvePendantShape(product) {
  const candidate = state.pendantShapeOverride || product?.pendantShape || "vertical-rectangle";
  return PENDANT_SHAPE_OPTIONS.includes(candidate) ? candidate : "vertical-rectangle";
}

function clampNum(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return { r: 212, g: 175, b: 55 };
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function relLuma(hex) {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function isDarkHex(hex) {
  return relLuma(hex) < 0.42;
}

function rgbToHex({ r, g, b }) {
  const toHex = (n) => clampNum(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(baseHex, targetHex, amount = 0.5) {
  const a = hexToRgb(baseHex);
  const b = hexToRgb(targetHex);
  const t = clampNum(amount, 0, 1);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

function safeEngravingText(raw) {
  return String(raw || "").trim();
}

function materialPreviewStyle(materialId, fallbackHex = "#d4af37") {
  const id = String(materialId || "");
  const baseHex =
    id === "gold"
      ? "#D4AF37"
      : id === "silver"
        ? "#C8C8C8"
        : id === "rose-gold"
          ? "#B76E79"
          : id === "black-matte"
            ? "#2B2B2B"
            : fallbackHex;

  const dark = isDarkHex(baseHex);
  const light = mixHex(baseHex, "#ffffff", dark ? 0.22 : 0.62);
  const mid = mixHex(baseHex, "#f5efe8", dark ? 0.18 : 0.46);
  const shadow = mixHex(baseHex, "#2e2118", dark ? 0.64 : 0.28);
  const shineWarm = mixHex(baseHex, dark ? "#ffffff" : "#fff4d6", dark ? 0.12 : 0.35);
  const shineCool = mixHex(baseHex, dark ? "#ffffff" : "#e7f2ff", dark ? 0.10 : 0.32);
  const shineHex = id === "silver" ? shineCool : id === "black-matte" ? mixHex(baseHex, "#ffffff", 0.14) : shineWarm;

  const engravingFill = dark ? "rgba(255, 250, 244, 0.84)" : "rgba(58, 39, 24, 0.78)";
  const engravingStroke = dark ? "rgba(0,0,0,0.28)" : "rgba(255, 250, 244, 0.38)";

  return {
    baseHex,
    light,
    mid,
    shadow,
    shineHex,
    isMatte: id === "black-matte",
    engravingFill,
    engravingStroke,
  };
}

function engravingFontSizeByShape(shape, textLength, mode = "horizontal") {
  const baseByShape = {
    heart: 12,
    circle: 12,
    square: 12,
    "vertical-rectangle": 11,
    default: 12,
  };
  const base = baseByShape[shape] || baseByShape.default;
  if (mode === "vertical") {
    return clampNum(Math.round(base - Math.max(0, textLength - 6) * 0.35), 8, base);
  }
  return clampNum(Math.round(base - Math.max(0, textLength - 8) * 0.45), 8, base);
}

function pendantInnerBox(shape) {
  // Rough inner bounds in SVG viewBox units for text fitting.
  if (shape === "vertical-rectangle") return { w: 30, h: 62 };
  if (shape === "circle") return { w: 54, h: 54 };
  if (shape === "square") return { w: 56, h: 56 };
  if (shape === "heart") return { w: 58, h: 46 };
  return { w: 54, h: 54 };
}

function computeEngravingFit({ text, shape, rotationDeg, userSize, boxOverride }) {
  const raw = String(text || "").trim();
  if (!raw) return { displayText: "", fs: 12, invalid: false, maxCharsHint: 0 };
  const chars = Array.from(raw);
  const box = boxOverride || pendantInnerBox(shape);
  const minFs = 8;
  const rot = ((Number(rotationDeg) || 0) % 360 + 360) % 360;
  const isVertical = rot === 90 || rot === 270;
  const desired = Number.isFinite(Number(userSize)) ? Number(userSize) : null;
  let fs = desired ? clampNum(desired, minFs, 50) : Math.max(minFs, engravingFontSizeByShape(shape, chars.length, isVertical ? "vertical" : "horizontal"));
  const charW = 0.64; // average glyph width factor
  const maxLine = isVertical ? box.h : box.w;
  while (fs > minFs && chars.length * fs * charW > maxLine) fs -= 1;
  const maxCharsHint = Math.max(1, Math.floor(maxLine / (minFs * charW)));
  const invalid = chars.length * fs * charW > maxLine;
  const displayChars = invalid ? chars.slice(0, Math.max(1, maxCharsHint - 1)).concat(["…"]) : chars;
  return { displayText: displayChars.join(""), fs, invalid, maxCharsHint };
}

function renderPendantEngravingText({ text, x, y, shape, rotationDeg = 0, userSize, boxOverride, fill, stroke }) {
  if (!text) return "";
  const rot = ((Number(rotationDeg) || 0) % 360 + 360) % 360;
  const { displayText, fs, invalid } = computeEngravingFit({ text, shape, rotationDeg: rot, userSize, boxOverride });
  return `<g class="engrave-rot" style="transform: rotate(${rot}deg); transform-origin: ${x}px ${y}px;">
    <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" direction="rtl" unicode-bidi="plaintext" class="engraved-text engraved-text--small" style="font-size:${fs}px;fill:${fill};stroke:${stroke};opacity:${invalid ? 0.72 : 0.9};">${escHtml(
      displayText
    )}</text>
  </g>`;
}

function renderPendantShine({ shape, shineHex, isMatte }) {
  const o = isMatte ? 0.08 : 0.18;
  const s = isMatte ? 0.55 : 0.72;
  if (shape === "circle") {
    return `<ellipse cx="196" cy="154" rx="18" ry="10" fill="${shineHex}" opacity="${o}" transform="rotate(-18 196 154)"/>`;
  }
  if (shape === "square") {
    return `<path d="M178 136 C190 128 226 126 242 134" fill="none" stroke="${shineHex}" stroke-width="6" opacity="${o}" stroke-linecap="round"/>`;
  }
  if (shape === "heart") {
    return `<path d="M178 140 C190 128 206 128 210 132" fill="none" stroke="${shineHex}" stroke-width="6" opacity="${o}" stroke-linecap="round"/>`;
  }
  // vertical-rectangle
  return `<path d="M192 132 C206 124 226 126 230 138" fill="none" stroke="${shineHex}" stroke-width="6" opacity="${o}" stroke-linecap="round"/>`;
}

function renderPendantShapeSvg({ shape, text, base, light, dark, rotationDeg = 0, userSize, style }) {
  const fill = style?.engravingFill || "rgba(58, 39, 24, 0.78)";
  const stroke = style?.engravingStroke || "rgba(255, 250, 244, 0.38)";
  const shine = renderPendantShine({ shape, shineHex: style?.shineHex || "#fff4d6", isMatte: !!style?.isMatte });
  if (shape === "heart") {
    return `<path d="M210 206 C248 184 274 164 274 138 C274 122 262 110 246 110 C232 110 220 117 210 130 C200 117 188 110 174 110 C158 110 146 122 146 138 C146 164 172 184 210 206 Z"
      fill="url(#gPendant)" stroke="${mixHex(dark, "#2e2118", 0.35)}" stroke-width="1.1"/>
      ${shine}
      ${renderPendantEngravingText({ text, x: 210, y: 155, shape: "heart", rotationDeg, userSize, fill, stroke })}`;
  }
  if (shape === "circle") {
    return `<circle cx="210" cy="166" r="40" fill="url(#gPendant)" stroke="${mixHex(dark, "#2e2118", 0.35)}" stroke-width="1.1"/>
      ${shine}
      ${renderPendantEngravingText({ text, x: 210, y: 166, shape: "circle", rotationDeg, userSize, fill, stroke })}`;
  }
  if (shape === "square") {
    return `<rect x="170" y="126" width="80" height="80" rx="12" fill="url(#gPendant)" stroke="${mixHex(dark, "#2e2118", 0.35)}" stroke-width="1.1"/>
      ${shine}
      ${renderPendantEngravingText({ text, x: 210, y: 166, shape: "square", rotationDeg, userSize, fill, stroke })}`;
  }
  return `<rect x="184" y="122" width="52" height="96" rx="18" fill="url(#gPendant)" stroke="${mixHex(dark, "#2e2118", 0.35)}" stroke-width="1.1"/>
    ${shine}
    ${renderPendantEngravingText({ text, x: 210, y: 170, shape: "vertical-rectangle", rotationDeg, userSize, fill, stroke })}`;
}

function productPreviewSvg({ type, engravingText, metalHex, pendantShape, textRotation = 0, textSize = 28 }) {
  const style = materialPreviewStyle("custom", metalHex || "#d4af37");
  const base = style.baseHex;
  const light = style.light;
  const mid = style.mid;
  const dark = style.shadow;
  const textRaw = String(engravingText || "").trim();
  const engravingFill = style.engravingFill;
  const engravingStroke = style.engravingStroke;
  const centerEngrave = ({ x, y, boxW, boxH, opacity = 0.78 }) =>
    textRaw
      ? `<g filter="url(#engraveFx)" opacity="${opacity}">
          ${renderPendantEngravingText({
            text: textRaw,
            x,
            y,
            shape: "circle",
            rotationDeg: textRotation,
            userSize: textSize,
            boxOverride: { w: boxW, h: boxH },
            fill: engravingFill,
            stroke: engravingStroke,
          })}
        </g>`
      : "";

  if (type === "bracelet") {
    return `<svg class="product-preview-svg" viewBox="0 0 420 300" aria-hidden="true">
      <defs>
        <linearGradient id="gBrace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${light}"/><stop offset="50%" stop-color="${base}"/><stop offset="100%" stop-color="${dark}"/>
        </linearGradient>
        <filter id="engraveFx"><feDropShadow dx="0" dy="0.5" stdDeviation="0.6" flood-opacity="0.18"/></filter>
      </defs>
      <ellipse cx="210" cy="246" rx="120" ry="18" fill="rgba(39,28,20,.14)"/>
      <ellipse cx="210" cy="150" rx="150" ry="92" fill="url(#gBrace)"/>
      <ellipse cx="210" cy="150" rx="95" ry="52" fill="#f4ede5"/>
      ${centerEngrave({ x: 210, y: 150, boxW: 150, boxH: 70, opacity: 0.78 })}
    </svg>`;
  }

  if (type === "necklace") {
    return `<svg class="product-preview-svg" viewBox="0 0 420 300" aria-hidden="true">
      <defs>
        <linearGradient id="gNeck" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${light}"/><stop offset="52%" stop-color="${base}"/><stop offset="100%" stop-color="${dark}"/>
        </linearGradient>
        <linearGradient id="gPendant" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${mixHex(light, "#ffffff", 0.24)}"/>
          <stop offset="100%" stop-color="${mixHex(base, dark, 0.34)}"/>
        </linearGradient>
        <filter id="engraveFx"><feDropShadow dx="0" dy="0.5" stdDeviation="0.6" flood-opacity="0.18"/></filter>
      </defs>
      <ellipse cx="210" cy="224" rx="46" ry="9" fill="rgba(39,28,20,.12)"/>
      <path d="M90 82 C142 132, 278 132, 330 82" fill="none" stroke="url(#gNeck)" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="210" cy="126" r="4.8" fill="url(#gNeck)"/>
      <line x1="210" y1="130.5" x2="210" y2="137" stroke="${mixHex(base, dark, 0.28)}" stroke-width="1.8" stroke-linecap="round"/>
      ${renderPendantShapeSvg({ shape: pendantShape || "vertical-rectangle", text: textRaw, base, light, dark, rotationDeg: textRotation, userSize: textSize, style })}
    </svg>`;
  }

  if (type === "ring") {
    return `<svg class="product-preview-svg" viewBox="0 0 420 300" aria-hidden="true">
      <defs>
        <linearGradient id="gRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${light}"/><stop offset="45%" stop-color="${base}"/><stop offset="100%" stop-color="${dark}"/>
        </linearGradient>
        <filter id="engraveFx"><feDropShadow dx="0" dy="0.5" stdDeviation="0.6" flood-opacity="0.18"/></filter>
      </defs>
      <ellipse cx="210" cy="244" rx="92" ry="16" fill="rgba(39,28,20,.13)"/>
      <circle cx="210" cy="150" r="88" fill="url(#gRing)"/>
      <circle cx="210" cy="150" r="53" fill="#f6efe8"/>
      ${centerEngrave({ x: 210, y: 150, boxW: 120, boxH: 70, opacity: 0.75 })}
    </svg>`;
  }

  if (type === "keychain") {
    return `<svg class="product-preview-svg" viewBox="0 0 420 300" aria-hidden="true">
      <defs>
        <linearGradient id="gKey" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${light}"/><stop offset="50%" stop-color="${base}"/><stop offset="100%" stop-color="${dark}"/>
        </linearGradient>
        <filter id="engraveFx"><feDropShadow dx="0" dy="0.5" stdDeviation="0.6" flood-opacity="0.18"/></filter>
      </defs>
      <ellipse cx="210" cy="248" rx="84" ry="14" fill="rgba(39,28,20,.12)"/>
      <circle cx="210" cy="92" r="26" fill="url(#gKey)"/>
      <circle cx="210" cy="92" r="14" fill="#f6efe8"/>
      <rect x="198" y="116" width="24" height="22" rx="8" fill="url(#gKey)"/>
      <rect x="152" y="138" width="116" height="84" rx="16" fill="url(#gKey)" stroke="${mixHex(dark, "#2e2118", 0.4)}" stroke-width="1.3"/>
      ${centerEngrave({ x: 210, y: 180, boxW: 96, boxH: 54, opacity: 0.75 })}
    </svg>`;
  }

  return `<svg class="product-preview-svg" viewBox="0 0 420 300" aria-hidden="true">
    <defs>
      <linearGradient id="gOther" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${light}"/><stop offset="45%" stop-color="${mid}"/><stop offset="100%" stop-color="${dark}"/>
      </linearGradient>
      <filter id="engraveFx"><feDropShadow dx="0" dy="0.5" stdDeviation="0.6" flood-opacity="0.18"/></filter>
    </defs>
    <ellipse cx="210" cy="248" rx="106" ry="15" fill="rgba(39,28,20,.12)"/>
    <rect x="120" y="90" width="180" height="130" rx="22" fill="url(#gOther)" stroke="${mixHex(dark, "#2e2118", 0.4)}" stroke-width="1.2"/>
    ${centerEngrave({ x: 210, y: 155, boxW: 150, boxH: 80, opacity: 0.75 })}
  </svg>`;
}
const currentVariant = (product) => {
  if (!product) return { color: "", swatch: "#f3eee7", image: "" };
  const idx = state.selectedVariantByProduct[product.id] || 0;
  return product.variants[idx] || product.variants[0];
};

function galleryUrlsForProduct(p) {
  if (!p) return [];
  if (Array.isArray(p.imageUrls) && p.imageUrls.length) return [...p.imageUrls];
  const urls = [];
  const seen = new Set();
  for (const v of p.variants || []) {
    if (v.image && !seen.has(v.image)) {
      seen.add(v.image);
      urls.push(v.image);
    }
  }
  return urls;
}

function syncPreviewGalleryFromSelectedVariant() {
  const p = currentProduct();
  if (!p?.variants?.length) {
    state.previewGalleryIndex = 0;
    return;
  }
  const urls = galleryUrlsForProduct(p);
  if (!urls.length) {
    state.previewGalleryIndex = 0;
    return;
  }
  const vIdx = Math.min(state.selectedVariantByProduct[p.id] ?? 0, p.variants.length - 1);
  const v = p.variants[vIdx];
  let idx = v?.image ? urls.indexOf(v.image) : -1;
  if (idx < 0) idx = Math.min(vIdx, urls.length - 1);
  state.previewGalleryIndex = ((idx % urls.length) + urls.length) % urls.length;
}

function syncVariantFromGallerySelection() {
  const p = currentProduct();
  if (!p?.variants?.length) return;
  const urls = galleryUrlsForProduct(p);
  if (!urls.length) return;
  const n = urls.length;
  const gi = ((state.previewGalleryIndex % n) + n) % n;
  const url = urls[gi];
  const vIdx = p.variants.findIndex((vv) => vv.image === url);
  if (vIdx >= 0) state.selectedVariantByProduct[p.id] = vIdx;
  else state.selectedVariantByProduct[p.id] = gi % p.variants.length;
}
const productIconByCategory = {
  necklaces: `<svg class="product-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a7.5 7.5 0 0 0-7.5 7.5c0 3 2.1 5.8 5 7.5l2.5 1.5 2.5-1.5c2.9-1.7 5-4.5 5-7.5A7.5 7.5 0 0 0 12 4Zm0 4.2a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6Z"/></svg>`,
  bracelets: `<svg class="product-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.5c-4.2 0-7.5 2.9-7.5 6.5s3.3 6.5 7.5 6.5 7.5-2.9 7.5-6.5-3.3-6.5-7.5-6.5Zm0 3.2c2.3 0 4.1 1.5 4.1 3.3S14.3 15.3 12 15.3 7.9 13.8 7.9 12 9.7 8.7 12 8.7Z"/></svg>`,
  keychains: `<svg class="product-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 4.5-3.1H20v-2.1h-2v-2h-2.2v2h-2.3A4.8 4.8 0 0 0 9 6.2Zm0 2.3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/></svg>`,
  other: `<svg class="product-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 8h15v10.5h-15V8Zm2-3h11l1.5 3h-14L6.5 5Zm5.5 6.2h0c-1.2 0-2.1.9-2.1 2.1s.9 2.1 2.1 2.1 2.1-.9 2.1-2.1-.9-2.1-2.1-2.1Z"/></svg>`,
};
const currentMaterial = () => MATERIAL_OPTIONS.find((m) => m.id === state.customization.materialId) || MATERIAL_OPTIONS[0];
const currentShipping = () => SHIPPING_METHODS.find((s) => s.id === state.checkout.shippingId) || SHIPPING_METHODS[0];
const currentFont = () => FONT_OPTIONS.find((f) => f.id === state.customization.fontId) || FONT_OPTIONS[0];

const PCT_LO = 3;
const PCT_HI = 97;

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function readLocalDemoOrdersSafe() {
  try {
    const raw = localStorage.getItem(STUDIO_DEMO_ORDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function generateFiveDigitOrderNumber() {
  const used = new Set(readLocalDemoOrdersSafe().map((o) => String(o?.orderNumber || "")));
  for (let i = 0; i < 24; i++) {
    const candidate = String(10000 + Math.floor(Math.random() * 90000));
    if (!used.has(candidate)) return candidate;
  }
  return String(10000 + Math.floor(Math.random() * 90000));
}

function normalizeOrderLookupInput(raw) {
  const src = String(raw || "").trim();
  if (!src) return "";
  if (/^HG-\d{4}-\d{5}$/i.test(src)) return src.toUpperCase();
  const digits = src.replace(/\D/g, "");
  if (digits.length === 5) return digits;
  if (digits.length > 5) return digits.slice(-5);
  return src.toUpperCase();
}

function statusLabelForCustomer(status) {
  const map = {
    new: "התקבלה הזמנה",
    pending: "התקבלה הזמנה",
    processing: "בייצור",
    shipped: "נשלחה",
    completed: "נמסרה",
    cancelled: "ההזמנה בוטלה",
    refunded: "ההזמנה בוטלה",
  };
  return map[status] || status || "לא ידוע";
}

function fmtMoney(v) {
  return `${Number(v || 0).toFixed(2)} ₪`;
}

function renderOrderStatusDetails(order) {
  if (!orderStatusLookupResult || !orderStatusSummaryGrid || !orderStatusTimeline || !orderStatusItems) return;

  const normalizedStatus = String(order?.status || "").toLowerCase();
  const isDelivered = normalizedStatus === "completed";
  const isCancelled = normalizedStatus === "cancelled" || normalizedStatus === "refunded";

  const safeItems = Array.isArray(order?.items) ? order.items : [];
  const customerName = order.customer_name || order.customerName || "—";
  const customerPhone = order.customer_phone || order.customerPhone || "—";
  const paymentMethod = order.payment_method || order.paymentMethod || "—";
  const shippingMethod = order.shipping_method || order.shippingMethod || "—";
  const subtotal = order.subtotal ?? order.subTotal ?? order.sub_total ?? 0;
  const shippingCost = order.shipping_cost ?? order.shippingCost ?? 0;
  const discountAmount = order.discount_amount ?? order.discountAmount ?? 0;
  const total = order.total ?? 0;

  orderStatusSummaryGrid.innerHTML = [
    ["מספר הזמנה", order.order_number || order.orderNumber || "—"],
    ["סטטוס", statusLabelForCustomer(normalizedStatus)],
    ["לקוח", customerName],
    ["טלפון", customerPhone],
    ["תשלום", paymentMethod],
    ["משלוח", shippingMethod],
    ["סכום ביניים", fmtMoney(subtotal)],
    ["עלות משלוח", fmtMoney(shippingCost)],
    ["הנחה", fmtMoney(discountAmount)],
    ["סה״כ", fmtMoney(total)],
  ]
    .map(([k, v]) => `<div><div class="order-status-k">${escHtml(k)}</div><div class="order-status-v">${escHtml(v)}</div></div>`)
    .join("");

  const steps = ["התקבלה", "בייצור", "נשלחה", isCancelled ? "בוטלה" : "נמסרה"];
  const stepsByStatus = { new: 0, pending: 0, processing: 1, shipped: 2, completed: 3 };
  const activeIdx = isCancelled ? steps.length - 1 : (stepsByStatus[normalizedStatus] ?? 0);
  const fillPercent = (activeIdx / Math.max(steps.length - 1, 1)) * 84;

  orderStatusTimeline.innerHTML = `
    <div class="order-status-timeline-fill" style="width:${fillPercent}%;"></div>
    ${steps
      .map((label, i) => {
        const stateClass = i < activeIdx ? "done" : i === activeIdx ? "active" : "";
        const circleText = i === steps.length - 1 && isDelivered ? "✓" : i === steps.length - 1 && isCancelled ? "✕" : String(i + 1);
        return `<div class="order-status-step ${stateClass}">
          <div class="order-status-circle">${circleText}</div>
          <div class="order-status-label">${escHtml(label)}</div>
        </div>`;
      })
      .join("")}
  `;
  orderStatusTimeline.classList.toggle("order-status-timeline--delivered", isDelivered);
  orderStatusTimeline.classList.toggle("order-status-timeline--cancelled", isCancelled);

  orderStatusItems.innerHTML = safeItems.length
    ? safeItems
        .map((it) => {
          const title = it.product_name || it.productName || it.title || "פריט";
          const qty = it.quantity ?? it.qty ?? 1;
          const unit = it.unit_price ?? it.unitPrice ?? 0;
          const lineTotal = it.total_price ?? it.totalPrice ?? unit * qty;
          const customization = it.customization || it.custom || "";
          return `<div class="order-status-item">
            <div class="order-status-item-title">${escHtml(title)}</div>
            <div class="order-status-item-meta">כמות: ${escHtml(qty)} · מחיר יחידה: ${escHtml(fmtMoney(unit))} · סה"כ: ${escHtml(fmtMoney(lineTotal))}</div>
            ${customization ? `<div class="order-status-item-meta">התאמה: ${escHtml(customization)}</div>` : ""}
          </div>`;
        })
        .join("")
    : `<div class="order-status-item"><div class="order-status-item-meta">לא נמצאו פריטים להזמנה זו.</div></div>`;

  orderStatusLookupResult.hidden = false;
}

function findLocalOrderByNumber(orderNumber) {
  if (!orderNumber) return null;
  return readLocalDemoOrdersSafe().find((o) => normalizeOrderLookupInput(o?.orderNumber) === orderNumber) || null;
}

async function fetchOrderStatusLookup(orderNumber) {
  for (const base of buildApiBases()) {
    try {
      const url = `${base}/api/public/order-status?order_number=${encodeURIComponent(orderNumber)}`;
      const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 7000);
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      if (data?.order) return data.order;
    } catch {
      // try next base
    }
  }
  return null;
}

async function runOrderStatusLookup() {
  if (!orderStatusLookupInput || !orderStatusLookupMsg) return;
  const orderNumber = normalizeOrderLookupInput(orderStatusLookupInput.value);
  if (!orderNumber) {
    orderStatusLookupMsg.textContent = "הקלד מספר הזמנה תקין.";
    if (orderStatusLookupResult) orderStatusLookupResult.hidden = true;
    return;
  }
  orderStatusLookupBtn?.setAttribute("disabled", "disabled");
  orderStatusLookupMsg.textContent = "מחפש הזמנה...";
  if (orderStatusLookupResult) orderStatusLookupResult.hidden = true;

  let order = await fetchOrderStatusLookup(orderNumber);
  if (!order) {
    const local = findLocalOrderByNumber(orderNumber);
    if (local) {
      order = {
        order_number: local.orderNumber,
        status: local.status || "new",
        updated_at: local.updatedAt || local.createdAt || new Date().toISOString(),
      };
    }
  }

  orderStatusLookupBtn?.removeAttribute("disabled");
  if (!order) {
    orderStatusLookupMsg.textContent = "לא נמצאה הזמנה עם המספר הזה.";
    return;
  }
  orderStatusLookupMsg.textContent = "הזמנה נמצאה.";
  renderOrderStatusDetails(order);
}

function openOrderStatusLookup(prefillOrderNumber = "") {
  if (!orderStatusLookupPanel) return;
  orderStatusLookupPanel.hidden = false;
  if (orderStatusLookupInput && prefillOrderNumber) {
    orderStatusLookupInput.value = prefillOrderNumber;
  }
  orderStatusLookupInput?.focus();
}

function clampPctVal(v) {
  return Math.max(PCT_LO, Math.min(PCT_HI, v));
}

function normalizeOff(entry) {
  if (entry == null) return { xPct: 50, yPct: 50 };
  if (typeof entry.xPct === "number" && typeof entry.yPct === "number") {
    return { xPct: clampPctVal(entry.xPct), yPct: clampPctVal(entry.yPct) };
  }
  if (typeof entry.x === "number" && typeof entry.y === "number") {
    return {
      xPct: clampPctVal(50 + entry.x * 0.14),
      yPct: clampPctVal(50 + entry.y * 0.14),
    };
  }
  return { xPct: 50, yPct: 50 };
}

function defaultEmojiPct(i) {
  return { xPct: 22 + (i % 3) * 28, yPct: 20 + Math.floor(i / 3) * 22 };
}

function defaultTextBandY(i, n, position) {
  const base = position === "top" ? 22 : position === "bottom" ? 78 : 50;
  const spread = n > 1 ? Math.min(15, 42 / (n - 1)) : 0;
  return clampPctVal(base + (i - (n - 1) / 2) * spread);
}

/** מסדר מחדש את גובה כל שורות הטקסט לפי «מיקום» גלובלי — שומר x (גרירה אופקית). */
function redistributeTextLinesVertical() {
  const c = state.customization;
  const withText = c.textBlocks.filter((b) => String(b.text).trim());
  const n = Math.max(withText.length, 1);
  withText.forEach((b, idx) => {
    const o = (c.previewOffsets[b.id] ||= { xPct: 50, yPct: 50 });
    const norm = normalizeOff(o);
    o.xPct = norm.xPct;
    o.yPct = defaultTextBandY(idx, n, c.position);
  });
}

function migrateCustomizationLayout() {
  const c = state.customization;
  for (const b of c.textBlocks) {
    if (b.position != null) {
      if (c.textBlocks.length === 1) c.position = b.position;
      delete b.position;
    }
  }
  const o = c.previewOffsets;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v && typeof v.x === "number" && typeof v.xPct !== "number") {
      o[k] = normalizeOff(v);
    }
  }
}

function nextEmojiBlockId() {
  let max = 0;
  for (const eb of state.customization.emojiBlocks) {
    const m = Number(/^e(\d+)$/.exec(eb.id)?.[1]);
    if (!Number.isNaN(m) && m > max) max = m;
  }
  return `e${max + 1}`;
}

function ensurePreviewOffsets() {
  const o = (state.customization.previewOffsets ||= {});
  state.customization.emojiBlocks.forEach((eb, i) => {
    if (o[eb.id] == null) {
      const d = defaultEmojiPct(i);
      o[eb.id] = { xPct: d.xPct, yPct: d.yPct };
    } else {
      o[eb.id] = normalizeOff(o[eb.id]);
    }
  });
  state.customization.textBlocks.forEach((b) => {
    if (o[b.id] == null) {
      const texts = state.customization.textBlocks.filter((x) => String(x.text).trim());
      const n = Math.max(texts.length, 1);
      const idx = texts.findIndex((x) => x.id === b.id);
      const yPct = idx >= 0 ? defaultTextBandY(idx, n, state.customization.position) : 50;
      o[b.id] = { xPct: 50, yPct };
    } else {
      o[b.id] = normalizeOff(o[b.id]);
    }
  });
}

function emojiSummaryText() {
  const parts = state.customization.emojiBlocks.map((e) => e.symbol).filter(Boolean);
  return parts.length ? parts.join(" ") : "ללא";
}

function openCustomerUploadPicker() {
  const input = document.getElementById("customerUploadInput");
  input?.click();
}

function setCustomerUploadFile(file) {
  if (!file) return;
  const product = currentProduct();
  if (!product?.allowCustomerImageUpload) return;
  const safeName = String(file.name || "image").slice(0, 120);
  const reader = new FileReader();
  reader.onload = () => {
    state.customization.customerUpload = {
      name: safeName,
      type: String(file.type || ""),
      size: Number(file.size || 0),
      previewUrl: typeof reader.result === "string" ? reader.result : "",
    };
    renderCustomerUploadBox();
  };
  reader.readAsDataURL(file);
}

function renderCustomerUploadBox() {
  if (!customerUploadBoxEl) return;
  const product = currentProduct();
  if (!product?.allowCustomerImageUpload) {
    customerUploadBoxEl.hidden = true;
    return;
  }
  customerUploadBoxEl.hidden = false;
  const up = state.customization.customerUpload;
  customerUploadBoxEl.innerHTML = `
    <label>העלאת תמונה אישית</label>
    <div class="customer-upload-dropzone" id="customerUploadDropzone" role="button" tabindex="0" aria-label="העלאת תמונה אישית">
      <strong>גררו לכאן תמונה או לחצו להעלאה</strong>
      <span>JPG / PNG / WEBP</span>
      <input id="customerUploadInput" type="file" accept="image/*" hidden />
    </div>
    ${
      up
        ? `<div class="customer-upload-preview">
            ${up.previewUrl ? `<img src="${escHtml(up.previewUrl)}" alt="קובץ שהועלה" />` : ""}
            <p>${escHtml(up.name || "קובץ הועלה")}</p>
          </div>`
        : ""
    }
  `;
  const input = document.getElementById("customerUploadInput");
  const zone = document.getElementById("customerUploadDropzone");
  zone?.addEventListener("click", openCustomerUploadPicker);
  zone?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openCustomerUploadPicker();
    }
  });
  input?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setCustomerUploadFile(file);
  });
  zone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("is-over");
  });
  zone?.addEventListener("dragleave", () => zone.classList.remove("is-over"));
  zone?.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("is-over");
    const file = e.dataTransfer?.files?.[0];
    if (file) setCustomerUploadFile(file);
  });
}

function pricing() {
  const product = currentProduct();
  if (!product) return { subtotal: 0, shipping: 0, discount: 0, total: 0 };
  const subtotal = product.price * state.customization.qty;
  const shipping = state.step >= 2 ? currentShipping().fee : 0;
  const discount = state.couponApplied?.discount ?? 0;
  const total = Math.max(0, subtotal + shipping - discount);
  return { subtotal, shipping, discount, total };
}

function buildDemoStreetLine() {
  const c = state.checkout;
  const parts = [c.address, c.house].filter(Boolean);
  return parts.join(" ") || "—";
}

function toAgorot(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function buildStudioOrderCreatePayload() {
  const product = currentProduct();
  if (!product) return null;
  const qty = Math.max(1, Number(state.customization.qty) || 1);
  const unitPriceAgorot = toAgorot(product.price);
  const shippingFeeAgorot = toAgorot(currentShipping().fee);
  const customer = state.checkout;
  const selectedVariant = currentVariant(product);
  const textLines = state.customization.textBlocks.map((b) => String(b.text).trim()).filter(Boolean).join(" | ");
  const itemName = `${product.title}${selectedVariant?.color ? ` · ${selectedVariant.color}` : ""}`;
  const noteParts = [
    textLines ? `חריטה: ${textLines}` : "",
    state.customization.notes ? `הערות: ${state.customization.notes}` : "",
    state.customization.customerUpload?.name ? `קובץ לקוח: ${state.customization.customerUpload.name}` : "",
  ].filter(Boolean);

  return {
    customer: {
      fullName: (customer.fullName || "").trim() || null,
      phone: (customer.phone || "").trim() || null,
      email: (customer.email || "").trim(),
      city: (customer.city || "").trim() || null,
      address: [customer.address, customer.house].filter(Boolean).join(" ").trim() || null,
    },
    items: [
      {
        productId: product.id,
        name: noteParts.length ? `${itemName} (${noteParts.join(" | ")})` : itemName,
        qty,
        unitPrice: unitPriceAgorot,
      },
    ],
    shippingFee: shippingFeeAgorot,
    couponCode: state.couponApplied?.code || null,
  };
}

/** מבנה כמו `StudioDemoOrderJson` בפאנל — נשמר ב-localStorage */
function buildStudioDemoOrderPayload() {
  const product = currentProduct();
  if (!product) return null;
  const variant = currentVariant(product);
  const p = pricing();
  const now = new Date().toISOString();
  const orderNumber = generateFiveDigitOrderNumber();
  const id = `studio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const c = state.checkout;
  const custId = studioCustomerId(c.phone, c.email);
  const textLines = state.customization.textBlocks.map((b) => String(b.text).trim()).filter(Boolean).join(" | ");
  const custBody = [
    `טקסט: ${textLines || state.customization.text || "—"}`,
    `סימנים: ${emojiSummaryText()}`,
    `צבע: ${variant.color || "ברירת מחדל"}`,
    `גימור: ${currentMaterial().label}`,
    `כמות: ${state.customization.qty}`,
  ];
  if (state.customization.notes) custBody.push(`הערות מוצר: ${state.customization.notes}`);
  if (state.customization.customerUpload?.name) {
    custBody.push(`קובץ שהלקוח העלה: ${state.customization.customerUpload.name}`);
  }
  const notesParts = [];
  if (c.deliveryNotes) notesParts.push(`הגעה למשלוח: ${c.deliveryNotes}`);
  if (c.aptFloor) notesParts.push(`דירה/קומה: ${c.aptFloor}`);
  const street = buildDemoStreetLine();
  const payLabel = paymentOptionById(state.checkout.paymentMethod).label;
  const qty = Math.max(1, state.customization.qty || 1);
  const cop = state.couponApplied;
  return {
    id,
    orderNumber,
    customerId: custId,
    customerName: (c.fullName || "").trim() || "לקוח",
    customerEmail: (c.email || "").trim() || undefined,
    customerPhone: (c.phone || "").trim() || undefined,
    status: "new",
    paymentStatus: "paid",
    paymentMethod: payLabel,
    shippingMethod: currentShipping().label,
    subtotal: p.subtotal,
    shippingCost: p.shipping,
    discount: p.discount,
    total: p.total,
    ...(cop ? { couponId: cop.id, couponCode: cop.code } : {}),
    shippingAddress: { street, city: (c.city || "").trim() || "—", zip: (c.zip || "").trim() || "—" },
    items: [
      {
        productId: product.id,
        productName: product.title,
        productImage: variant.image || "",
        sku: String(product.id).slice(0, 48),
        quantity: qty,
        price: p.subtotal / qty,
        customization: custBody.join(" · "),
      },
    ],
    notes: notesParts.length ? notesParts.join(" | ") : undefined,
    timeline: [{ status: "new", timestamp: now, note: "הזמנה מהסטודיו (דמה)" }],
    createdAt: now,
    updatedAt: now,
  };
}

function renderProgress() {
  progressEl.innerHTML = STUDIO_STEPS.map((label, i) => {
    const cls = i < state.step ? "done" : i === state.step ? "active" : "";
    return `<div class="step-pill ${cls}">
      <div class="step-pill-top">
        <span class="step-index">${i + 1}</span>
      </div>
      <div class="title">${label}</div>
    </div>`;
  }).join("");
  requestAnimationFrame(() => {
    const active = progressEl.querySelector(".step-pill.active");
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  });
}

function goToStep(target) {
  if (target < 0 || target > 3 || target === state.step) return;
  steps[state.step].classList.remove("active");
  state.step = target;
  steps[state.step].classList.add("active");
  renderProgress();
  renderNav();
  updatePricingUI();
  if (target === 2) renderCouponBox();
  if (target === 1) {
    syncPreviewGalleryFromSelectedVariant();
    updatePreview();
  }
}

function renderNav() {
  flowNav.style.display = state.step === 3 ? "none" : "flex";
  if (nextBtn) nextBtn.style.display = state.step === 3 ? "none" : "";
  if (backBtn) {
    backBtn.style.display = state.step === 3 ? "none" : "";
    backBtn.disabled = state.step === 0;
  }
  if (nextBtn) nextBtn.textContent = state.step === 2 ? "סיום הזמנה" : "המשך לשלב הבא";
}

function renderCategoryChips() {
  categoryChipsEl.innerHTML = `
    <div class="chip-row chip-row--primary">
      ${runtimeCategories
        .map(
          (p) =>
            `<button class="chip ${state.activeCategoryId === p.id ? "active" : ""}" data-category-chip="${p.id}">${p.title}</button>`
        )
        .join("")}
    </div>
  `;
  requestAnimationFrame(() => {
    const active = categoryChipsEl.querySelector(".subcategory-tab.active") || categoryChipsEl.querySelector(".chip.active");
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  });
}

function renderCatalogSections() {
  if (!runtimeCategories.length) {
    catalogSectionsEl.innerHTML = `<section class="catalog-section"><p class="step-sub">אין כרגע מוצרים זמינים בקטלוג.</p></section>`;
    return;
  }
  // Auto-switch to a populated category on initial/auto renders, but never bounce
  // away from a category the user actively clicked — keep their valid-but-empty selection.
  const activeIsKnown = runtimeCategories.some((c) => c.id === state.activeCategoryId);
  const activeHasItems = runtimeItems.some((p) => p.category === state.activeCategoryId);
  const needsFallback = !activeIsKnown || (!state.userPickedCategory && !activeHasItems);
  if (needsFallback) {
    const fallbackCategoryWithItems = runtimeCategories.find((c) => runtimeItems.some((p) => p.category === c.id));
    if (fallbackCategoryWithItems) {
      state.activeCategoryId = fallbackCategoryWithItems.id;
      state.selectedProductId = runtimeItems.find((p) => p.category === state.activeCategoryId)?.id || runtimeItems[0]?.id || "";
      renderCategoryChips();
    }
  }
  let category = runtimeCategories.find((c) => c.id === state.activeCategoryId) || runtimeCategories[0];
  let items = runtimeItems.filter((p) => p.category === category.id);
  if (!items.length) {
    catalogSectionsEl.innerHTML = `<section class="catalog-section" id="catalog-${category.id}">
      <h3 class="catalog-title">${category.title}</h3>
      <p class="step-sub">אין כרגע מוצרים זמינים בקטגוריה זו.</p>
    </section>`;
    return;
  }
  if (!category.useSubcategories && state.activeSubcategory) {
    state.activeSubcategory = "";
    renderCategoryChips();
  }
  let subcategories = [];
  let menSubcategory = "";
  let womenSubcategory = "";
  if (category.useSubcategories) {
    subcategories = [
      ...new Set(
        items
          .flatMap((p) => (Array.isArray(p.subcategories) && p.subcategories.length ? p.subcategories : [p.subcategory]))
          .map((x) => String(x || "").trim())
          .filter(Boolean)
      ),
    ];
    if (subcategories.length) {
      menSubcategory =
        subcategories.find((s) => {
          const normalized = String(s).toLowerCase();
          return normalized.includes("גבר") || normalized.includes("men");
        }) || subcategories[0];
      womenSubcategory =
        subcategories.find((s) => {
          const normalized = String(s).toLowerCase();
          return normalized.includes("אישה") || normalized.includes("נשים") || normalized.includes("woman") || normalized.includes("women");
        }) || "";
      const categoryKey = String(category.studioCategoryKey || category.id || "").toLowerCase();
      if (!state.activeSubcategory || !subcategories.includes(state.activeSubcategory)) {
        state.activeSubcategory = menSubcategory;
        renderCategoryChips();
      }
      if (categoryKey !== "necklaces") {
        items = items.filter((p) => {
          const labels = Array.isArray(p.subcategories) && p.subcategories.length ? p.subcategories : [p.subcategory];
          return labels.map((x) => String(x || "").trim()).includes(state.activeSubcategory);
        });
      }
    } else if (state.activeSubcategory) {
      state.activeSubcategory = "";
      renderCategoryChips();
    }
  }
    const rowRenderer = (rowItems, subTitle = "", scrollable = true) => {
      const showRowNav = scrollable && rowItems.length > 4;
      return `
      <div class="catalog-row-wrap">
        ${subTitle ? `<h4 class="catalog-subtitle">${subTitle}</h4>` : ""}
        ${
          scrollable
            ? `<div class="catalog-row-shell ${showRowNav ? "" : "no-nav"}">
                ${
                  showRowNav
                    ? `<button class="row-nav-btn" type="button" data-row-nav="next" aria-label="המוצר הבא">‹</button>`
                    : ""
                }
                <div class="catalog-row">
                  ${rowItems
                    .map(
                      (p) => `<article class="product-card ${state.selectedProductId === p.id ? "selected" : ""}" data-product="${p.id}">
                        <div class="product-image-wrap">
                          ${
                            currentVariant(p).image
                              ? `<img class="product-image" src="${currentVariant(p).image}" alt="${escHtml(p.title)}" loading="lazy" />`
                              : `<div class="product-image product-icon-stage" style="--product-bg:${currentVariant(p).swatch || "#f3eee7"}">
                                   ${productIconByCategory[p.studioCategoryKey || p.category] || productIconByCategory.other}
                                 </div>`
                          }
                          ${socialProofBadgeMarkup(p)}
                        </div>
                        <h4 class="product-title">${p.title}</h4>
                        <strong class="product-price">${formatPrice(p.price)}</strong>
                        <div class="swatch-row">
                          ${p.variants
                            .map(
                              (v, index) =>
                                `<button class="color-swatch ${index === (state.selectedVariantByProduct[p.id] || 0) ? "active" : ""}" data-swatch-product="${p.id}" data-swatch-index="${index}" aria-label="${v.color}" style="--swatch:${v.swatch};"></button>`
                            )
                            .join("")}
                        </div>
                        <button class="select-btn" type="button" data-product="${p.id}">בחר</button>
                      </article>`
                    )
                    .join("")}
                </div>
                ${
                  showRowNav
                    ? `<button class="row-nav-btn" type="button" data-row-nav="prev" aria-label="המוצר הקודם">›</button>`
                    : ""
                }
              </div>`
            : `<div class="catalog-grid-static">
                ${rowItems
                  .map(
                    (p) => `<article class="product-card ${state.selectedProductId === p.id ? "selected" : ""}" data-product="${p.id}">
                      <div class="product-image-wrap">
                        ${
                          currentVariant(p).image
                            ? `<img class="product-image" src="${currentVariant(p).image}" alt="${escHtml(p.title)}" loading="lazy" />`
                            : `<div class="product-image product-icon-stage" style="--product-bg:${currentVariant(p).swatch || "#f3eee7"}">
                                 ${productIconByCategory[p.studioCategoryKey || p.category] || productIconByCategory.other}
                               </div>`
                        }
                        ${socialProofBadgeMarkup(p)}
                      </div>
                      <h4 class="product-title">${p.title}</h4>
                      <strong class="product-price">${formatPrice(p.price)}</strong>
                      <div class="swatch-row">
                        ${p.variants
                          .map(
                            (v, index) =>
                              `<button class="color-swatch ${index === (state.selectedVariantByProduct[p.id] || 0) ? "active" : ""}" data-swatch-product="${p.id}" data-swatch-index="${index}" aria-label="${v.color}" style="--swatch:${v.swatch};"></button>`
                          )
                          .join("")}
                      </div>
                      <button class="select-btn" type="button" data-product="${p.id}">בחר</button>
                    </article>`
                  )
                  .join("")}
              </div>`
        }
      </div>
    `;
    };

    let subTabsMarkup = "";
    if (
      category.useSubcategories &&
      subcategories.length > 1 &&
      String(category.studioCategoryKey || category.id || "").toLowerCase() !== "necklaces"
    ) {
      const orderedSubs = [
        ...(menSubcategory ? [menSubcategory] : []),
        ...(womenSubcategory && womenSubcategory !== menSubcategory ? [womenSubcategory] : []),
        ...subcategories.filter((s) => s !== menSubcategory && s !== womenSubcategory),
      ];
      subTabsMarkup = `
        <div class="subcategory-tabs">
          ${orderedSubs
            .map(
              (s) =>
                `<button class="subcategory-tab ${state.activeSubcategory === s ? "active" : ""}" data-subcategory-chip="${escHtml(s)}">${escHtml(s)}</button>`
            )
            .join("")}
        </div>
      `;
    }

    let rowsMarkup = "";
    if (category.useSubcategories) {
      const categoryKey = String(category.studioCategoryKey || category.id || "").toLowerCase();
      if (categoryKey === "necklaces" && subcategories.length) {
        const orderedSubcategories = [
          ...(menSubcategory ? [menSubcategory] : []),
          ...(womenSubcategory && womenSubcategory !== menSubcategory ? [womenSubcategory] : []),
          ...subcategories.filter((sub) => sub !== menSubcategory && sub !== womenSubcategory),
        ];
        rowsMarkup = orderedSubcategories
          .map((sub) => {
            const rowItemsByAnyLabel = items.filter((p) => {
              const labels = Array.isArray(p.subcategories) && p.subcategories.length ? p.subcategories : [p.subcategory];
              return labels.map((x) => String(x || "").trim()).includes(sub);
            });
            if (!rowItemsByAnyLabel.length) return "";
            return rowRenderer(rowItemsByAnyLabel, sub, true);
          })
          .join("");
      } else {
        rowsMarkup = rowRenderer(items, state.activeSubcategory || "", true);
      }
    } else {
      const categoryKey = String(category.studioCategoryKey || category.id || "").toLowerCase();
      const shouldBeStaticGrid = categoryKey === "keychains" || categoryKey === "other";
      rowsMarkup = rowRenderer(items, "", !shouldBeStaticGrid);
    }

  const categoryKey = String(category.studioCategoryKey || category.id || "").toLowerCase();
  const shouldHideCategoryTitle = categoryKey === "necklaces";
  catalogSectionsEl.innerHTML = `
    <section class="catalog-section" id="catalog-${category.id}">
      ${shouldHideCategoryTitle ? "" : `<h3 class="catalog-title">${category.title}</h3>`}
      ${subTabsMarkup}
      ${rowsMarkup}
    </section>
  `;
}

function currentProductGalleryUrls() {
  return galleryUrlsForProduct(currentProduct());
}

const GALLERY_THUMB_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><rect fill="#ede4dc" width="56" height="56" rx="10"/><path fill="none" stroke="#a08068" stroke-width="1.6" stroke-linecap="round" d="M20 34 L28 24 L36 34"/></svg>'
  );

function renderPreviewGallery() {
  if (!previewGalleryEl) return;
  const urls = currentProductGalleryUrls();
  if (!urls.length) {
    previewGalleryEl.hidden = true;
    previewGalleryEl.innerHTML = "";
    return;
  }
  previewGalleryEl.hidden = false;
  const n = urls.length;
  const idx = ((state.previewGalleryIndex % n) + n) % n;
  const navDisabled = n <= 1 ? "disabled" : "";
  previewGalleryEl.innerHTML = `<div class="preview-gallery-inner" dir="ltr">
    <button type="button" class="gal-nav gal-nav--prev" data-gallery-nav="prev" aria-label="\u05d4\u05e7\u05d5\u05d3\u05dd" ${navDisabled}>\u2039</button>
    <div class="gal-thumbs" role="list">
      ${urls
        .map(
          (u, i) =>
            `<button type="button" class="gal-thumb ${i === idx ? "active" : ""}" data-gallery-index="${i}" aria-label="\u05ea\u05de\u05d5\u05e0\u05d4 ${i + 1} \u05de-${n}">
              <img src="${String(u).replace(/"/g, "&quot;")}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${GALLERY_THUMB_FALLBACK}'" />
            </button>`
        )
        .join("")}
    </div>
    <button type="button" class="gal-nav gal-nav--next" data-gallery-nav="next" aria-label="\u05d4\u05d1\u05d0" ${navDisabled}>\u203a</button>
  </div>`;
  requestAnimationFrame(() => {
    const active = previewGalleryEl.querySelector(".gal-thumb.active");
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  });
}

function updatePreview() {
  const c = state.customization;
  const mat = currentMaterial();
  ensurePreviewOffsets();
  const rotY = state.previewAngle === "front" ? 0 : state.previewAngle === "side" ? 32 : 10;
  const rotX = state.previewAngle === "top" ? 25 : 8;

  const product = currentProduct();
  const previewType = previewTypeForProduct(product);
  const pendantShape = resolvePendantShape(product);
  mockProductEl.classList.remove(
    "mock-product--necklaces",
    "mock-product--bracelets",
    "mock-product--keychains",
    "mock-product--other",
    "mock-product--type-necklace",
    "mock-product--type-bracelet",
    "mock-product--type-ring",
    "mock-product--type-keychain",
    "mock-product--type-other"
  );
  mockProductEl.classList.add(`mock-product--type-${previewType}`);

  mockProductEl.dataset.finish = mat.id;
  const selectedVariant = currentVariant(product);
  const style = materialPreviewStyle(mat.id, selectedVariant?.swatch || "#d4af37");
  const engravingText = state.previewMode === "before" ? "" : safeEngravingText(c.textBlocks?.[0]?.text || c.text || "");
  const fit = computeEngravingFit({
    text: engravingText,
    shape: pendantShape || "vertical-rectangle",
    rotationDeg: c.textRotation || 0,
    userSize: c.size,
  });
  if (engraveCharHintEl) {
    engraveCharHintEl.textContent = "";
  }
  if (engraveFitErrorEl) {
    const showErr = Boolean(engravingText) && fit.invalid && previewType === "necklace" && state.previewMode === "after";
    engraveFitErrorEl.hidden = !showErr;
    engraveFitErrorEl.textContent = showErr ? "הטקסט ארוך מדי לתליון — יש לקצר את הטקסט או לבחור פריסה אחרת." : "";
  }
  if (mockProductEl) mockProductEl.classList.toggle("engrave-invalid", Boolean(engravingText) && fit.invalid);
  mockProductEl.innerHTML = productPreviewSvg({
    type: previewType,
    engravingText,
    metalHex: style.baseHex,
    pendantShape,
    textRotation: c.textRotation || 0,
    textSize: c.size,
  });
  if (pendantShapeDevWrap) pendantShapeDevWrap.style.display = previewType === "necklace" ? "inline-flex" : "none";
  if (pendantShapeDevSelect && previewType === "necklace") pendantShapeDevSelect.value = pendantShape;

  const finalRotateY = rotY + state.dragRotateY;
  const finalRotateX = rotX + state.dragRotateX;
  mockProductEl.style.transform = `perspective(900px) rotateY(${finalRotateY}deg) rotateX(${finalRotateX}deg) rotate(${state.rotate}deg) scale(${state.zoom})`;

  if (mockEngraveSurfaceEl) mockEngraveSurfaceEl.innerHTML = "";
  renderPreviewGallery();
}

function updatePricingUI() {
  const p = pricing();
  const selectedProduct = currentProduct();
  if (!selectedProduct) {
    orderSummaryEl.innerHTML = `<h3>סיכום הזמנה</h3><div class="summary-card">אין כרגע מוצר זמין להזמנה.</div>`;
    finalSummaryEl.innerHTML = `<strong>אין מוצר נבחר</strong>`;
    return;
  }
  const selectedVariant = currentVariant(selectedProduct);
  orderSummaryEl.innerHTML = `<h3>סיכום הזמנה</h3>
    <div class="selected-product-card">
      <div class="selected-product-image-wrap">
        ${
          selectedVariant.image
            ? `<img class="selected-product-image" src="${selectedVariant.image}" alt="${escHtml(selectedProduct.title)}" />`
            : `<div class="selected-product-image product-icon-stage" style="--product-bg:${selectedVariant.swatch || "#f3eee7"}">
                 ${productIconByCategory[selectedProduct.studioCategoryKey || selectedProduct.category] || productIconByCategory.other}
               </div>`
        }
      </div>
      <div class="selected-product-details">
        <strong class="selected-title">${selectedProduct.title}</strong>
        <span class="selected-desc">${selectedProduct.description || ""}</span>
        <span>צבע נבחר: ${selectedVariant.color}</span>
        <span>גימור: ${currentMaterial().label}</span>
        <span>סימנים: ${emojiSummaryText()}</span>
        <span>חריטה: "${state.customization.text || "ללא טקסט"}"</span>
        <span>כמות: ${state.customization.qty}</span>
        <span class="selected-status">סטטוס: זמין להתאמה אישית</span>
      </div>
    </div>
    <div class="summary-card">
      <strong>סיכום מחיר</strong><br>
      מחיר בסיס: ${formatPrice(selectedProduct.price)}<br>
      ביניים: ${formatPrice(p.subtotal)}<br>
      ${p.discount > 0 ? `קופון (${escHtml(state.couponApplied?.code || "")}): −${formatPrice(p.discount)}<br>` : ""}
      משלוח (${currentShipping().label}): ${formatShippingFeeDisplay(p.shipping)}<br>
      אמצעי תשלום: ${paymentOptionById(state.checkout.paymentMethod).label}<br>
      <strong>סה"כ לתשלום: <span class="live-price ${state.lastTotal !== null && state.lastTotal !== p.total ? "bump" : ""}">${formatPrice(
        p.total
      )}</span></strong><br>
      <span style="font-size:11px;color:#7f6653">ללא מעמ — המחיר כפי שמוצג</span><br>
      זמן אספקה: ${currentShipping().eta}
    </div>`;
  state.lastTotal = p.total;
  const orderNo =
    state.step === 3 && state.placedOrderNumber
      ? state.placedOrderNumber
      : "-----";
  finalSummaryEl.innerHTML = `<strong>מספר הזמנה:</strong> ${orderNo}<br>
      <strong>מוצר:</strong> ${selectedProduct.title}<br>
      <strong>סטטוס:</strong> התקבלה הזמנה<br>
      <strong>משלוח:</strong> ${currentShipping().label}<br>
      <strong>סה"כ:</strong> ${formatPrice(p.total)}
      ${state.customization.giftMode ? `<div class="gift-indicator"><svg class="gift-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M20 7h-3.2a2.9 2.9 0 0 0 .4-1.5c0-1.4-1.1-2.5-2.5-2.5-1.5 0-2.5 1.1-3.7 3-1.2-1.9-2.2-3-3.7-3C5.9 3 4.8 4.1 4.8 5.5c0 .6.2 1.1.4 1.5H2v4h1v10h18V11h1V7Zm-6.9-2.5c.7-1 1.1-1.5 1.7-1.5.5 0 1 .4 1 1 0 .8-.7 1.5-1.5 1.5h-2.1Zm-4.9 0H6.1c-.8 0-1.5-.7-1.5-1.5 0-.6.5-1 1-1 .6 0 1 .5 1.7 1.5Zm3.1 4.5v10H6V11h5.3Zm1.4 10V11H18v8h-5.3Z"/></svg>כולל ברכה אישית</div>` : ""}`;
}

function setPreviewMode(mode) {
  state.previewMode = mode === "before" ? "before" : "after";
  const isAfter = state.previewMode === "after";
  if (previewModeSwitch) previewModeSwitch.checked = isAfter;
  if (previewModeKnob) previewModeKnob.textContent = isAfter ? "עם חריטה" : "ללא חריטה";
  if (beforeAfterToggleEl) {
    beforeAfterToggleEl.setAttribute("data-mode", isAfter ? "after" : "before");
    beforeAfterToggleEl.setAttribute("aria-checked", isAfter ? "true" : "false");
  }
  updatePreview();
}

function renderGiftModeUI() {
  if (giftModeToggle) giftModeToggle.checked = !!state.customization.giftMode;
  if (giftModeFields) giftModeFields.hidden = !state.customization.giftMode;
  if (giftNoteInput) giftNoteInput.value = state.customization.giftNote || "";
  if (giftCardStyleRow) {
    giftCardStyleRow.querySelectorAll("[data-gift-card-style]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.giftCardStyle === state.customization.giftCardStyle);
    });
  }
}

function suggestedGiftNoteByStyle(styleId) {
  const byStyle = {
    classic: "באהבה והערכה גדולה.",
    romantic: "ללב שלי, באהבה גדולה.",
    minimal: "באהבה, תמיד איתך.",
  };
  return byStyle[String(styleId || "classic")] || byStyle.classic;
}

function setSaveStatus(text) {
  if (saveStatusText) saveStatusText.textContent = text || "";
}

function serializeCurrentDesign() {
  return {
    selectedProductId: state.selectedProductId,
    activeCategoryId: state.activeCategoryId,
    selectedVariantByProduct: state.selectedVariantByProduct,
    previewMode: state.previewMode,
    pendantShapeOverride: state.pendantShapeOverride,
    customization: state.customization,
  };
}

function renderRotateUi() {
  const rot = ((Number(state.customization.textRotation) || 0) % 360 + 360) % 360;
  if (rotateEngraveLabel) rotateEngraveLabel.textContent = `${rot}°`;
}

function readSavedDesignsMap() {
  try {
    const raw = localStorage.getItem(STUDIO_SAVES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSavedDesignsMap(map) {
  try {
    localStorage.setItem(STUDIO_SAVES_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

function designShareLink(designId) {
  const url = new URL(window.location.href);
  url.searchParams.set("design", designId);
  return url.toString();
}

function applyDesignPayload(parsed) {
  if (!parsed) return false;
  try {
    state.selectedProductId = parsed.selectedProductId || state.selectedProductId;
    state.activeCategoryId = parsed.activeCategoryId || state.activeCategoryId;
    state.selectedVariantByProduct = parsed.selectedVariantByProduct || state.selectedVariantByProduct;
    state.previewMode = parsed.previewMode || "after";
    state.pendantShapeOverride = parsed.pendantShapeOverride || "";
    state.customization = { ...state.customization, ...(parsed.customization || {}) };
    ensurePreviewOffsets();
    renderCategoryChips();
    renderCatalogSections();
    renderOptionRows();
    syncFormDefaults();
    renderGiftModeUI();
    renderRotateUi();
    renderCustomerUploadBox();
    updatePreview();
    updatePricingUI();
    setPreviewMode(state.previewMode);
    return true;
  } catch {
    return false;
  }
}

function openSaveDesignModal({ designId, link }) {
  if (!saveDesignModal) return;
  if (savedDesignIdText) savedDesignIdText.textContent = designId;
  if (savedDesignLinkInput) savedDesignLinkInput.value = link;
  saveDesignModal.hidden = false;
}

function closeSaveDesignModal() {
  if (!saveDesignModal) return;
  saveDesignModal.hidden = true;
}

function openRestoreDesignModal() {
  if (!restoreDesignModal) return;
  if (restoreDesignIdInput) restoreDesignIdInput.value = "";
  if (restoreDesignMsg) restoreDesignMsg.textContent = "";
  restoreDesignModal.hidden = false;
  restoreDesignIdInput?.focus();
}

function closeRestoreDesignModal() {
  if (!restoreDesignModal) return;
  restoreDesignModal.hidden = true;
}

function makeDesignId() {
  return `D-${Math.floor(100000 + Math.random() * 900000)}`;
}

function saveDesignLocal() {
  try {
    const id = makeDesignId();
    const map = readSavedDesignsMap();
    map[id] = {
      id,
      createdAt: new Date().toISOString(),
      payload: serializeCurrentDesign(),
    };
    if (!writeSavedDesignsMap(map)) {
      setSaveStatus("שמירה נכשלה");
      return;
    }
    state.savedDesignAt = new Date().toISOString();
    const link = designShareLink(id);
    openSaveDesignModal({ designId: id, link });
    setSaveStatus("העיצוב נשמר בהצלחה");
  } catch {
    setSaveStatus("שמירה נכשלה");
  }
}

function restoreSavedDesignById(designIdRaw) {
  const id = String(designIdRaw || "").trim().toUpperCase();
  if (!id) return { ok: false, message: "צריך להזין מזהה עיצוב." };
  const map = readSavedDesignsMap();
  const entry = map[id];
  if (!entry?.payload) return { ok: false, message: "לא נמצא עיצוב עם המזהה הזה." };
  const ok = applyDesignPayload(entry.payload);
  if (!ok) return { ok: false, message: "טעינת העיצוב נכשלה." };
  return { ok: true, message: "העיצוב נטען בהצלחה." };
}

function openDesignAssistModal() {
  if (!designAssistModal) return;
  designAssistModal.hidden = false;
  if (assistSuggestionText) assistSuggestionText.textContent = "";
  if (designAssistGenerateBtn) {
    designAssistGenerateBtn.textContent = "הצע טקסט חריטה";
    designAssistGenerateBtn.classList.remove("is-retry");
  }
}

function closeDesignAssistModal() {
  if (!designAssistModal) return;
  designAssistModal.hidden = true;
}

function generateAssistSuggestion() {
  const recipient = String(assistRecipientInput?.value || "").trim();
  const style = String(assistStyleSelect?.value || "romantic");
  const presets = {
    romantic: [`אהבה לנצח, ${recipient || "שלי"}`, `הלב שלי איתך תמיד`, `כל יום איתך הוא מתנה`],
    minimal: [`תמיד יחד`, `שלך באהבה`, `לך ולי`],
    bold: [`נולדת לבלוט`, `לב גדול, נוכחות גדולה`, `אחד ויחיד`],
    classic: [`באהבה ובהערכה`, `לנצח שלך`, `בזכותך הכל יפה יותר`],
    luxury: [`שלמות בפרטים הקטנים`, `נצח עטוף בזהב`, `אלגנטיות עם משמעות`],
    playful: [`חיוך קטן, אהבה גדולה`, `את.ה המתנה שלי`, `לב שמח תמיד`],
  };
  const options = presets[style]?.length ? presets[style] : presets.romantic;
  const current = String(assistSuggestionText?.dataset.lastSuggestion || "");
  const next = options.find((s) => s !== current) || options[0];
  const suggestion = next;
  if (assistSuggestionText) assistSuggestionText.dataset.lastSuggestion = suggestion;
  if (assistSuggestionText) assistSuggestionText.textContent = `הצעה: ${suggestion}`;
  if (state.customization.textBlocks[0]) {
    state.customization.textBlocks[0].text = suggestion;
    state.customization.text = suggestion;
  }
  if (designAssistGenerateBtn) {
    designAssistGenerateBtn.textContent = "נסה שוב";
    designAssistGenerateBtn.classList.add("is-retry");
  }
  syncFormDefaults();
  updatePreview();
  updatePricingUI();
}

function renderOptionRows() {
  $("#materials").innerHTML = MATERIAL_OPTIONS.map((m) => {
    const swatch = m.id === "gold" ? "#d4af37" : m.id === "silver" ? "#c0c0c0" : m.id === "black-matte" ? "#2a2a2a" : "#d4a5a0";
    const dark = m.id === "black-matte";
    return `<button class="opt-btn material-btn ${dark ? "material-btn--dark" : ""} ${state.customization.materialId === m.id ? "active" : ""}" data-material="${m.id}" style="--mat:${swatch}">${m.label}</button>`;
  }).join("");
}

function renderEmojiBlocks() {
  const pickerWasOpen = emojiPickerEl.classList.contains("open");
  const pickerTarget = state.emojiPickerTargetId;
  const pickerEmojis = ["😀", "😍", "🎁", "✨", "💖", "🔥", "🙏", "💍"];
  emojiPickerEl.innerHTML = pickerEmojis
    .map((em) => `<button type="button" class="opt-btn emoji-btn" data-emoji="${em}">${em}</button>`)
    .join("");
  if (!emojiBlocksEl) return;
  const c = state.customization;
  emojiBlocksEl.innerHTML = c.emojiBlocks
    .map(
      (eb, index) => `
      <div class="emoji-block-card" data-emoji-row="${eb.id}">
        <div class="emoji-block-head">
          <span>סימן ${index + 1}</span>
          <button type="button" class="remove-block-btn" data-remove-emoji-block="${eb.id}" aria-label="מחק סימן">×</button>
        </div>
        <div class="emoji-block-current">${escHtml(eb.symbol)}</div>
        <div class="emoji-symbol-row">
          ${ICON_OPTIONS.map(
            (sym) =>
              `<button type="button" class="opt-btn emoji-symbol-btn ${eb.symbol === sym ? "active" : ""}" data-pick-symbol-for="${eb.id}">${escHtml(sym)}</button>`
          ).join("")}
          <button type="button" class="opt-btn emoji-symbol-btn" data-open-emoji-picker-for="${eb.id}" aria-label="בחר אימוג׳י">🙂</button>
        </div>
      </div>`
    )
    .join("");
  const targetStillExists = pickerTarget && c.emojiBlocks.some((e) => e.id === pickerTarget);
  if (pickerWasOpen && targetStillExists) {
    emojiPickerEl.classList.add("open");
  } else {
    emojiPickerEl.classList.remove("open");
    if (!targetStillExists) state.emojiPickerTargetId = null;
  }
}

function renderTextBlocks() {
  const canRemoveText = state.customization.textBlocks.length > 1;
  textBlocksEl.innerHTML = state.customization.textBlocks
    .map(
      (b, index) => `
      <div class="text-block-card">
        <div class="text-block-head">
          <span>טקסט ${index + 1}</span>
          ${
            canRemoveText
              ? `<button type="button" class="remove-block-btn" data-remove-text-block="${b.id}" aria-label="מחק שורת טקסט">×</button>`
              : ""
          }
        </div>
        <div class="form-grid text-block-fields">
          <label class="text-block-content-label">תוכן
            <input data-text-block-id="${b.id}" data-field="text" maxlength="40" value="${b.text}" />
          </label>
        </div>
      </div>`
    )
    .join("");
}

function renderCheckoutFields() {
  const fields = [
    ["fullName", "שם מלא"], ["phone", "טלפון"], ["email", "אימייל"], ["city", "עיר"],
    ["address", "רחוב"], ["house", "מספר בית"], ["aptFloor", "קומה / דירה"], ["zip", "מיקוד"], ["deliveryNotes", "הערות לשליח"],
  ];
  const requiredFields = new Set(["fullName", "phone", "email", "city", "address", "house"]);
  $("#checkoutFields").innerHTML = fields
    .map(([k, l]) => {
      const key = String(k);
      const hasError = Boolean(state.checkoutErrors?.[key]);
      const requiredMark = requiredFields.has(key) ? '<span class="required-mark">*</span>' : "";
      return `<label class="${hasError ? "checkout-field-invalid" : ""}">${l}${requiredMark}${
        key === "deliveryNotes"
          ? `<textarea data-checkout="${key}">${state.checkout[key]}</textarea>`
          : `<input data-checkout="${key}" value="${state.checkout[key]}" />`
      }${hasError ? `<div class="field-error">${state.checkoutErrors[key]}</div>` : ""}</label>`;
    })
    .join("") +
    (state.checkoutGlobalError ? `<div class="checkout-form-error">${state.checkoutGlobalError}</div>` : "");
}

function validateCheckoutBeforePayment() {
  const errors = {};
  const required = {
    fullName: "יש להזין שם מלא",
    phone: "יש להזין טלפון",
    email: "יש להזין אימייל",
    city: "יש להזין עיר",
    address: "יש להזין רחוב",
    house: "יש להזין מספר בית",
  };
  Object.entries(required).forEach(([field, msg]) => {
    if (!String(state.checkout[field] || "").trim()) errors[field] = msg;
  });
  const email = String(state.checkout.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "יש להזין אימייל תקין";
  }
  state.checkoutErrors = errors;
  state.checkoutGlobalError = Object.keys(errors).length ? "נדרש למלא את כל שדות החובה לפני מעבר לתשלום." : "";
  renderCheckoutFields();
  return Object.keys(errors).length === 0;
}

function renderShippingMethods() {
  $("#shippingMethods").innerHTML = SHIPPING_METHODS.map(
    (s) => `<button type="button" class="ship-card ${state.checkout.shippingId === s.id ? "active" : ""}" data-ship="${s.id}">
      <strong>${s.label}</strong><div class="ship-card-meta">${formatShippingFeeDisplay(s.fee)} · ${s.eta}</div></button>`
  ).join("");
}

function syncFormDefaults() {
  fontSelect.innerHTML = FONT_OPTIONS.map((f) => `<option value="${f.id}" ${f.id === state.customization.fontId ? "selected" : ""}>${f.label}</option>`).join("");
  fontSelect.value = state.customization.fontId;
  textSize.value = String(state.customization.size);
  qtyInput.value = String(state.customization.qty);
  notesInput.value = state.customization.notes;
  renderTextBlocks();
  renderEmojiBlocks();
}

function debounceCommitText() {
  clearTimeout(state.typingTimer);
  state.typingTimer = setTimeout(() => {
    state.customization.text = state.draftText;
    updatePreview();
    updatePricingUI();
  }, 220);
}

function setupEvents() {
  const dragState = { active: false, x: 0, y: 0 };
  const previewDrag = {
    active: false,
    id: null,
    startX: 0,
    startY: 0,
    origXPct: 50,
    origYPct: 50,
    pointerId: null,
  };
  let recenterTimer = null;
  const scheduleRecenter = () => {
    clearTimeout(recenterTimer);
    recenterTimer = setTimeout(() => {
      state.dragRotateY = 0;
      state.dragRotateX = 0;
      updatePreview();
    }, 2000);
  };

  stageEl?.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".mock-drag")) return;
    // Do not start stage-drag when interacting with preview controls.
    if (e.target.closest(".stage-top-controls, .engrave-switch, .pendant-shape-dev, .viewer-actions, button, select, input, label")) return;
    dragState.active = true;
    dragState.x = e.clientX;
    dragState.y = e.clientY;
    stageEl.classList.add("is-dragging");
    stageEl.setPointerCapture?.(e.pointerId);
  });

  mockProductEl?.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".mock-drag");
    if (!el) return;
    e.stopPropagation();
    dragState.active = false;
    stageEl?.classList.remove("is-dragging");

    previewDrag.active = true;
    previewDrag.id = el.dataset.dragId;
    previewDrag.startX = e.clientX;
    previewDrag.startY = e.clientY;
    ensurePreviewOffsets();
    const key = previewDrag.id;
    const cur = normalizeOff(state.customization.previewOffsets[key]);
    state.customization.previewOffsets[key] = cur;
    previewDrag.origXPct = cur.xPct;
    previewDrag.origYPct = cur.yPct;
    previewDrag.pointerId = e.pointerId;
    el.setPointerCapture(e.pointerId);
  });

  window.addEventListener("pointermove", (e) => {
    if (previewDrag.active && e.pointerId === previewDrag.pointerId) {
      const rect = mockEngraveSurfaceEl?.getBoundingClientRect();
      if (!rect?.width || !rect.height) return;
      const dx = e.clientX - previewDrag.startX;
      const dy = e.clientY - previewDrag.startY;
      const key = previewDrag.id;
      const dXPct = (dx / rect.width) * 100;
      const dYPct = (dy / rect.height) * 100;
      const xPct = clampPctVal(previewDrag.origXPct + dXPct);
      const yPct = clampPctVal(previewDrag.origYPct + dYPct);
      state.customization.previewOffsets[key] = { xPct, yPct };
      const target = mockEngraveSurfaceEl?.querySelector(`[data-drag-id="${key}"]`);
      if (target) {
        target.style.left = `${xPct}%`;
        target.style.top = `${yPct}%`;
        target.style.transform = "translate(-50%, -50%)";
      }
      return;
    }
    if (!dragState.active) return;
    const dx = e.clientX - dragState.x;
    const dy = e.clientY - dragState.y;
    dragState.x = e.clientX;
    dragState.y = e.clientY;
    state.dragRotateY = Math.max(-28, Math.min(28, state.dragRotateY + dx * 0.18));
    state.dragRotateX = Math.max(-18, Math.min(18, state.dragRotateX - dy * 0.12));
    updatePreview();
    scheduleRecenter();
  });

  const endPreviewDrag = (e) => {
    if (!previewDrag.active || e.pointerId !== previewDrag.pointerId) return;
    previewDrag.active = false;
    previewDrag.id = null;
    previewDrag.pointerId = null;
    updatePreview();
  };

  window.addEventListener("pointerup", (e) => {
    if (previewDrag.active && e.pointerId === previewDrag.pointerId) {
      endPreviewDrag(e);
      return;
    }
    if (!dragState.active) return;
    dragState.active = false;
    stageEl?.classList.remove("is-dragging");
    scheduleRecenter();
  });

  window.addEventListener("pointercancel", (e) => {
    endPreviewDrag(e);
    if (dragState.active) {
      dragState.active = false;
      stageEl?.classList.remove("is-dragging");
      scheduleRecenter();
    }
  });

  walletMenuTrigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = Boolean(walletMenu?.hidden);
    setWalletMenuOpen(willOpen);
    if (willOpen) renderWalletMenuList();
  });

  walletMenu?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pay-method]");
    if (!btn) return;
    e.stopPropagation();
    state.checkout.paymentMethod = btn.dataset.payMethod;
    renderWalletPaymentUI();
    setWalletMenuOpen(false);
    updatePricingUI();
  });

  orderStatusLookupToggleBtn?.addEventListener("click", () => openOrderStatusLookup(state.placedOrderNumber || ""));
  orderStatusLookupFooterBtn?.addEventListener("click", () => openOrderStatusLookup(state.placedOrderNumber || ""));
  orderStatusLookupBtn?.addEventListener("click", () => {
    runOrderStatusLookup();
  });
  orderStatusLookupInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runOrderStatusLookup();
    }
  });

  document.body.addEventListener("click", (e) => {
    if (!e.target.closest(".wallet-menu-wrap")) setWalletMenuOpen(false);

    const chip = e.target.closest("[data-category-chip]");
    if (chip && state.step === 0) {
      clearCouponOnCartChange();
      state.activeCategoryId = chip.dataset.categoryChip;
      state.activeSubcategory = "";
      state.userPickedCategory = true;
      renderCategoryChips();
      const firstInCategory = runtimeItems.find((p) => p.category === state.activeCategoryId);
      if (firstInCategory) state.selectedProductId = firstInCategory.id;
      renderCatalogSections();
      updatePricingUI();
      return;
    }

    const subChip = e.target.closest("[data-subcategory-chip]");
    if (subChip && state.step === 0) {
      clearCouponOnCartChange();
      state.activeSubcategory = subChip.dataset.subcategoryChip || "";
      renderCategoryChips();
      renderCatalogSections();
      updatePricingUI();
      return;
    }

    const swatchBtn = e.target.closest("[data-swatch-product]");
    if (swatchBtn && state.step === 0) {
      const productId = swatchBtn.dataset.swatchProduct;
      const variantIndex = Number(swatchBtn.dataset.swatchIndex);
      state.selectedVariantByProduct[productId] = variantIndex;
      renderCatalogSections();
      if (state.selectedProductId === productId) {
        renderCustomerUploadBox();
        syncPreviewGalleryFromSelectedVariant();
        updatePricingUI();
        if (state.step === 1) updatePreview();
      }
      return;
    }

    const navBtn = e.target.closest("[data-row-nav]");
    if (navBtn) {
      const direction = navBtn.dataset.rowNav;
      const row = navBtn.parentElement?.querySelector(".catalog-row");
      if (!row) return;
      const cards = [...row.querySelectorAll(".product-card")];
      const cardsCount = cards.length;
      if (!cardsCount) return;
      const firstCard = cards[0];
      const step = firstCard ? firstCard.getBoundingClientRect().width + 12 : 240;
      const visibleCount = Math.max(1, Math.floor(row.clientWidth / step));
      const maxIndex = Math.max(0, cardsCount - visibleCount);
      let currentIndex = Number(row.dataset.index || "0");

      if (direction === "next") {
        currentIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
      } else {
        currentIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
      }

      row.dataset.index = String(currentIndex);
      cards[currentIndex].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
      return;
    }

    const productCard = e.target.closest("[data-product]");
    if (productCard && state.step === 0) {
      clearCouponOnCartChange();
      state.selectedProductId = productCard.dataset.product;
      const pv = runtimeItems.find((x) => x.id === state.selectedProductId);
      if (pv) trackProductView(pv.id, pv.title);
      if (!pv?.allowCustomerImageUpload) state.customization.customerUpload = null;
      renderCustomerUploadBox();
      renderCatalogSections();
      const selected = catalogSectionsEl.querySelector(`[data-product="${state.selectedProductId}"]`);
      if (selected) selected.classList.add("picked");
      clearTimeout(state.selectionTimer);
      state.selectionTimer = setTimeout(() => goToStep(1), 280);
      updatePricingUI();
    }

    const rmText = e.target.closest("[data-remove-text-block]");
    if (rmText) {
      if (state.customization.textBlocks.length > 1) {
        const tid = rmText.dataset.removeTextBlock;
        state.customization.textBlocks = state.customization.textBlocks.filter((b) => b.id !== tid);
        delete state.customization.previewOffsets[tid];
        state.draftText = state.customization.textBlocks[0]?.text || "";
        state.customization.text = state.customization.textBlocks[0]?.text || "";
        renderTextBlocks();
        redistributeTextLinesVertical();
        updatePreview();
        updatePricingUI();
      }
      return;
    }

    const rmEmoji = e.target.closest("[data-remove-emoji-block]");
    if (rmEmoji) {
      const eid = rmEmoji.dataset.removeEmojiBlock;
      state.customization.emojiBlocks = state.customization.emojiBlocks.filter((x) => x.id !== eid);
      delete state.customization.previewOffsets[eid];
      if (state.emojiPickerTargetId === eid) {
        state.emojiPickerTargetId = null;
        emojiPickerEl.classList.remove("open");
      }
      renderEmojiBlocks();
      updatePreview();
      return;
    }

    const pickSym = e.target.closest("[data-pick-symbol-for]");
    if (pickSym) {
      const bid = pickSym.dataset.pickSymbolFor;
      const blk = state.customization.emojiBlocks.find((x) => x.id === bid);
      if (blk) blk.symbol = pickSym.textContent.trim() || blk.symbol;
      renderEmojiBlocks();
      updatePreview();
      return;
    }

    const openEmojiFor = e.target.closest("[data-open-emoji-picker-for]");
    if (openEmojiFor) {
      const bid = openEmojiFor.dataset.openEmojiPickerFor;
      if (emojiPickerEl.classList.contains("open") && state.emojiPickerTargetId === bid) {
        emojiPickerEl.classList.remove("open");
        state.emojiPickerTargetId = null;
      } else {
        state.emojiPickerTargetId = bid;
        emojiPickerEl.classList.add("open");
      }
      return;
    }

    const emojiPickBtn = e.target.closest("[data-emoji]");
    if (emojiPickBtn && emojiPickerEl.contains(emojiPickBtn)) {
      const targetId = state.emojiPickerTargetId;
      if (targetId) {
        const blk = state.customization.emojiBlocks.find((x) => x.id === targetId);
        if (blk) blk.symbol = emojiPickBtn.dataset.emoji || blk.symbol;
      }
      emojiPickerEl.classList.remove("open");
      state.emojiPickerTargetId = null;
      renderEmojiBlocks();
      updatePreview();
      return;
    }

    const galThumb = e.target.closest("[data-gallery-index]");
    if (galThumb && previewGalleryEl?.contains(galThumb)) {
      state.previewGalleryIndex = Number(galThumb.dataset.galleryIndex) || 0;
      syncVariantFromGallerySelection();
      updatePreview();
      updatePricingUI();
      return;
    }
    const galNav = e.target.closest("[data-gallery-nav]");
    if (galNav && previewGalleryEl?.contains(galNav)) {
      if (galNav.disabled) return;
      const urls = currentProductGalleryUrls();
      if (urls.length <= 1) return;
      const n = urls.length;
      if (galNav.dataset.galleryNav === "next") state.previewGalleryIndex += 1;
      else state.previewGalleryIndex -= 1;
      state.previewGalleryIndex = ((state.previewGalleryIndex % n) + n) % n;
      syncVariantFromGallerySelection();
      updatePreview();
      updatePricingUI();
      return;
    }

    const matBtn = e.target.closest("[data-material]");
    if (matBtn) { state.customization.materialId = matBtn.dataset.material; renderOptionRows(); updatePreview(); }
    const shipBtn = e.target.closest("[data-ship]");
    if (shipBtn) {
      clearCouponOnCartChange();
      state.checkout.shippingId = shipBtn.dataset.ship;
      renderShippingMethods();
      updatePricingUI();
    }

    if (e.target.matches('[data-action="back"]')) goToStep(state.step - 1);
    if (e.target.matches('[data-action="next"]')) {
      if (state.step === 2) {
        const demoOrder = buildStudioDemoOrderPayload();
        const isCheckoutValid = validateCheckoutBeforePayment();
        if (!demoOrder || !isCheckoutValid) {
          return;
        }
        state.processing = true;
        nextBtn.disabled = true;
        nextBtn.textContent = "מסיים הזמנה...";
        (async () => {
          try {
            appendStudioDemoOrder(demoOrder);
            state.placedOrderNumber = demoOrder.orderNumber || null;
            if (orderStatusLookupInput && state.placedOrderNumber) {
              orderStatusLookupInput.value = state.placedOrderNumber;
            }
            goToStep(3);
            updatePricingUI();
          } catch (err) {
            state.checkoutGlobalError = "לא ניתן לסיים הזמנה כרגע. נסה שוב בעוד רגע.";
            renderCheckoutFields();
          } finally {
            state.processing = false;
            nextBtn.disabled = false;
            renderNav();
          }
        })();
      } else {
        goToStep(state.step + 1);
      }
    }
    if (e.target.matches('[data-action="restart"]')) {
      state.placedOrderNumber = null;
      state.couponApplied = null;
      renderCouponBox();
      goToStep(0);
    }

    if (e.target.matches('[data-action="apply-coupon"]')) {
      e.preventDefault();
      applyCouponFromUi();
    }
    if (e.target.matches('[data-action="remove-coupon"]')) {
      e.preventDefault();
      removeCoupon();
    }
  });

  addTextBlockBtn?.addEventListener("click", () => {
    const id = `t${state.customization.textBlocks.length + 1}`;
    state.customization.textBlocks.push({ id, text: "" });
    ensurePreviewOffsets();
    renderTextBlocks();
    updatePreview();
  });

  addEmojiBlockBtn?.addEventListener("click", () => {
    const id = nextEmojiBlockId();
    const i = state.customization.emojiBlocks.length;
    state.customization.emojiBlocks.push({ id, symbol: ICON_OPTIONS[0] });
    const d = defaultEmojiPct(i);
    state.customization.previewOffsets[id] = { xPct: d.xPct, yPct: d.yPct };
    renderEmojiBlocks();
    updatePreview();
  });

  textBlocksEl?.addEventListener("input", (e) => {
    const id = e.target.dataset.textBlockId;
    const field = e.target.dataset.field;
    if (!id || !field) return;
    const block = state.customization.textBlocks.find((b) => b.id === id);
    if (!block) return;
    const prevVal = block[field];
    block[field] = e.target.value;
    if (field === "text") {
      const had = String(prevVal).trim();
      const has = String(block.text).trim();
      if (had !== has) redistributeTextLinesVertical();
    }
    state.draftText = state.customization.textBlocks[0]?.text || "";
    state.customization.text = state.customization.textBlocks[0]?.text || "";
    debounceCommitText();
  });

  textBlocksEl?.addEventListener("change", (e) => {
    const id = e.target.dataset.textBlockId;
    const field = e.target.dataset.field;
    if (!id || !field) return;
    const block = state.customization.textBlocks.find((b) => b.id === id);
    if (!block) return;
    block[field] = e.target.value;
    updatePreview();
  });

  fontSelect.addEventListener("change", (e) => { state.customization.fontId = e.target.value; updatePreview(); });
  textSize.addEventListener("input", (e) => { state.customization.size = Number(e.target.value); updatePreview(); });
  qtyInput.addEventListener("input", (e) => {
    clearCouponOnCartChange();
    state.customization.qty = Math.max(1, Number(e.target.value) || 1);
    updatePricingUI();
  });
  notesInput.addEventListener("input", (e) => { state.customization.notes = e.target.value; });

  previewModeSwitch?.addEventListener("change", () => {
    setPreviewMode(previewModeSwitch.checked ? "after" : "before");
  });
  pendantShapeDevSelect?.addEventListener("change", (e) => {
    state.pendantShapeOverride = String(e.target.value || "");
    updatePreview();
  });

  saveDesignBtn?.addEventListener("click", () => saveDesignLocal());
  restoreDesignBtn?.addEventListener("click", openRestoreDesignModal);

  designAssistFab?.addEventListener("click", openDesignAssistModal);
  designAssistGenerateBtn?.addEventListener("click", generateAssistSuggestion);
  restoreDesignConfirmBtn?.addEventListener("click", () => {
    const result = restoreSavedDesignById(restoreDesignIdInput?.value || "");
    if (restoreDesignMsg) restoreDesignMsg.textContent = result.message;
    setSaveStatus(result.message);
    if (result.ok) closeRestoreDesignModal();
  });
  copySavedDesignLinkBtn?.addEventListener("click", async () => {
    const link = String(savedDesignLinkInput?.value || "");
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setSaveStatus("הקישור הועתק");
    } catch {
      setSaveStatus("לא הצלחתי להעתיק, אפשר להעתיק ידנית");
    }
  });
  designAssistModal?.addEventListener("click", (e) => {
    if (e.target.closest('[data-modal-close="design-assist"]')) closeDesignAssistModal();
  });
  saveDesignModal?.addEventListener("click", (e) => {
    if (e.target.closest('[data-modal-close="save-design"]')) closeSaveDesignModal();
  });
  restoreDesignModal?.addEventListener("click", (e) => {
    if (e.target.closest('[data-modal-close="restore-design"]')) closeRestoreDesignModal();
  });

  giftModeToggle?.addEventListener("change", (e) => {
    state.customization.giftMode = !!e.target.checked;
    if (state.customization.giftMode && !String(state.customization.giftNote || "").trim()) {
      state.customization.giftNote = suggestedGiftNoteByStyle(state.customization.giftCardStyle);
    }
    renderGiftModeUI();
    updatePricingUI();
  });
  giftNoteInput?.addEventListener("input", (e) => {
    state.customization.giftNote = String(e.target.value || "");
  });
  giftCardStyleRow?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-gift-card-style]");
    if (!btn) return;
    state.customization.giftCardStyle = btn.dataset.giftCardStyle || "classic";
    state.customization.giftNote = suggestedGiftNoteByStyle(state.customization.giftCardStyle);
    renderGiftModeUI();
  });
  rotateEngraveBtn?.addEventListener("pointerdown", (e) => {
    // Keep the UI stable: avoid browser focus-scroll jumps on pointer clicks.
    e.preventDefault();
    e.stopPropagation();
  });
  rotateEngraveBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const prevX = window.scrollX;
    const prevY = window.scrollY;
    const cur = ((Number(state.customization.textRotation) || 0) % 360 + 360) % 360;
    state.customization.textRotation = (cur + 90) % 360;
    renderRotateUi();
    updatePreview();
    // Some browsers scroll the focused control into view; keep scroll position stable.
    requestAnimationFrame(() => {
      window.scrollTo(prevX, prevY);
    });
    try {
      rotateEngraveBtn.blur({ preventScroll: true });
    } catch {
      rotateEngraveBtn.blur();
    }
  });

  document.body.addEventListener("input", (e) => {
    const field = e.target.dataset.checkout;
    if (field) {
      state.checkout[field] = e.target.value;
      if (state.checkoutErrors?.[field]) {
        delete state.checkoutErrors[field];
      }
      if (state.checkoutGlobalError) state.checkoutGlobalError = "";
      renderCheckoutFields();
    }
  });
}

function normalizeStudioWhatsappDigits(value) {
  let raw = String(value || "").replace(/\D/g, "");
  if (!raw) return null;
  if (raw.startsWith("972")) return raw;
  if (raw.startsWith("0")) return "972" + raw.slice(1);
  if (raw.length >= 9) return "972" + raw;
  return raw;
}

function applyStudioWhatsappButton(digits) {
  const d = digits || DEFAULT_STUDIO_WHATSAPP;
  state.whatsappPhone = d;
  if (studioWhatsappBtn) {
    studioWhatsappBtn.href = `https://wa.me/${d}`;
    studioWhatsappBtn.hidden = false;
  }
}

async function loadSiteMeta() {
  let fromApi = null;
  const bases = buildApiBases();
  for (const base of bases) {
    try {
      const res = await fetchWithTimeout(`${base}/api/public/site`, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const j = await res.json();
      fromApi = normalizeStudioWhatsappDigits(j.whatsapp);
      if (fromApi) break;
    } catch {
      /* next base */
    }
  }
  applyStudioWhatsappButton(fromApi || DEFAULT_STUDIO_WHATSAPP);
}

async function init() {
  const qs = new URLSearchParams(window.location.search);
  const openStatusLookupFromLanding = qs.get("status") === "1";
  const designIdFromLink = String(qs.get("design") || "").trim().toUpperCase();
  initMarketingBeacon({ context: "studio" });
  await Promise.all([loadProductsFromDatabase(), loadSiteMeta()]);
  state.selectedVariantByProduct = Object.fromEntries(runtimeItems.map((p) => [p.id, 0]));
  const firstCategoryWithItems = runtimeCategories.find((c) => runtimeItems.some((p) => p.category === c.id));
  state.activeCategoryId = firstCategoryWithItems?.id || runtimeCategories[0]?.id || state.activeCategoryId;
  state.selectedProductId =
    runtimeItems.find((p) => p.category === state.activeCategoryId)?.id || runtimeItems[0]?.id || state.selectedProductId;

  migrateCustomizationLayout();
  renderProgress();
  renderNav();
  renderCategoryChips();
  renderCatalogSections();
  renderOptionRows();
  renderCheckoutFields();
  renderShippingMethods();
  renderWalletPaymentUI();
  syncFormDefaults();
  renderGiftModeUI();
  renderRotateUi();
  renderCustomerUploadBox();
  ensurePreviewOffsets();
  redistributeTextLinesVertical();
  setPreviewMode(state.previewMode);
  updatePreview();
  updatePricingUI();
  setupEvents();
  renderCouponBox();
  setSaveStatus("");
  if (designIdFromLink) {
    const result = restoreSavedDesignById(designIdFromLink);
    setSaveStatus(result.ok ? `נטען עיצוב ${designIdFromLink}` : "לא נמצא עיצוב מהקישור");
  }
  if (openStatusLookupFromLanding) {
    goToStep(3);
    openOrderStatusLookup("");
  }
}

init();
