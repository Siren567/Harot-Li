import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Icon from "./components/Icon";
import { benefits, examples, steps } from "./constants/mockData";
import { getApiBaseUrl } from "./lib/apiBase";
import { BrandWordmark } from "./lib/brand";
import { loadBootstrapOnce } from "./lib/studioDataLoader";
import { BUSINESS_DETAILS, LEGAL_DEFAULTS } from "./constants/publicLegalDocuments";
import {
  SUPPORT_WHATSAPP_PHONE_DIGITS,
  formatCancelDealRequestMessage,
  openSupportWhatsAppWithText,
} from "./lib/supportWhatsApp";

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
const navLinks = [
  { label: "דף הבית", href: "#top" },
  { label: "איך זה עובד", href: "#how" },
  { label: "צור קשר", href: "#contact" }
];

const App = () => {
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [contactSent, setContactSent] = useState(false);
  const [orderLookupInput, setOrderLookupInput] = useState("");
  const [orderLookupLoading, setOrderLookupLoading] = useState(false);
  const [orderLookupError, setOrderLookupError] = useState<string | null>(null);
  const [orderLookupResult, setOrderLookupResult] = useState<{
    orderNumber: string;
    status: PublicOrderStatus;
    createdAt: string;
    totalAgorot: number;
  } | null>(null);
  const [cancelRequestSent, setCancelRequestSent] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [bootstrap, setBootstrap] = useState<any>(null);
  const [bootstrapReady, setBootstrapReady] = useState(false);

  useEffect(() => {
    const apiBase = getApiBaseUrl();
    const startKey = "harotli_visit_started_at";
    const tabKey = "harotli_visit_tracked";
    const now = Date.now();

    if (!sessionStorage.getItem(tabKey)) {
      sessionStorage.setItem(tabKey, "1");
      sessionStorage.setItem(startKey, String(now));
      fetch(`${apiBase}/api/analytics/visit-start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startedAt: new Date(now).toISOString() }),
      }).catch(() => undefined);
    }

    const flushVisitEnd = () => {
      const startedAtRaw = sessionStorage.getItem(startKey);
      if (!startedAtRaw) return;
      const startedAt = Number(startedAtRaw);
      if (!Number.isFinite(startedAt) || startedAt <= 0) return;
      const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      const payload = JSON.stringify({ durationSeconds, endedAt: new Date().toISOString() });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${apiBase}/api/analytics/visit-end`, new Blob([payload], { type: "application/json" }));
      } else {
        fetch(`${apiBase}/api/analytics/visit-end`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => undefined);
      }
      sessionStorage.removeItem(startKey);
      sessionStorage.removeItem(tabKey);
    };

    window.addEventListener("pagehide", flushVisitEnd);
    return () => {
      window.removeEventListener("pagehide", flushVisitEnd);
      flushVisitEnd();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const apiBase = getApiBaseUrl();
    loadBootstrapOnce(apiBase)
      .then((data) => {
        if (mounted) setBootstrap(data);
      })
      .catch(() => {
        if (mounted) setBootstrap(null);
      })
      .finally(() => {
        if (mounted) setBootstrapReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

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
        setContactSent(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    modalRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openModal]);

  const closeModal = () => {
    setOpenModal(null);
    setContactSent(false);
    setCancelRequestSent(false);
    setOrderLookupInput("");
    setOrderLookupLoading(false);
    setOrderLookupError(null);
    setOrderLookupResult(null);
  };

  const onContactSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setContactSent(true);
  };

  const onCancelRequestSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const orderNumber = String(fd.get("cancel_order") ?? "").trim();
    const fullName = String(fd.get("cancel_name") ?? "").trim();
    const phone = String(fd.get("cancel_phone") ?? "").trim();
    const details = String(fd.get("cancel_details") ?? "").trim();
    if (!orderNumber || !fullName || !phone || !details) return;
    openSupportWhatsAppWithText(
      formatCancelDealRequestMessage({ orderNumber, fullName, phone, details }),
    );
    setCancelRequestSent(true);
  };

  const onOrderStatusSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
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
      let data: { order?: { orderNumber?: string; status?: string; createdAt?: string; totalAgorot?: number } } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (res.status === 404) {
        setOrderLookupError("לא נמצאה הזמנה עם מספר זה. בדקו את המספר או פנו אלינו ב״צור קשר״.");
        return;
      }
      if (!res.ok) {
        setOrderLookupError("לא ניתן לטעון את הסטטוס כרגע. נסו שוב מאוחר יותר.");
        return;
      }
      const o = data?.order;
      if (!o?.orderNumber || !o?.status) {
        setOrderLookupError("תשובה לא צפויה מהשרת.");
        return;
      }
      setOrderLookupResult({
        orderNumber: o.orderNumber,
        status: o.status as PublicOrderStatus,
        createdAt: String(o.createdAt ?? ""),
        totalAgorot: Number(o.totalAgorot) || 0,
      });
    } catch {
      setOrderLookupError("שגיאת רשת. בדקו את החיבור ונסו שוב.");
    } finally {
      setOrderLookupLoading(false);
    }
  };

  const openStudio = (event?: MouseEvent<HTMLElement>) => {
    if (event) event.preventDefault();
    window.location.href = "/studio";
  };

  const sectionsByKey = useMemo(() => {
    const rows = Array.isArray(bootstrap?.sections) ? bootstrap.sections : [];
    return Object.fromEntries(rows.map((s: any) => [s.key, s]));
  }, [bootstrap]);

  const legalBySlug = useMemo(() => {
    const rows = Array.isArray(bootstrap?.legalPages) ? bootstrap.legalPages : [];
    return Object.fromEntries(rows.map((s: any) => [s.slug, s]));
  }, [bootstrap]);

  const settingsByKey = useMemo(() => {
    const rows = Array.isArray(bootstrap?.settings) ? bootstrap.settings : [];
    return Object.fromEntries(rows.map((s: any) => [s.key, s.value]));
  }, [bootstrap]);

  const heroBody = sectionsByKey.hero?.body ?? {
    title: "חריטה אישית שהופכת\nכל מוצר למתנה\nעם משמעות",
    subtitle: "צמידים, תליונים ומתנות בהתאמה אישית מלאה - כי כל מילה חשובה.",
    ctaText: "לעיצוב המתנה שלך",
    ctaLink: "#",
    trustText: "4.9 · מעל 2,400 לקוחות מרוצים",
  };
  const heroLines = String(heroBody.title ?? "").split("\n").filter(Boolean);
  const benefitsData = Array.isArray(sectionsByKey.benefits?.body) ? sectionsByKey.benefits.body : benefits;
  const stepsData = Array.isArray(sectionsByKey.how_steps?.body) ? sectionsByKey.how_steps.body : steps;
  const examplesData = Array.isArray(sectionsByKey.examples?.body) ? sectionsByKey.examples.body : examples;
  const finalCta = sectionsByKey.final_cta?.body ?? {
    label: "מוכנים?",
    titleLines: ["רוצה מתנה אישית", "שלא שוכחים?"],
    subtitle: "צרו מתנה שתישאר בלב לנצח - תהליך פשוט, תוצאה מרגשת.",
    ctaText: "התחל לעצב עכשיו",
    ctaLink: "#",
  };
  const footer = sectionsByKey.footer?.body ?? {
    brandTitle: "חרוטלי",
    brandSubtitle: "מתנות אישיות עם חריטה מקצועית - כי כל מילה שווה לנצח.",
    contact: {},
    copyrightText: "© 2026 חרוטלי. כל הזכויות שמורות.",
    statusLinkText: "בדיקת סטטוס הזמנה",
    statusLinkHref: "#",
  };
  const announcement = settingsByKey.announcement ?? { isVisible: false, text: "", link: "#" };

  const topSellerSection = sectionsByKey.top_sellers_section?.body ?? {
    title: "נבחרים במיוחד",
    subtitle: "הקולקציה שלנו",
    isVisible: true,
    limit: 3,
    badgeTextDefault: "רב מכר",
  };
  const topSellersRaw = Array.isArray(bootstrap?.topSellers) ? bootstrap.topSellers : [];
  const manualTopSellers = Array.isArray(topSellerSection.manualItems)
    ? topSellerSection.manualItems
        .filter((x: any) => x && typeof x === "object")
        .map((x: any, idx: number) => ({
          id: String(x.id ?? `manual-${idx}`),
          name: String(x.name ?? "").trim() || "מוצר",
          imageUrl: String(x.imageUrl ?? "").trim() || "",
          priceFrom: String(x.priceFrom ?? "").trim() || "₪0",
        }))
    : [];
  const topSellersData = (!bootstrapReady
    ? []
    : topSellersRaw.length > 0
    ? topSellersRaw
        .filter((x: any) => x?.products)
        .map((x: any) => ({
          id: x.product_id,
          name: x.products?.title ?? "מוצר",
          imageUrl: x.products?.image_url ?? "",
          priceFrom: `₪${((x.products?.price ?? 0) / 100).toLocaleString("he-IL")}`,
        }))
    : manualTopSellers.length > 0
      ? manualTopSellers
      : []
  ).slice(0, Number(topSellerSection.limit ?? 3));
  const showTopSellersSection = topSellerSection.isVisible !== false && (!bootstrapReady || topSellersData.length > 0);

  const legalDefaults = LEGAL_DEFAULTS;

  const legalContent =
    openModal && openModal !== "contact" && openModal !== "orderStatus" && openModal !== "cancelRequest"
      ? {
          title: legalBySlug[openModal]?.title ?? legalDefaults[openModal].title,
          html:
            (typeof legalBySlug[openModal]?.body?.html === "string" && legalBySlug[openModal].body.html) ||
            (typeof legalBySlug[openModal]?.body?.content === "string" && legalBySlug[openModal].body.content) ||
            legalDefaults[openModal].html,
        }
      : null;

  const modalTitleId =
    openModal === "terms"
      ? "modal-title-terms"
      : openModal === "privacy"
        ? "modal-title-privacy"
        : openModal === "usage"
          ? "modal-title-usage"
          : openModal === "orderStatus"
            ? "modal-title-order-status"
          : openModal === "cancelRequest"
            ? "modal-title-cancel-request"
            : "modal-title-contact";

  const modalHeading =
    openModal === "contact"
      ? "צור קשר"
      : openModal === "orderStatus"
        ? "בדיקת סטטוס הזמנה"
        : openModal === "cancelRequest"
          ? "בקשה לביטול עסקה"
        : legalContent?.title ?? "מידע";

  return (
    <div dir="rtl" id="top">
      <a href="#main-content" className="skip-link">
        דלג לתוכן הראשי
      </a>
      <nav className="top-nav">
        <a href="#top" className="nav-logo" aria-label={`${footer.brandTitle || "חרוטלי"} — לראש הדף`}>
          <BrandWordmark title={footer.brandTitle} />
        </a>
        <ul className="nav-menu">
          {navLinks.map((link) => (
            <li key={link.label}>
              {link.label === "צור קשר" ? (
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setOpenModal("contact");
                  }}
                >
                  {link.label}
                </a>
              ) : (
                <a href={link.href}>{link.label}</a>
              )}
            </li>
          ))}
        </ul>
        <a href="#" className="nav-cta" onClick={openStudio}>
          לעיצוב המתנה
          <Icon name="arrow" className="icon-sm" />
        </a>
      </nav>
      {announcement.isVisible ? (
        <div style={{ background: "rgba(196,150,77,0.12)", borderBottom: "1px solid rgba(196,150,77,0.28)", padding: "9px 14px", textAlign: "center", fontSize: 13 }}>
          {announcement.link ? <a href={announcement.link}>{announcement.text}</a> : announcement.text}
        </div>
      ) : null}

      <main id="main-content" className="site-main">
        <section className="hero">
          <div className="hero-content">
            <h1>
              {heroLines[0] ?? "חריטה אישית שהופכת"}
              <br />
              {heroLines[1] ?? "כל מוצר למתנה"}
              <br />
              <em>{heroLines[2] ?? "עם משמעות"}</em>
            </h1>
            <p className="hero-sub">{heroBody.subtitle}</p>
            <a href="#" className="btn-primary" onClick={openStudio}>
              {heroBody.ctaText}
              <Icon name="arrow" className="icon-md" />
            </a>
            <div className="hero-trust">
              <div className="stars">
                <Icon name="star" className="icon-star" />
                <Icon name="star" className="icon-star" />
                <Icon name="star" className="icon-star" />
                <Icon name="star" className="icon-star" />
                <Icon name="star" className="icon-star" />
              </div>
              {heroBody.trustText}
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-visual-orbs" aria-hidden="true">
              <div className="hero-orb hero-orb-a" />
              <div className="hero-orb hero-orb-b" />
              <div className="hero-orb hero-orb-c" />
            </div>
            <div className="hero-visual-stage">
              <div className="hero-engrave-base" />
              <div className="hero-engrave-wrap">
                <svg className="hero-engrave-svg" viewBox="0 0 400 220" role="img" aria-label="אנימציית חריטה">
                  <defs>
                    <linearGradient id="hero-metal-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#F4EDE6" />
                      <stop offset="38%" stopColor="#E8DDD4" />
                      <stop offset="100%" stopColor="#D4C4B4" />
                    </linearGradient>
                    <linearGradient id="hero-metal-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                      <stop offset="45%" stopColor="rgba(255,255,255,0)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                    <filter id="hero-metal-shadow" x="-8%" y="-8%" width="116%" height="116%">
                      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
                      <feOffset in="blur" dy="2" result="offset" />
                      <feComponentTransfer in="offset" result="soft">
                        <feFuncA type="linear" slope="0.2" />
                      </feComponentTransfer>
                      <feMerge>
                        <feMergeNode in="soft" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <rect className="hero-metal-plate" x="36" y="32" width="328" height="156" rx="16" fill="url(#hero-metal-grad)" />
                  <rect x="36" y="32" width="328" height="156" rx="16" fill="url(#hero-metal-sheen)" opacity="0.35" />
                  <rect x="36" y="32" width="328" height="156" rx="16" fill="none" stroke="rgba(139,94,60,0.12)" strokeWidth="1" />

                  <path id="hero-groove-trace" fill="none" stroke="none" d="M 308 134 C 262 128, 222 130, 200 131 C 178 132, 138 130, 92 134" />
                  <path className="hero-engrave-groove" d="M 308 134 C 262 128, 222 130, 200 131 C 178 132, 138 130, 92 134" />

                  <circle className="hero-engrave-tip" r="2.2" opacity="0">
                    <animate
                      attributeName="opacity"
                      dur="10.5s"
                      repeatCount="indefinite"
                      calcMode="linear"
                      values="0;0;0.85;0.85;0;0"
                      keyTimes="0;0.04;0.09;0.3;0.35;1"
                    />
                    <animateMotion
                      dur="10.5s"
                      repeatCount="indefinite"
                      calcMode="linear"
                      rotate="0"
                      keyTimes="0;0.3;0.62;0.63;1"
                      keyPoints="0;1;1;0;0"
                    >
                      <mpath href="#hero-groove-trace" />
                    </animateMotion>
                  </circle>
                </svg>
                <div className="hero-engrave-caption">לנצח שלך</div>
              </div>
            </div>
          </div>
        </section>

        <section className="benefits">
          <div className="section-header section-header-center">
            <div className="section-label">למה לבחור בנו</div>
            <h2 className="section-title">כל מה שצריך למתנה מושלמת</h2>
          </div>
          <div className="benefits-grid">
            {benefitsData.map((item: any) => (
              <article className="benefit-card" key={item.title}>
                <div className="benefit-icon">
                  <Icon name={item.icon as "heart" | "gem" | "truck"} className="icon-md" />
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="how" id="how">
          <div className="section-header section-header-center">
            <div className="section-label">תהליך פשוט</div>
            <h2 className="section-title">איך זה עובד?</h2>
          </div>
          <div className="steps-grid">
            {stepsData.map((step: any) => (
              <article className="step" key={step.id}>
                <div className="step-number">{step.id}</div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="examples">
          <div className="section-header section-header-center">
            <div className="section-label">השראה לחריטה</div>
            <h2 className="section-title">מה אנשים חורטים?</h2>
          </div>
          <div className="examples-grid">
            {examplesData.map((example: string) => (
              <div className="example-tag" key={example}>
                {example}
              </div>
            ))}
          </div>
          <p className="examples-sub">
            <span className="examples-sub-text">או כל מילה שרק אתם יודעים את המשמעות שלה</span>
            <Icon name="sparkles" className="examples-sub-icon" />
          </p>
        </section>

        {showTopSellersSection ? <section className="products" id="products">
          <div className="section-header section-header-center">
            <div className="section-label">{topSellerSection.subtitle ?? "הקולקציה שלנו"}</div>
            <h2 className="section-title">{topSellerSection.title ?? "נבחרים במיוחד"}</h2>
          </div>
          <div className="products-grid">
            {!bootstrapReady
              ? Array.from({ length: 3 }).map((_, idx) => (
                  <article
                    key={`top-seller-skeleton-${idx}`}
                    className="product-card"
                    aria-hidden="true"
                    style={{ opacity: 0.85 }}
                  >
                    <div className="product-image">
                      <div
                        className="product-image-inner"
                        style={{
                          background: "linear-gradient(90deg, #f6efe7 25%, #efe4d8 50%, #f6efe7 75%)",
                          backgroundSize: "220% 100%",
                          animation: "studio-skeleton-shimmer 1.25s ease-in-out infinite",
                        }}
                      />
                    </div>
                    <div className="product-info">
                      <h3 style={{ minHeight: 22, background: "#f3ebe2", borderRadius: 8 }} />
                      <div className="price" style={{ minHeight: 18, background: "#f3ebe2", borderRadius: 8 }} />
                      <div style={{ height: 34, borderRadius: 999, border: "1px solid #eadbcc", marginTop: 10 }} />
                    </div>
                  </article>
                ))
              : topSellersData.map((product: any) => (
                  <article key={product.id} className="product-card">
                    <div className="product-image">
                      <div className="product-image-inner">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    </div>
                    <div className="product-info">
                      <h3>{product.name}</h3>
                      <div className="price">החל מ-{product.priceFrom}</div>
                      <a href="#" className="btn-secondary" onClick={openStudio}>
                        <Icon name="bag" className="icon-sm" />
                        לעיצוב
                      </a>
                    </div>
                  </article>
                ))}
          </div>
        </section> : null}

        <section className="final-cta">
          <div className="section-label">{finalCta.label ?? "מוכנים?"}</div>
          <h2>
            {finalCta.titleLines?.[0] ?? "רוצה מתנה אישית"}
            <br />
            {finalCta.titleLines?.[1] ?? "שלא שוכחים?"}
          </h2>
          <p>{finalCta.subtitle}</p>
          <a href="#" className="btn-light" onClick={openStudio}>
            {finalCta.ctaText}
            <Icon name="arrow" className="icon-md" />
          </a>
        </section>
      </main>

      <footer id="contact">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="logo">
              <BrandWordmark title={footer.brandTitle} />
            </div>
            <p>{footer.brandSubtitle ?? ""}</p>
          </div>
          <div className="footer-nav">
            <div className="footer-nav-col">
              <h4>ניווט</h4>
              <ul>
                <li>
                  <a href="#top">דף הבית</a>
                </li>
                <li>
                  <a href="#how">איך זה עובד</a>
                </li>
                <li>
                  <a
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setOpenModal("contact");
                    }}
                  >
                    צור קשר
                  </a>
                </li>
              </ul>
            </div>
            <div className="footer-nav-col">
              <h4>מידע</h4>
              <ul>
                <li>
                  <a
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setOpenModal("terms");
                    }}
                  >
                    תקנון
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setOpenModal("privacy");
                    }}
                  >
                    מדיניות פרטיות
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setOpenModal("usage");
                    }}
                  >
                    תנאי שימוש
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setOpenModal("contact");
                    }}
                  >
                    צור קשר
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-bottom-meta">
            <p>{footer.copyrightText ?? ""}</p>
            <a href="https://zh-studio.xyz" target="_blank" rel="noreferrer" className="zh-studio-credit">
              Build by S.G Digital
            </a>
          </div>
          <div className="footer-actions">
            <a
              href={footer.statusLinkHref ?? "#"}
              className="footer-status-link"
              onClick={(event) => {
                const href = String(footer.statusLinkHref ?? "").trim();
                if (!href || href === "#") {
                  event.preventDefault();
                  setOpenModal("orderStatus");
                }
              }}
            >
              {footer.statusLinkText ?? ""}
            </a>
            <button
              type="button"
              className="footer-status-link footer-status-link-secondary"
              onClick={() => setOpenModal("cancelRequest")}
            >
              בקשה לביטול עסקה
            </button>
          </div>
        </div>
      </footer>

      <a
        href={`https://wa.me/${SUPPORT_WHATSAPP_PHONE_DIGITS}`}
        target="_blank"
        rel="noreferrer"
        className="site-whatsapp-fab"
        aria-label="שליחת הודעה בווצאפ"
      >
        <Icon name="whatsapp" className="icon-whatsapp" />
      </a>

      {openModal ? (
        <div
          className={`site-modal-overlay ${openModal ? "is-open" : ""}`}
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            ref={modalRef}
            className="site-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            tabIndex={-1}
          >
            <div className="site-modal-header">
              <h2 id={modalTitleId}>{modalHeading}</h2>
              <button type="button" className="site-modal-close" onClick={closeModal} aria-label="סגור">
                ×
              </button>
            </div>

            <div className="site-modal-body">
              {openModal !== "contact" && openModal !== "orderStatus" && legalContent ? (
                <div dangerouslySetInnerHTML={{ __html: legalContent.html }} />
              ) : null}

              {openModal === "orderStatus" ? (
                <form className="contact-form" onSubmit={onOrderStatusSubmit}>
                  <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.5, color: "rgba(62, 39, 35, 0.75)" }}>
                    ניתן להזין את המספר המלא (כולל HG- ומקפים), רק ספרות בלי מקפים, או את הספרות האחרונות של המספר.
                  </p>
                  <label>
                    מספר הזמנה
                    <input
                      type="text"
                      value={orderLookupInput}
                      onChange={(e) => {
                        setOrderLookupInput(e.target.value);
                        setOrderLookupError(null);
                      }}
                      placeholder="לדוגמה: HG-20260419-8234 או 8234"
                      autoComplete="off"
                      disabled={orderLookupLoading}
                    />
                  </label>
                  {orderLookupError ? (
                    <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.85rem" }} role="alert">
                      {orderLookupError}
                    </p>
                  ) : null}
                  <button type="submit" className="contact-form-submit" disabled={orderLookupLoading}>
                    {orderLookupLoading ? "בודקים…" : "בדיקה"}
                  </button>
                  {orderLookupResult ? (
                    <div
                      style={{
                        marginTop: 4,
                        padding: 14,
                        borderRadius: 12,
                        background: "rgba(139, 94, 60, 0.1)",
                        border: "1px solid rgba(139, 94, 60, 0.2)",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>הזמנה {orderLookupResult.orderNumber}</div>
                      <p style={{ margin: "10px 0 0", fontSize: "0.9rem" }}>
                        סטטוס:{" "}
                        <strong>{ORDER_STATUS_LABEL[orderLookupResult.status] ?? orderLookupResult.status}</strong>
                      </p>
                      <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "rgba(62, 39, 35, 0.8)" }}>
                        סכום: {formatOrderShekels(orderLookupResult.totalAgorot)}
                      </p>
                    </div>
                  ) : null}
                </form>
              ) : null}

              {openModal === "contact" ? (
                <>
                  {!contactSent ? (
                    <form className="contact-form" onSubmit={onContactSubmit}>
                      <label>
                        שם מלא
                        <input type="text" required placeholder="לדוגמה: יעל כהן" />
                      </label>
                      <label>
                        מספר הזמנה <span className="field-hint">(אופציונלי)</span>
                        <input type="text" placeholder="לדוגמה: HG-2026-12345" />
                      </label>
                      <label>
                        טלפון
                        <input type="tel" required placeholder="לדוגמה: 050-0000000" />
                      </label>
                      <label>
                        הודעה
                        <textarea required placeholder="כיצד נוכל לעזור?" />
                      </label>
                      <button type="submit" className="contact-form-submit">
                        שלח
                      </button>
                    </form>
                  ) : (
                    <div className="contact-success">
                      <div className="contact-success-icon" aria-hidden="true">
                        ✓
                      </div>
                      <h3>הפנייה נשלחה</h3>
                      <p>
                        הודעתך התקבלה אצלנו. נחזור אליך תוך <strong>שני ימי עסקים</strong>.
                      </p>
                    </div>
                  )}
                  <div className="legal-business-card" aria-label="פרטי העסק">
                    <h4>פרטי העסק</h4>
                    <p>עוסק מורשה: {BUSINESS_DETAILS.businessId}</p>
                    <p>שם: {BUSINESS_DETAILS.ownerName}</p>
                    <p>טלפון: {BUSINESS_DETAILS.phone}</p>
                  </div>
                </>
              ) : null}
              {openModal === "cancelRequest" ? (
                <>
                  {!cancelRequestSent ? (
                    <form className="contact-form" onSubmit={onCancelRequestSubmit}>
                      <label>
                        מספר הזמנה
                        <input
                          name="cancel_order"
                          type="text"
                          required
                          placeholder="לדוגמה: HG-2026-12345"
                          autoComplete="off"
                        />
                      </label>
                      <label>
                        שם מלא
                        <input name="cancel_name" type="text" required placeholder="לדוגמה: יעל כהן" />
                      </label>
                      <label>
                        טלפון
                        <input name="cancel_phone" type="tel" required placeholder="לדוגמה: 050-0000000" />
                      </label>
                      <label>
                        פירוט סיבת הביטול
                        <textarea
                          name="cancel_details"
                          required
                          placeholder="נא לפרט את הסיבה לבקשה לביטול עסקה"
                        />
                      </label>
                      <button type="submit" className="contact-form-submit">
                        שליחת בקשה
                      </button>
                    </form>
                  ) : (
                    <div className="contact-success">
                      <div className="contact-success-icon" aria-hidden="true">
                        ✓
                      </div>
                      <h3>בקשה לביטול עסקה נשלחה</h3>
                      <p>
                        נפתח וואטסאפ עם פרטי הבקשה — שלחו את ההודעה כדי להעביר אותה לתמיכה. נחזור אליך בהקדם עם סטטוס
                        טיפול.
                      </p>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default App;
