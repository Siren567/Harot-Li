"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "../ui/toast";
import { Badge } from "../ui/badge";
import { apiFetch } from "../lib/api";
import { Card, InputGroup, PageHeader, PrimaryButton, SearchField, TextInput } from "../ui/primitives";
import {
  ArrowUp,
  ArrowDown,
  PencilLine,
  Save,
  Trash2,
} from "lucide-react";

type ContentSection = {
  id: string;
  key: string;
  title: string | null;
  body: any;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
};

type LegalPage = {
  id: string;
  slug: string;
  title: string;
  body: any;
  is_active: boolean;
  updated_at: string;
};

type SiteSetting = {
  id: string;
  key: string;
  value: any;
  updated_at: string;
};

type Product = {
  id: string;
  title: string;
  slug: string;
  image_url: string | null;
  price: number;
  is_active: boolean;
};

type CategoryNode = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  subcategories?: CategoryNode[];
};

type TopSeller = {
  id: string;
  product_id: string;
  sort_order: number;
  badge_text: string | null;
  is_active: boolean;
  products: Product | null;
};

type BootstrapResponse = {
  sections: ContentSection[];
  settings: SiteSetting[];
  legalPages: LegalPage[];
  topSellers: TopSeller[];
  categories?: Array<{ id: string; name: string; isActive?: boolean }>;
};

