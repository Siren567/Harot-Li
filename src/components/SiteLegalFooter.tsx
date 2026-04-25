import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrandWordmark } from "../lib/brand";
import { getApiBaseUrl } from "../lib/apiBase";

type ModalType = "terms" | "privacy" | "usage" | "contact" | "orderStatus" | "cancelRequest" | null;
type PublicOrderStatus = "NEW" | "PAID" | "FULFILLED" | "SHIPPED" | "COMPLETED" | "CANCELLED" | "REFUNDED";

const ORDER_STATUS_LABEL: Record<PublicOrderStatus, string> = {
  NEW: "התקבלה — ממתינה לתשלום",
  PAID: "שולמה — בתהליך הכנה",
  FULFILLED: "בהכנה",
  SHIPPED: "נשלחה",
  COMPLETED: "הושלמה",
  CANCELLED: "בוטלה",
  REFUNDED: "זוכתה",
};

function formatOrderShekels(agorot: number) {
  return `₪${(Number(agorot || 0) / 100).toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const LEGAL_CONTENT: Record<"terms" | "privacy" | "usage", { title: string; html: string }> = {
  terms: {
    title: "תקנון",
    html: "<p>השימוש באתר כפוף לתקנון ולהוראות הדין. ניתן לבטל עסקה לפי חוק הגנת הצרכן ובכפוף לחריגים למוצרים בהתאמה אישית.</p>",
  },
  privacy: {
    title: "מדיניות פרטיות",
    html: "<p>המידע נאסף לצורך השלמת הזמנה, משלוח ושירות בלבד. פרטי אשראי אינם נשמרים אצלנו.</p>",
  },
  usage: {
    title: "תנאי שימוש",
    html: "<p>אין לעשות שימוש פוגעני או מסחרי בתכני האתר ללא אישור. ייתכנו שיבושים טכניים מעת לעת.</p>",
  },
};

export default function SiteLegalFooter() {
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [orderLookupInput, setOrderLookupInput] = useState("");
  const [orderLookupLoading, setOrderLookupLoading] = useState(false);
  const [orderLookupError, setOrderLookupError] = useState<string | null>(null);
  const [orderLookupResult, setOrderLookupResult] = useState<{
    orderNumber: string;
    status: PublicOrderStatus;
    totalAgorot: number;
  } | null>(null);
  const [contactSent, setContactSent] = useState(false);
  const [cancelRequestSent, setCancelRequestSent] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.body.style.overflow = openModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [openModal]);

  useEffect(() => {
    if (!openModal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenModal(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    modalRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openModal]);

  function closeModal() {
    setOpenModal(null);
    setContactSent(false);
    setCancelRequestSent(false);
    setOrderLookupInput("");
    setOrderLookupLoading(false);
    setOrderLookupError(null);
    setOrderLookupResult(null);
  }

  async function onOrderStatusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = orderLookupInput.trim().replace(/^#+/, "");
    if (!raw) {
      setOrderLookupError("נא להזין מספר הזמנה");
      setOrderLookupResult(null);
      return;
    }
    setOrderLookupLoading(true);
    setOrderLookupError(null);
    setOrderLookupResult(null);
    const apiBase = getApiBaseUrl();
    try {
      const res = await fetch(`${apiBase}/api/public/order-status?orderNumber=${encodeURIComponent(raw)}`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) {
        setOrderLookupError("לא נמצאה הזמנה עם מספר זה.");
        return;
      }
      if (!res.ok || !data?.order?.orderNumber || !data?.order?.status) {
        setOrderLookupError("לא ניתן לטעון את הסטטוס כרגע.");
        return;
      }
      setOrderLookupResult({
        orderNumber: String(data.order.orderNumber),
        status: data.order.status as PublicOrderStatus,
        totalAgorot: Number(data.order.totalAgorot) || 0,
      });
    } catch {
      setOrderLookupError("שגיאת רשת. נסו שוב.");
    } finally {
      setOrderLookupLoading(false);
    }
  }

  const modalTitle =
    openModal === "contact"
      ? "צור קשר"
      : openModal === "orderStatus"
        ? "בדיקת סטטוס הזמנה"
        : openModal === "cancelRequest"
          ? "טופס בקשה לביטול"
          : openModal
            ? LEGAL_CONTENT[openModal].title
            : "";

  return (
    <>
      <footer>
        <div className="footer-top">
          <div className="footer-brand">
            <div className="logo">
              <BrandWordmark title="חרוטלי" />
            </div>
            <p>מתנות אישיות עם חריטה מקצועית - כי כל מילה שווה לנצח.</p>
          </div>
          <div className="footer-nav">
            <div className="footer-nav-col">
              <h4>מידע</h4>
              <ul>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setOpenModal("terms"); }}>תקנון</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setOpenModal("privacy"); }}>מדיניות פרטיות</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setOpenModal("usage"); }}>תנאי שימוש</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setOpenModal("contact"); }}>צור קשר</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-bottom-meta">
            <p>© 2026 חרוטלי. כל הזכויות שמורות.</p>
          </div>
          <div className="footer-actions">
            <button type="button" className="footer-status-link footer-status-link-secondary" onClick={() => setOpenModal("orderStatus")}>
              בדיקת סטטוס הזמנה
            </button>
            <button type="button" className="footer-status-link footer-status-link-secondary" onClick={() => setOpenModal("cancelRequest")}>
              טופס בקשה לביטול
            </button>
          </div>
        </div>
      </footer>

      {openModal ? (
        <div className="site-modal-overlay is-open" role="presentation" onClick={(event) => {
          if (event.target === event.currentTarget) closeModal();
        }}>
          <div ref={modalRef} className="site-modal" role="dialog" aria-modal="true" aria-label={modalTitle} tabIndex={-1}>
            <div className="site-modal-header">
              <h2>{modalTitle}</h2>
              <button type="button" className="site-modal-close" onClick={closeModal} aria-label="סגור">×</button>
            </div>
            <div className="site-modal-body">
              {openModal === "terms" || openModal === "privacy" || openModal === "usage" ? (
                <div dangerouslySetInnerHTML={{ __html: LEGAL_CONTENT[openModal].html }} />
              ) : null}
              {openModal === "orderStatus" ? (
                <form className="contact-form" onSubmit={onOrderStatusSubmit}>
                  <label>
                    מספר הזמנה
                    <input type="text" value={orderLookupInput} onChange={(e) => setOrderLookupInput(e.target.value)} placeholder="לדוגמה: HG-20260419-8234" />
                  </label>
                  {orderLookupError ? <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.85rem" }}>{orderLookupError}</p> : null}
                  <button type="submit" className="contact-form-submit" disabled={orderLookupLoading}>
                    {orderLookupLoading ? "בודקים…" : "בדיקה"}
                  </button>
                  {orderLookupResult ? (
                    <div style={{ marginTop: 8 }}>
                      <p><strong>הזמנה:</strong> {orderLookupResult.orderNumber}</p>
                      <p><strong>סטטוס:</strong> {ORDER_STATUS_LABEL[orderLookupResult.status] ?? orderLookupResult.status}</p>
                      <p><strong>סכום:</strong> {formatOrderShekels(orderLookupResult.totalAgorot)}</p>
                    </div>
                  ) : null}
                </form>
              ) : null}
              {openModal === "contact" ? (
                contactSent ? (
                  <div className="contact-success">
                    <div className="contact-success-icon" aria-hidden="true">✓</div>
                    <h3>הפנייה נשלחה</h3>
                    <p>נחזור אליך בהקדם.</p>
                  </div>
                ) : (
                  <form className="contact-form" onSubmit={(e) => { e.preventDefault(); setContactSent(true); }}>
                    <label>שם מלא<input type="text" required /></label>
                    <label>טלפון<input type="tel" required /></label>
                    <label>הודעה<textarea required /></label>
                    <button type="submit" className="contact-form-submit">שלח</button>
                  </form>
                )
              ) : null}
              {openModal === "cancelRequest" ? (
                cancelRequestSent ? (
                  <div className="contact-success">
                    <div className="contact-success-icon" aria-hidden="true">✓</div>
                    <h3>בקשת הביטול נשלחה</h3>
                    <p>הבקשה התקבלה ותטופל בהקדם.</p>
                  </div>
                ) : (
                  <form className="contact-form" onSubmit={(e) => { e.preventDefault(); setCancelRequestSent(true); }}>
                    <label>מספר הזמנה<input type="text" required /></label>
                    <label>שם מלא<input type="text" required /></label>
                    <label>טלפון<input type="tel" required /></label>
                    <label>פירוט<textarea required /></label>
                    <button type="submit" className="contact-form-submit">שליחת בקשה</button>
                  </form>
                )
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
