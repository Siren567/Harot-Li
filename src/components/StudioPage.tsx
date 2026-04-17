import { useMemo, useState, type CSSProperties } from "react";
import type { StudioCategoryId, StudioSubcategory } from "../constants/studioData";
import { getApiBaseUrl } from "../lib/apiBase";
import {
  studioCategories,
  studioFonts,
  studioMaterials,
  studioPayments,
  studioProducts,
  studioShippingMethods,
  studioSubcategories
} from "../constants/studioData";

type StudioPageProps = {
  onBackToLanding: () => void;
};

const stepLabels = ["בחירת מוצר", "עיצוב אישי", "פרטים ותשלום", "סיום הזמנה"];

const shekel = (n: number) => `₪${n.toLocaleString("he-IL")}`;

const StudioPage = ({ onBackToLanding }: StudioPageProps) => {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<StudioCategoryId>("bracelets");
  const [subcategory, setSubcategory] = useState<StudioSubcategory>("men");
  const [productId, setProductId] = useState<string>(studioProducts[0].id);
  const [selectedColorByProduct, setSelectedColorByProduct] = useState<Record<string, number>>(
    Object.fromEntries(studioProducts.map((p) => [p.id, 0]))
  );

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

  const activeProduct = useMemo(
    () => studioProducts.find((p) => p.id === productId) ?? studioProducts[0],
    [productId]
  );
  const activeColor = activeProduct.colors[selectedColorByProduct[activeProduct.id] ?? 0] ?? activeProduct.colors[0];

  const filteredProducts = useMemo(() => {
    return studioProducts.filter((p) => {
      if (p.category !== category) return false;
      if (category === "bracelets" || category === "necklaces") {
        return p.subcategory === subcategory;
      }
      return true;
    });
  }, [category, subcategory]);

  const shipping = studioShippingMethods.find((s) => s.id === shippingId) ?? studioShippingMethods[0];
  const subtotal = activeProduct.price * qty;
  const discount = appliedCoupon?.discountAmount ?? 0;
  const effectiveShippingFee = appliedCoupon?.freeShipping ? 0 : shipping.fee;
  const total = Math.max(0, subtotal + effectiveShippingFee - discount);

  const apiBase = getApiBaseUrl();

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
              qty,
              unitPrice: activeProduct.price
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
            disabled={step === 3 || submitting}
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
            {studioCategories.map((cat) => (
              <button
                key={cat.id}
                className={`studio-chip ${category === cat.id ? "active" : ""}`}
                onClick={() => {
                  setCategory(cat.id);
                  if (cat.id === "bracelets" || cat.id === "necklaces") setSubcategory("men");
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {category === "bracelets" || category === "necklaces" ? (
            <div className="studio-subcategory-tabs" role="tablist" aria-label="תתי קטגוריה">
              {studioSubcategories.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  role="tab"
                  aria-selected={subcategory === sub.id}
                  className={`studio-subcategory-tab ${subcategory === sub.id ? "active" : ""}`}
                  onClick={() => setSubcategory(sub.id)}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="studio-products-grid">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className={`studio-product-card ${productId === product.id ? "selected" : ""}`}
                onClick={() => selectProductAndGoDesign(product.id)}
              >
                <span className="studio-product-category-label">
                  {studioCategories.find((c) => c.id === product.category)?.label ?? "קטגוריה"}
                </span>
                <div className={`studio-product-thumb ${product.category}`} />
                <h3>{product.title}</h3>
                <strong className="studio-product-price">{shekel(product.price)}</strong>
                <div className="studio-swatch-row">
                  {product.colors.map((color, index) => (
                    <button
                      key={`${product.id}-${color.name}`}
                      type="button"
                      className={`studio-color-swatch ${index === (selectedColorByProduct[product.id] ?? 0) ? "active" : ""}`}
                      style={{ ["--swatch" as string]: color.swatch }}
                      aria-label={color.name}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedColorByProduct((prev) => ({ ...prev, [product.id]: index }));
                      }}
                    />
                  ))}
                </div>
                <button type="button" className="studio-select-btn">
                  בחר
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="studio-step-section">
          <h2>מעצבים את התכשיט שלך</h2>
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
                  className={`studio-3d-object ${activeProduct.category}`}
                  style={
                    {
                      transform: `rotateY(${rotation}deg) rotateX(8deg) scale(${zoom})`,
                      ["--engrave-size" as string]: `${size}px`,
                      ["--studio-metal" as string]: activeColor.swatch
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
              <p>{activeProduct.title}</p>
              <p>צבע: {activeColor.name}</p>
              <p>חריטה: {text || "ללא טקסט"}</p>
              <p>כמות: {qty}</p>
              <p>משלוח: {shipping.label}</p>
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
