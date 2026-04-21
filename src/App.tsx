import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Icon from "./components/Icon";
import { benefits, examples, featuredProducts, steps } from "./constants/mockData";
import { getApiBaseUrl } from "./lib/apiBase";
import { BrandWordmark } from "./lib/brand";
import { loadBootstrapOnce } from "./lib/studioDataLoader";

type ModalType = "terms" | "privacy" | "usage" | "contact" | "orderStatus" | null;

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
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [bootstrap, setBootstrap] = useState<any>(null);

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
    setOrderLookupInput("");
    setOrderLookupLoading(false);
    setOrderLookupError(null);
    setOrderLookupResult(null);
  };

  const onContactSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setContactSent(true);
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
          imageUrl: String(x.imageUrl ?? "").trim() || featuredProducts[0].imageUrl,
          priceFrom: String(x.priceFrom ?? "").trim() || "₪0",
        }))
    : [];
  const topSellersData = (topSellersRaw.length > 0
    ? topSellersRaw
        .filter((x: any) => x?.products)
        .map((x: any) => ({
          id: x.product_id,
          name: x.products?.title ?? "מוצר",
          imageUrl: x.products?.image_url ?? featuredProducts[0].imageUrl,
          priceFrom: `₪${((x.products?.price ?? 0) / 100).toLocaleString("he-IL")}`,
        }))
    : manualTopSellers.length > 0
      ? manualTopSellers
      : featuredProducts
  ).slice(0, Number(topSellerSection.limit ?? 3));

  const legalDefaults: Record<"terms" | "privacy" | "usage", { title: string; html: string }> = {
    terms: {
      title: "תקנון",
      html: `<p><strong>מבוא:</strong> התקנון נכתב בלשון זכר מטעמי נוחות וחל על שני המינים. שימוש באתר ו/או רכישת מוצר מהווה הסכמה מלאה לתקנון זה.</p>
<h3>1. כללי</h3>
<p>האתר משמש כחנות אינטרנטית לרכישת מוצרים. בעלי האתר רשאים לעדכן את תנאי התקנון מעת לעת, לפי שיקול דעתם הבלעדי וללא הודעה מוקדמת. השינויים יחולו על הזמנות חדשות בלבד.</p>
<p>אם אינך מסכים לתנאי התקנון, הינך מתבקש להימנע משימוש באתר ומביצוע הזמנות.</p>
<h3>2. הזמנה ורכישה</h3>
<p>המחיר המופיע לצד כל מוצר הוא המחיר הקובע במועד אישור ההזמנה. ייתכנו שינויים במחירים, במלאי ובזמינות ללא הודעה מוקדמת.</p>
<p>הזמנה נחשבת מאושרת לאחר אישור עסקה מחברת האשראי וקבלת אישור הזמנה בדוא"ל. במקרה של חוסר מלאי או אי יכולת אספקה תוצע חלופה או ביטול עסקה וזיכוי מלא.</p>
<p>ייתכנו הבדלים בין תמונות/מפרטים באתר לבין המוצר בפועל. התמונות מיועדות להמחשה בלבד.</p>
<h3>3. משלוחים ואספקה</h3>
<p>זמני שילוח משוערים: עד 7 ימי עסקים ממועד שליחת המוצר, ובכל מקרה עד 35 ימי עסקים ממועד שליחה, בכפוף לגורמים חיצוניים (חברות שילוח, דואר, עומסים וכד').</p>
<p>ייתכן פיצול משלוחים בהזמנה הכוללת יותר ממוצר אחד. משלוחים זמינים לכתובות בישראל בלבד.</p>
<h3>4. ביטולים והחזרות</h3>
<p>ניתן לבטל עסקה בהתאם לחוק הגנת הצרכן בתוך 14 יום ממועד קבלת המוצר/פרטי העסקה (לפי המאוחר), בכפוף לדמי ביטול של 5% או 100 ש"ח (לפי הנמוך), ובתוספת עמלות סליקה אם יחולו.</p>
<p>במוצר פגום/לא תואם יש לפנות לשירות לקוחות בצירוף תיעוד. מוצרים בהתאמה אישית עשויים שלא להיות ניתנים להחזרה, בכפוף להוראות הדין.</p>
<h3>5. הגבלת אחריות</h3>
<p>החברה אינה אחראית לעיכובים או כשלים שנגרמו מכוח עליון, תקלות ספקים חיצוניים, תקלות תקשורת, תקלות סליקה או כל גורם שאינו בשליטתה הסבירה.</p>
<p>האחריות למוצרים תחול בהתאם לדין ולמדיניות היצרן/הספק. אין בתקנון זה כדי לגרוע מזכויות צרכניות קוגנטיות.</p>
<h3>6. סמכות שיפוט ודין חל</h3>
<p>הדין החל הוא דין מדינת ישראל בלבד, וסמכות השיפוט הייחודית נתונה לבתי המשפט המוסמכים בתל אביב.</p>`,
    },
    privacy: {
      title: "מדיניות פרטיות",
      html: `<p>אנו מכבדים את פרטיות המשתמשים ומתחייבים לנקוט באמצעים סבירים לשמירה על המידע הנמסר לנו.</p>
<h3>1. איזה מידע נאסף</h3>
<p>בעת ביצוע הזמנה נאספים פרטים הנדרשים לצורך השלמת העסקה והשילוח בלבד, לרבות: שם מלא, כתובת, טלפון, דוא"ל, פרטי משלוח ופרטי חיוב.</p>
<p>פרטי כרטיס אשראי אינם נשמרים בשרתי העסק.</p>
<h3>2. מטרות השימוש</h3>
<p>המידע ישמש לצורך:</p>
<ul>
  <li>ביצוע הזמנות ואספקת מוצרים</li>
  <li>שירות לקוחות ומענה לפניות</li>
  <li>שליחת עדכוני סטטוס הזמנה, חשבוניות ומשלוחים</li>
  <li>שליחת דיוור שיווקי, בכפוף לדין ולהסכמת המשתמש</li>
</ul>
<h3>3. צדדים שלישיים</h3>
<p>המידע יועבר רק לגורמים נדרשים לצורך אספקת השירות (כגון חברות שילוח וספקים), ובהיקף הדרוש בלבד.</p>
<h3>4. אבטחת מידע</h3>
<p>החברה עושה שימוש באמצעי אבטחה מקובלים, אך אינה יכולה להבטיח חסינות מוחלטת מפני חדירה בלתי מורשית.</p>
<h3>5. עוגיות (Cookies)</h3>
<p>האתר עשוי להשתמש בעוגיות לצורכי תפעול, אבטחה, זיהוי ושיפור חוויית שימוש. ניתן לנהל או לחסום עוגיות דרך הגדרות הדפדפן.</p>
<h3>6. דיוור והסרה מרשימות</h3>
<p>ניתן להסיר את עצמך מדיוור שיווקי באמצעות קישור הסרה בכל הודעה. הודעות תפעוליות הקשורות להזמנה ומשלוח יישלחו גם ללא הרשמה לדיוור שיווקי.</p>`,
    },
    usage: {
      title: "תנאי שימוש",
      html: `<p>מסמך זה מגדיר את תנאי השימוש באתר ובשירותים המוצעים בו.</p>
<h3>1. כשירות לשימוש באתר</h3>
<p>השימוש באתר מותר לבני 18 ומעלה, בעלי כשרות משפטית, תושבי ישראל, ובעלי אמצעי תשלום תקף שהונפק בישראל.</p>
<h3>2. חשבון משתמש ואבטחת גישה</h3>
<p>המשתמש אחראי לשמירת סודיות פרטי הגישה שלו ולא יעשה שימוש בפרטי גישה של אחרים. אסור לפתוח חשבון עבור צד שלישי ללא הסכמתו המפורשת.</p>
<h3>3. שימוש מותר ואסור</h3>
<ul>
  <li>אין להעתיק, לשכפל, להפיץ, לפרסם או לעשות שימוש מסחרי בתכני האתר ללא אישור מראש.</li>
  <li>אין לבצע פעולות הפוגעות באתר, במערכותיו או במשתמשים אחרים.</li>
  <li>אין להעלות תוכן בלתי חוקי, מטעה, פוגעני או מפר זכויות.</li>
</ul>
<h3>4. קניין רוחני</h3>
<p>כל הזכויות בתכני האתר, לרבות טקסטים, עיצוב, תמונות, לוגו, סימני מסחר, אלגוריתמים ומערכות, שמורות לבעלי האתר או למורשים מטעמם.</p>
<h3>5. תקלות ושיבושים</h3>
<p>ייתכנו תקלות זמניות, הפרעות או שיבושים עקב גורמים טכניים או צדדים שלישיים. החברה תפעל באופן סביר לתיקון תקלות אך אינה מתחייבת לזמינות רציפה מלאה.</p>
<h3>6. ניהול תוכן ומשתמשים</h3>
<p>החברה רשאית להסיר תוכן, להגביל או לחסום משתמשים בכל עת, לפי שיקול דעתה, כאשר נמצא שימוש החורג מתנאים אלה או מהוראות הדין.</p>`,
    },
  };

  const legalContent =
    openModal && openModal !== "contact" && openModal !== "orderStatus"
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
            : "modal-title-contact";

  const modalHeading =
    openModal === "contact"
      ? "צור קשר"
      : openModal === "orderStatus"
        ? "בדיקת סטטוס הזמנה"
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

        {topSellerSection.isVisible === false || topSellersData.length === 0 ? null : <section className="products" id="products">
          <div className="section-header section-header-center">
            <div className="section-label">{topSellerSection.subtitle ?? "הקולקציה שלנו"}</div>
            <h2 className="section-title">{topSellerSection.title ?? "נבחרים במיוחד"}</h2>
          </div>
          <div className="products-grid">
            {topSellersData.map((product: any) => (
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
        </section>}

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
            <a href="/admin/login" className="footer-admin-link">
              ניהול אתר
            </a>
            <a href="https://zh-studio.xyz" target="_blank" rel="noreferrer" className="zh-studio-credit">
              Build by S.G Digital
            </a>
          </div>
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
        </div>
      </footer>

      <a
        href="https://wa.me/972559433968"
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
