import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { StudioCategoryId, StudioSubcategory } from "../constants/studioData";
import { getApiBaseUrl } from "../lib/apiBase";
import {
  studioCategories,
  studioFonts,
  studioMaterials,
  studioPayments,
  studioShippingMethods
} from "../constants/studioData";

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
};

type PublicProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  images: string[];
  studioCategory: StudioCategoryId;
  subcategoryLabel: string | null;
  subcategoryLabels?: string[];
  studioColors: string[];
  stock: number;
  variants?: PublicVariant[];
};

type StudioRuntimeProduct = {
  id: string;
  category: StudioCategoryId;
  subcategory: StudioSubcategory;
  title: string;
  description: string;
  price: number;
  image: string | null;
  colors: { name: string; swatch: string; variantId?: string; stock: number; pendantType?: string | null; material?: string | null; price: number }[];
  totalStock: number;
};

const COLOR_META: Record<string, { name: string; swatch: string }> = {
  gold: { name: "זהב", swatch: "#d4af37" },
  silver: { name: "כסף", swatch: "#c0c0c0" },
  rose: { name: "רוז גולד", swatch: "#d4a5a0" },
  black: { name: "שחור", swatch: "#2a2a2a" }
};

const DEFAULT_STUDIO_CATEGORY_ORDER: StudioCategoryId[] = studioCategories.map((c) => c.id);

function normalizeCategoryKey(raw: string) {
  const v = String(raw || "").trim().toLowerCase();
  if (v.includes("זוג") || v.includes("couple")) return "couple";
  if (v.includes("bracelet") || v.includes("צמיד")) return "bracelets";
  if (v.includes("necklace") || v.includes("שרשר")) return "necklaces";
  if (v.includes("key") || v.includes("מחזיק")) return "keychains";
  if (v.includes("other") || v.includes("אחר")) return "other";
  return v;
}

function inferSubcategoryFromTexts(texts: string[]): StudioSubcategory {
  const t = texts.join(" ").toLowerCase();
  if (t.includes("זוג") || t.includes("couple")) return "couple";
  if (t.includes("נשים") || t.includes("אישה") || t.includes("women") || t.includes("woman")) return "women";
  if (t.includes("גברים") || t.includes("גבר") || t.includes("men") || t.includes("man")) return "men";
  return null;
}