const LEGAL_DEFAULTS: Record<"terms" | "privacy" | "usage", { title: string; html: string }> = {
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

function upsertSection(sections: ContentSection[], next: ContentSection): ContentSection[] {
  const idx = sections.findIndex((s) => s.key === next.key);
  if (idx < 0) return [...sections, next];
  const clone = [...sections];
  clone[idx] = next;
  return clone;
}

function getSection(sections: ContentSection[], key: string): ContentSection | undefined {
  return sections.find((s) => s.key === key);
}

export function ContentPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [sections, setSections] = useState<ContentSection[]>([]);
  const [legalPages, setLegalPages] = useState<LegalPage[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [studioMainCategories, setStudioMainCategories] = useState<Array<{ id: string; label: string }>>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedTopSellerSlot, setSelectedTopSellerSlot] = useState(0);

  const topSellerSection = getSection(sections, "top_sellers_section");

  const [textSections, setTextSections] = useState<Record<string, string>>({});
  const [legalText, setLegalText] = useState<Record<"terms" | "privacy" | "usage", string>>({
    terms: LEGAL_DEFAULTS.terms.html,
    privacy: LEGAL_DEFAULTS.privacy.html,
    usage: LEGAL_DEFAULTS.usage.html,
  });
  const [topSellerCfg, setTopSellerCfg] = useState<any>({});

  async function loadBootstrap() {
    setLoading(true);
    try {
      const [boot, productsRes, categoriesRes] = await Promise.all([
        apiFetch<BootstrapResponse>("/api/content/bootstrap"),
        apiFetch<{ products: Product[] }>("/api/products"),
        apiFetch<{ categories: CategoryNode[] }>("/api/categories/tree"),
      ]);
      setSections(boot.sections);
      setLegalPages(boot.legalPages);
      setTopSellers((boot.topSellers ?? []).slice(0, 3));
      setProducts(productsRes.products.filter((p) => p.is_active));
      const mains = Array.isArray(boot.categories)
        ? (boot.categories as Array<{ id: string; name: string; isActive?: boolean }>)
            .filter((c) => c?.isActive !== false && c?.id)
            .map((c) => ({ id: c.id, label: c.name || c.id }))
        : [];
      if (mains.length > 0) {
        setStudioMainCategories(mains);
      } else {
        const tree = categoriesRes.categories ?? [];
        setStudioMainCategories(
          tree
            .filter((c) => c.isActive !== false)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((c) => ({ id: c.id, label: c.name }))
        );
      }
    } catch {
      toast("טעינת תוכן האתר נכשלה", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editableSectionKeys = useMemo(
    () => ["hero", "benefits", "how_steps", "examples", "final_cta", "footer"],
    []
  );

  useEffect(() => {
    const textMap: Record<string, string> = {};
    for (const key of editableSectionKeys) {
      textMap[key] = JSON.stringify(getSection(sections, key)?.body ?? {}, null, 2);
    }
    setTextSections(textMap);
    setTopSellerCfg(
      (() => {
        const base =
          topSellerSection?.body ?? {
            title: "נבחרים במיוחד",
            subtitle: "הקולקציה שלנו",
            isVisible: true,
            limit: 3,
            badgeTextDefault: "רב מכר",
          };
        return {
          ...base,
        };
      })()
    );
    setLegalText({
      terms:
        (bootLegal("terms")?.body?.html as string) ??
        LEGAL_DEFAULTS.terms.html,
      privacy:
        (bootLegal("privacy")?.body?.html as string) ??
        LEGAL_DEFAULTS.privacy.html,
      usage:
        (bootLegal("usage")?.body?.html as string) ??
        LEGAL_DEFAULTS.usage.html,
    });
  }, [sections, topSellerSection, editableSectionKeys, legalPages]);

  function bootLegal(slug: "terms" | "privacy" | "usage") {
    return legalPages.find((p) => p.slug === slug);
  }

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  }, [productSearch, products]);

  type SaveSectionOpts = { savingKey?: string; successToast?: string | false };

  async function saveSection(
    key: string,
    title: string | null,
    body: any,
    isActive = true,
    sortOrder = 0,
    opts?: SaveSectionOpts
  ) {
    const sk = opts?.savingKey ?? key;
    setSavingKey(sk);
    try {
      const out = await apiFetch<{ section: ContentSection }>(`/api/content/sections/${key}`, {
        method: "PUT",
        body: JSON.stringify({ title, body, is_active: isActive, sort_order: sortOrder }),
      });
      setSections((prev) => upsertSection(prev, out.section));
      if (opts?.successToast !== false) {
        toast(opts?.successToast ?? "החלק נשמר בהצלחה", "success");
      }
    } catch {
      toast("שמירת החלק נכשלה", "error");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveStudioCategoryOrder() {
    setSavingKey("studio_category_order");
    try {
      for (let idx = 0; idx < studioMainCategories.length; idx += 1) {
        const cat = studioMainCategories[idx];
        await apiFetch(`/api/categories/${cat.id}`, {
          method: "PATCH",
          body: JSON.stringify({ sortOrder: idx }),
        });
      }
      toast("סדר הקטגוריות נשמר", "success");
      await loadBootstrap();
    } catch {
      toast("שמירת סדר הקטגוריות נכשלה", "error");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveTextSection(key: string) {
    setSavingKey(`text:${key}`);
    try {
      let body: any = {};
      try {
        body = textSections[key]?.trim() ? JSON.parse(textSections[key]) : {};
      } catch {
        toast(`ה־JSON בקטע "${key}" לא תקין`, "error");
        return;
      }
      const title = key === "hero" ? "Hero" : key === "final_cta" ? "Final CTA" : key;
      await saveSection(key, title, body, true, key === "footer" ? 20 : 0);
    } catch {
      toast("שמירה נכשלה", "error");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveFeaturedHomeProducts() {
    setSavingKey("top_sellers");
    try {
      const ordered = [...topSellers].slice(0, 3);
      if (ordered.length !== 3 || ordered.some((x) => !x.product_id)) {
        toast("יש לבחור בדיוק 3 מוצרים להצגה בדף הבית", "warning");
        return;
      }
      const payload = {
        items: ordered.map((x, idx) => ({
          product_id: x.product_id,
          sort_order: idx,
          badge_text: x.badge_text ?? topSellerCfg.badgeTextDefault ?? null,
          is_active: x.is_active,
        })),
      };
      const out = await apiFetch<{ items: TopSeller[] }>("/api/top-sellers", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setTopSellers((out.items ?? []).slice(0, 3));
      await saveSection(
        "top_sellers_section",
        topSellerCfg.title ?? "נבחרים במיוחד",
        { ...topSellerCfg, limit: 3, isVisible: true },
        true,
        5,
        { savingKey: "top_sellers", successToast: "מוצרי הבית נשמרו" }
      );
    } catch {
      toast("שמירת מוצרי הבית נכשלה", "error");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveLegal(slug: "terms" | "privacy" | "usage") {
    setSavingKey(`legal:${slug}`);
    try {
      const page = await apiFetch<{ page: LegalPage }>(`/api/content/legal/${slug}`, {
        method: "PUT",
        body: JSON.stringify({
          title: LEGAL_DEFAULTS[slug].title,
          body: { html: legalText[slug] },
          is_active: true,
        }),
      });
      setLegalPages((prev) => {
        const i = prev.findIndex((p) => p.slug === slug);
        if (i < 0) return [...prev, page.page];
        const next = [...prev];
        next[i] = page.page;
        return next;
      });
      toast("הדף נשמר", "success");
    } catch {
      toast("שמירת הדף נכשלה", "error");
    } finally {
      setSavingKey(null);
    }
  }

  function replaceTopSeller(slotIndex: number, product: Product) {
    setTopSellers((prev) => {
      const next = [...prev];
      if (next.some((x, i) => i !== slotIndex && x.product_id === product.id)) {
        toast("המוצר כבר קיים ברשימה", "warning");
        return prev;
      }
      const row: TopSeller = {
        id: next[slotIndex]?.id ?? `tmp-${slotIndex}-${product.id}`,
        product_id: product.id,
        sort_order: slotIndex,
        badge_text: next[slotIndex]?.badge_text ?? topSellerCfg.badgeTextDefault ?? null,
        is_active: true,
        products: product,
      };
      next[slotIndex] = row;
      return next.slice(0, 3).map((x, i) => ({ ...x, sort_order: i }));
    });
  }

  function moveTopSeller(index: number, dir: -1 | 1) {
    setTopSellers((prev) => {
      const next = [...prev];
      const ni = index + dir;
      if (ni < 0 || ni >= next.length) return prev;
      const [row] = next.splice(index, 1);
      next.splice(ni, 0, row);
      return next.map((x, i) => ({ ...x, sort_order: i }));
    });
  }

  function moveStudioCategory(index: number, dir: -1 | 1) {
    setStudioMainCategories((prev) => {
      const nextIndex = index + dir;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  if (loading) {
    return <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>טוען ניהול תוכן...</div>;
  }

  const showAdvancedTools = false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 18 }}>
      <PageHeader
        title="דף הבית - ניהול תוכן"
        subtitle="סדר קטגוריות בסטודיו ומוצרים בולטים בדף הבית. לכל חלק כפתור שמירה נפרד."
      />

      {showAdvancedTools ? (
      <Card>
        <SectionTitle title="עריכת מלל האתר (מידע קיים)" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {["hero", "benefits", "how_steps", "examples", "final_cta", "footer"].map((key) => (
            <div key={key}>
              <InputGroup label={key}>
                <textarea
                  value={textSections[key] ?? "{}"}
                  onChange={(e) => setTextSections((prev) => ({ ...prev, [key]: e.target.value }))}
                  rows={9}
                  style={{
                    width: "100%",
                    background: "var(--input)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    color: "var(--foreground)",
                    outline: "none",
                    fontSize: 13,
                    minHeight: 160,
                    resize: "vertical",
                  }}
                />
              </InputGroup>
              <div style={{ marginTop: 8 }}>
                <PrimaryButton type="button" onClick={() => saveTextSection(key)} disabled={savingKey === `text:${key}`}>
                  <PencilLine size={15} />
                  {savingKey === `text:${key}` ? "שומר..." : "שמור מלל"}
                </PrimaryButton>
              </div>
            </div>
          ))}
        </div>
      </Card>
      ) : null}

      <Card>
        <SectionTitle title="סדר קטגוריות בסטודיו" />
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.45 }}>
          קובע את סדר הטאבים/הרשימה בסטודיו בלבד. השמירה כאן לא משנה את מוצרי הבית.
        </p>
        <InputGroup label="קטגוריות (למעלה ↔ למטה)">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {studioMainCategories.map((cat, idx: number) => {
              return (
                <div key={cat.id} style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "var(--foreground-secondary)" }}>
                    {idx + 1}. {cat.label}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => moveStudioCategory(idx, -1)} style={iconBtnStyle()} disabled={idx === 0}>
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" onClick={() => moveStudioCategory(idx, 1)} style={iconBtnStyle()} disabled={idx === studioMainCategories.length - 1}>
                      <ArrowDown size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </InputGroup>
        <SaveBar loading={savingKey === "studio_category_order"} onSave={saveStudioCategoryOrder} label="שמור סדר קטגוריות" />
      </Card>

      <Card>
        <SectionTitle title="מוצרים מוצגים בדף הבית (3 בלבד)" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InputGroup label="כותרת סקשן">
            <TextInput value={topSellerCfg.title ?? ""} onChange={(e) => setTopSellerCfg((p: any) => ({ ...p, title: e.target.value }))} />
          </InputGroup>
          <InputGroup label="תת כותרת סקשן">
            <TextInput value={topSellerCfg.subtitle ?? ""} onChange={(e) => setTopSellerCfg((p: any) => ({ ...p, subtitle: e.target.value }))} />
          </InputGroup>
        </div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <InputGroup label="חיפוש מוצר להחלפה">
              <SearchField value={productSearch} onChange={setProductSearch} placeholder="חיפוש מוצר" />
            </InputGroup>
            <div style={{ marginTop: 8, maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => replaceTopSeller(selectedTopSellerSlot, p)}
                  style={{
                    width: "100%",
                    textAlign: "right",
                    background: "var(--input)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    color: "var(--foreground-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{p.title}</span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>₪{(p.price / 100).toLocaleString("he-IL")}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <InputGroup label="3 מוצרים מוצגים (בחר סלוט ואז החלף משמאל)">
              <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {[0, 1, 2].map((idx) => {
                  const x = topSellers[idx];
                  return (
                  <div
                    key={x?.product_id ?? `slot-${idx}`}
                    style={{
                      background: "var(--input)",
                      border: idx === selectedTopSellerSlot ? "1px solid rgba(201,169,110,0.55)" : "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 10
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 2 }}>מיקום {idx + 1}</div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "var(--foreground)" }}>{x?.products?.title ?? "לא נבחר מוצר"}</div>
                        <div style={{ marginTop: 3, fontSize: 11, color: "var(--muted-foreground)" }}>
                          מחיר: ₪{(((x?.products?.price ?? 0) / 100) || 0).toLocaleString("he-IL")}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" onClick={() => setSelectedTopSellerSlot(idx)} style={iconBtnStyle()}>
                          בחר
                        </button>
                        <button type="button" onClick={() => moveTopSeller(idx, -1)} style={iconBtnStyle()}>
                          <ArrowUp size={16} />
                        </button>
                        <button type="button" onClick={() => moveTopSeller(idx, 1)} style={iconBtnStyle()}>
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setTopSellers((prev) => prev.filter((z, zIdx) => (x ? z.product_id !== x.product_id : zIdx !== idx)))
                          }
                          style={{ ...iconBtnStyle(), color: "var(--destructive)", borderColor: "rgba(239,68,68,0.35)" }}
                          disabled={!x}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </InputGroup>
          </div>
        </div>
        <SaveBar loading={savingKey === "top_sellers"} onSave={saveFeaturedHomeProducts} label="שמור מוצרי בית" />
      </Card>

      {showAdvancedTools ? (
      <Card>
        <SectionTitle title="תקנון / פרטיות / תנאי שימוש" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {(["terms", "privacy", "usage"] as const).map((slug) => (
            <div key={slug}>
              <InputGroup label={LEGAL_DEFAULTS[slug].title}>
                <textarea
                  rows={12}
                  value={legalText[slug]}
                  onChange={(e) => setLegalText((prev) => ({ ...prev, [slug]: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "var(--input)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    color: "var(--foreground)",
                    outline: "none",
                    fontSize: 13,
                    minHeight: 220,
                    resize: "vertical",
                  }}
                />
              </InputGroup>
              <div style={{ marginTop: 8 }}>
                <PrimaryButton type="button" onClick={() => saveLegal(slug)} disabled={savingKey === `legal:${slug}`}>
                  {savingKey === `legal:${slug}` ? "שומר..." : "שמור"}
                </PrimaryButton>
              </div>
            </div>
          ))}
        </div>
      </Card>
      ) : null}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>{title}</div>
      <Badge variant="muted">DB</Badge>
    </div>
  );
}

function SaveBar({ loading, onSave, label = "שמור" }: { loading: boolean; onSave: () => void; label?: string }) {
  return (
    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-start" }}>
      <SmallBtn loading={loading} onClick={onSave}>
        <Save size={16} />
        {label}
      </SmallBtn>
    </div>
  );
}

function SmallBtn({
  loading,
  onClick,
  children,
}: {
  loading?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return <PrimaryButton type="button" onClick={onClick} disabled={loading}>{loading ? "שומר..." : children}</PrimaryButton>;
}

function iconBtnStyle(): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--input)",
    color: "var(--foreground-secondary)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

