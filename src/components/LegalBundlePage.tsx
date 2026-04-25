import { useEffect } from "react";
import { BrandWordmark } from "../lib/brand";
import { LEGAL_DEFAULTS, type LegalDocSlug } from "../constants/publicLegalDocuments";

const SECTION_ORDER: LegalDocSlug[] = ["terms", "privacy", "usage"];

/**
 * עמוד מסמכים משפטיים מאוחד — מיועד לקישור יחיד מחברת סליקה / בקרה חיצונית.
 * לא מקושר מתפריט האתר; נגיש רק בכתובת ישירה (למשל ‎/legal).
 */
export default function LegalBundlePage() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "מסמכים משפטיים — חרוטלי";

    let meta = document.getElementById("legal-bundle-robots-meta") as HTMLMetaElement | null;
    let created = false;
    if (!meta) {
      meta = document.createElement("meta");
      meta.id = "legal-bundle-robots-meta";
      meta.setAttribute("name", "robots");
      meta.setAttribute("content", "noindex, nofollow");
      document.head.appendChild(meta);
      created = true;
    }

    return () => {
      document.title = prevTitle;
      if (created && meta?.parentNode) {
        meta.parentNode.removeChild(meta);
      }
    };
  }, []);

  return (
    <div className="legal-bundle-page" dir="rtl">
      <a href="#legal-bundle-main" className="skip-link">
        דלג לתוכן המסמכים
      </a>

      <header className="legal-bundle-header">
        <div className="legal-bundle-header-inner">
          <a href="/" className="legal-bundle-logo" aria-label="חרוטלי — לדף הבית">
            <BrandWordmark title="חרוטלי" />
          </a>
          <div className="legal-bundle-header-text">
            <h1>מסמכים משפטיים</h1>
            <p className="legal-bundle-lead">
              עמוד זה מרכז את התקנון, מדיניות הפרטיות ותנאי השימוש בכתובת אחת, לשימוש חברות סליקה ובקרות תאימות.
            </p>
          </div>
        </div>
      </header>

      <nav className="legal-bundle-toc" aria-label="תוכן עניינים">
        {SECTION_ORDER.map((slug) => (
          <a key={slug} href={`#legal-${slug}`}>
            {LEGAL_DEFAULTS[slug].title}
          </a>
        ))}
      </nav>

      <main id="legal-bundle-main" className="legal-bundle-main">
        {SECTION_ORDER.map((slug) => (
          <section key={slug} id={`legal-${slug}`} className="legal-bundle-section" aria-labelledby={`legal-heading-${slug}`}>
            <h2 id={`legal-heading-${slug}`}>{LEGAL_DEFAULTS[slug].title}</h2>
            <div className="legal-bundle-body" dangerouslySetInnerHTML={{ __html: LEGAL_DEFAULTS[slug].html }} />
          </section>
        ))}
      </main>

      <footer className="legal-bundle-footer">
        <p>© {new Date().getFullYear()} חרוטלי — מסמכים לעיון בלבד; בכפוף לעדכונים שיפורסמו באתר.</p>
      </footer>
    </div>
  );
}