const StudioPage = ({ onBackToLanding }: StudioPageProps) => {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<string>("bracelets");
  const [categoryOrder, setCategoryOrder] = useState<Array<StudioCategoryId | string>>(DEFAULT_STUDIO_CATEGORY_ORDER);
  const [runtimeProducts, setRuntimeProducts] = useState<StudioRuntimeProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productId, setProductId] = useState<string>("");
  const [selectedColorByProduct, setSelectedColorByProduct] = useState<Record<string, number>>({});

  const [text, setText] = useState("לנצח שלך");
  const [font, setFont] = useState("heebo");
  const [material, setMaterial] = useState("gold");
  const [size, setSize] = useState(28);
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
  const [customer, setCustomer] = useState({
    fullName: "",
    phone: "",
    email: "",
    city: "",
    address: ""
  });
  const apiBase = getApiBaseUrl();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [res, bootstrapRes] = await Promise.all([
          fetch(`${apiBase}/api/public/products`, { credentials: "include" }),
          fetch(`${apiBase}/api/content/bootstrap`, { credentials: "include" }),
        ]);
        if (!res.ok) throw new Error("public-products");
        const data = (await res.json()) as { products?: PublicProduct[] };
        const bootstrap = bootstrapRes.ok ? ((await bootstrapRes.json()) as { sections?: Array<{ key: string; body: any }> }) : null;
        const topSellerSection = (bootstrap?.sections ?? []).find((s) => s.key === "top_sellers_section");
        const rawOrder = Array.isArray(topSellerSection?.body?.categoryOrder) ? topSellerSection?.body?.categoryOrder : DEFAULT_STUDIO_CATEGORY_ORDER;
        const ordered = rawOrder.map((x: any) => (typeof x === "string" ? x : String(x?.id || ""))).filter(Boolean);
        const rows = Array.isArray(data.products) ? data.products : [];
        const mapped: StudioRuntimeProduct[] = rows.map((p) => {
          const variants = Array.isArray(p.variants) ? p.variants : [];
          const colors =
            variants.length > 0
              ? variants.map((v) => {
                  const key = p.studioColors.find((c) => {
                    const mappedColor = COLOR_META[c]?.name.toLowerCase();
                    return mappedColor ? mappedColor === String(v.color ?? "").toLowerCase() : false;
                  }) ?? p.studioColors[0] ?? "gold";
                  const meta = COLOR_META[key] ?? { name: v.color || "ברירת מחדל", swatch: "#c0c0c0" };
                  return {
                    name: v.color || meta.name,
                    swatch: meta.swatch,
                    variantId: v.id,
                    stock: Number(v.stock) || 0,
                    pendantType: v.pendantType ?? null,
                    material: v.material ?? null,
                    price: Number(v.price) || Number(p.price) || 0
                  };
                })
              : (p.studioColors.length ? p.studioColors : ["gold"]).map((key) => {
                  const meta = COLOR_META[key] ?? { name: key, swatch: "#c0c0c0" };
                  return { name: meta.name, swatch: meta.swatch, stock: Number(p.stock) || 0, price: Number(p.price) || 0 };
                });
          return {
            id: p.id,
            category: p.studioCategory,
            subcategory: inferSubcategoryFromTexts([
              p.subcategoryLabel ?? "",
              ...(Array.isArray(p.subcategoryLabels) ? p.subcategoryLabels : []),
              p.name ?? "",
              p.description ?? "",
            ]),
            title: p.name,
            description: p.description || "",
            price: Number(p.price) || 0,
            image: p.image ?? p.images?.[0] ?? null,
            colors,
            totalStock: Number(p.stock) || 0
          };
        });
        if (!mounted) return;
        setCategoryOrder(ordered);
        if (ordered.length > 0) {
          setCategory((prev) => (ordered.includes(prev) ? prev : ordered[0]));
        }
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

  const activeProduct = useMemo(() => {
    if (runtimeProducts.length === 0) return null;
    return runtimeProducts.find((p) => p.id === productId) ?? runtimeProducts[0];
  }, [productId, runtimeProducts]);
  const activeColor = activeProduct
    ? activeProduct.colors[selectedColorByProduct[activeProduct.id] ?? 0] ?? activeProduct.colors[0]
    : null;

  const filteredProducts = useMemo(() => {
    const normalized = normalizeCategoryKey(category);
    return runtimeProducts.filter((p) => {
      if (normalized === "couple") {
        return p.subcategory === "couple";
      }
      if (normalizeCategoryKey(p.category) !== normalized) return false;
      return true;
    });
  }, [category, runtimeProducts]);

  const groupedProducts = useMemo(() => {
    const men = filteredProducts.filter((p) => p.subcategory === "men");
    const women = filteredProducts.filter((p) => p.subcategory === "women");
    const couple = filteredProducts.filter((p) => p.subcategory === "couple");
    const others = filteredProducts.filter((p) => p.subcategory !== "men" && p.subcategory !== "women" && p.subcategory !== "couple");
    return { men, women, couple, others };
  }, [filteredProducts]);

  const shipping = studioShippingMethods.find((s) => s.id === shippingId) ?? studioShippingMethods[0];
  const subtotal = (activeColor?.price ?? activeProduct?.price ?? 0) * qty;
  const discount = appliedCoupon?.discountAmount ?? 0;
  const effectiveShippingFee = appliedCoupon?.freeShipping ? 0 : shipping.fee;
  const total = Math.max(0, subtotal + effectiveShippingFee - discount);
  const canPurchase = Boolean(activeProduct && activeColor && activeColor.stock > 0 && activeProduct.totalStock > 0);

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
          customerEmail: customer.email || null
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

  async function submitOrder() {
    if (submitting) return;
    if (!activeProduct || !activeColor) {
      setCouponMsg("לא נבחר מוצר תקין");
      return;
    }
    if (activeColor.stock <= 0 || activeProduct.totalStock <= 0) {
      setCouponMsg("המוצר שנבחר אזל מהמלאי");
      return;
    }
    if (!customer.fullName.trim() || !customer.phone.trim() || !customer.email.trim()) {
      setCouponMsg("נא למלא שם מלא, טלפון ואימייל לפני תשלום");
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
              variantId: activeColor.variantId ?? null,
              qty,
              unitPrice: Math.round((activeColor.price ?? activeProduct.price) * 100),
              color: activeColor.name,
              pendantShape: activeColor.pendantType ?? null,
              material: activeColor.material ?? null
            }
          ]
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setCouponMsg(data?.message || "הזמנה נכשלה");
        return;
      }
      setOrderNumber(data.order.orderNumber);
      setStep(3);
    } catch {
      setCouponMsg("לא ניתן להשלים הזמנה כרגע");
    } finally {
      setSubmitting(false);
    }
  }

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
          <button
            type="button"
            className="studio-primary-btn studio-top-next"
            onClick={step === 2 ? submitOrder : goNext}
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
            {categoryOrder.map((catIdRaw) => {
              const catId = String(catIdRaw);
              const cat = studioCategories.find((x) => x.id === catId);
              const label = cat?.label ?? (normalizeCategoryKey(catId) === "couple" ? "זוגיים" : catId);
              return (
                <button
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

          <div className="studio-products-grid">
            {loadingProducts ? <p>טוען מוצרים...</p> : null}
            {!loadingProducts && filteredProducts.length === 0 ? <p>אין מוצרים זמינים כרגע בקטגוריה זו.</p> : null}
            {(["bracelets", "necklaces"].includes(normalizeCategoryKey(category))) && groupedProducts.men.length > 0 ? (
              <>
                <div className="studio-subsection-title">גברים</div>
                {groupedProducts.men.map((product) => {
                  const outOfStock = product.totalStock <= 0;
                  return (
                    <article
                      key={product.id}
                      className={`studio-product-card ${productId === product.id ? "selected" : ""} ${outOfStock ? "out-of-stock" : ""}`}
                      onClick={() => selectProductAndGoDesign(product.id)}
                    >
                      <span className="studio-product-category-label">
                        {studioCategories.find((c) => c.id === product.category)?.label ?? "קטגוריה"}
                      </span>
                      {outOfStock ? <span className="studio-stock-badge">אזל מהמלאי</span> : null}
                      <div className={`studio-product-thumb ${product.category}`}>
                        {product.image ? <img src={product.image} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
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
            {(["bracelets", "necklaces"].includes(normalizeCategoryKey(category))) && groupedProducts.women.length > 0 ? (
              <>
                <div className="studio-subsection-divider" />
                <div className="studio-subsection-title">נשים</div>
                {groupedProducts.women.map((product) => {
                  const outOfStock = product.totalStock <= 0;
                  return (
                    <article
                      key={product.id}
                      className={`studio-product-card ${productId === product.id ? "selected" : ""} ${outOfStock ? "out-of-stock" : ""}`}
                      onClick={() => selectProductAndGoDesign(product.id)}
                    >
                      <span className="studio-product-category-label">
                        {studioCategories.find((c) => c.id === product.category)?.label ?? "קטגוריה"}
                      </span>
                      {outOfStock ? <span className="studio-stock-badge">אזל מהמלאי</span> : null}
                      <div className={`studio-product-thumb ${product.category}`}>
                        {product.image ? <img src={product.image} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
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
            {(["bracelets", "necklaces"].includes(normalizeCategoryKey(category))) && groupedProducts.couple.length > 0 ? (
              <>
                <div className="studio-subsection-divider" />
                <div className="studio-subsection-title">זוגיים</div>
                {groupedProducts.couple.map((product) => {
                  const outOfStock = product.totalStock <= 0;
                  return (
                    <article
                      key={product.id}
                      className={`studio-product-card ${productId === product.id ? "selected" : ""} ${outOfStock ? "out-of-stock" : ""}`}
                      onClick={() => selectProductAndGoDesign(product.id)}
                    >
                      <span className="studio-product-category-label">
                        {studioCategories.find((c) => c.id === product.category)?.label ?? "קטגוריה"}
                      </span>
                      {outOfStock ? <span className="studio-stock-badge">אזל מהמלאי</span> : null}
                      <div className={`studio-product-thumb ${product.category}`}>
                        {product.image ? <img src={product.image} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
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
            {(!["bracelets", "necklaces"].includes(normalizeCategoryKey(category)) ? filteredProducts : groupedProducts.others).map((product) => {
              const outOfStock = product.totalStock <= 0;
              return (
                <article
                  key={product.id}
                  className={`studio-product-card ${productId === product.id ? "selected" : ""} ${outOfStock ? "out-of-stock" : ""}`}
                  onClick={() => selectProductAndGoDesign(product.id)}
                >
                  <span className="studio-product-category-label">
                    {studioCategories.find((c) => c.id === product.category)?.label ?? "קטגוריה"}
                  </span>
                  {outOfStock ? <span className="studio-stock-badge">אזל מהמלאי</span> : null}
                  <div className={`studio-product-thumb ${product.category}`}>
                    {product.image ? <img src={product.image} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
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
                טקסט לחריטה
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={28} />
              </label>
              <label>
                פונט
                <select value={font} onChange={(e) => setFont(e.target.value)}>
                  {studioFonts.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                גודל טקסט
                <input type="range" min={18} max={44} value={size} onChange={(e) => setSize(Number(e.target.value))} />
              </label>
              <div className="studio-chip-row">
                {studioMaterials.map((m) => (
                  <button
                    key={m.id}
                    className={`studio-chip material ${material === m.id ? "active" : ""}`}
                    style={{ ["--mat" as string]: m.color }}
                    onClick={() => setMaterial(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <label>
                כמות
                <input type="number" min={1} max={10} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
              </label>
              <label>
                הערות להזמנה
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="לדוגמה: אריזת מתנה, בקשות מיוחדות" />
              </label>
            </aside>

            <div className="studio-preview-panel">
              <div className="studio-preview-stage">
                <div
                  className={`studio-3d-object ${activeProduct?.category ?? "other"}`}
                  style={
                    {
                      transform: `rotateY(${rotation}deg) rotateX(8deg) scale(${zoom})`,
                      ["--engrave-size" as string]: `${size}px`,
                      ["--studio-metal" as string]: activeColor?.swatch ?? "#d4af37"
                    } as CSSProperties
                  }
                >
                  <span className={`studio-engrave-text ${font}`}>{text || "לנצח שלך"}</span>
                </div>
              </div>
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
        <section className="studio-step-section">
          <h2>פרטים ותשלום</h2>
          <div className="studio-checkout-grid">
            <div className="studio-checkout-form">
              <label>
                שם מלא
                <input value={customer.fullName} onChange={(e) => setCustomer((s) => ({ ...s, fullName: e.target.value }))} />
              </label>
              <label>
                טלפון
                <input value={customer.phone} onChange={(e) => setCustomer((s) => ({ ...s, phone: e.target.value }))} />
              </label>
              <label>
                אימייל
                <input value={customer.email} onChange={(e) => setCustomer((s) => ({ ...s, email: e.target.value }))} />
              </label>
              <label>
                עיר
                <input value={customer.city} onChange={(e) => setCustomer((s) => ({ ...s, city: e.target.value }))} />
              </label>
              <label>
                כתובת
                <input value={customer.address} onChange={(e) => setCustomer((s) => ({ ...s, address: e.target.value }))} />
              </label>

              <div className="studio-shipping-row">
                {studioShippingMethods.map((method) => (
                  <button
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
              <p>חריטה: {text || "ללא טקסט"}</p>
              <p>כמות: {qty}</p>
              <p>משלוח: {shipping.label}</p>
              {!canPurchase ? <p style={{ color: "#b42318", fontWeight: 700 }}>אזל מהמלאי - לא ניתן להשלים הזמנה</p> : null}
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
            <p>המוצר שלך ייכנס לייצור אישי ונעדכן אותך בכל שלב.</p>
            <button className="studio-primary-btn" onClick={onBackToLanding}>
              חזרה לדף הבית
            </button>
          </div>
        </section>
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
        <button className="studio-secondary-btn studio-home-btn" onClick={onBackToLanding}>
          חזרה לדף הבית
        </button>
      </footer>
    </div>
  );
};

export default StudioPage;
