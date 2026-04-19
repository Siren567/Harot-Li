 "use client";

import { useEffect, useRef, useState } from "react";
import { Circle, Eye, EyeOff, Heart, Minus, Pencil, Plus, RefreshCw, Square, Trash2, X } from "lucide-react";
import { useToast } from "../ui/toast";
import { apiFetch } from "../lib/api";
import { Card, InputGroup, PageHeader, PrimaryButton, SearchField, SecondaryButton, SelectInput, TextInput } from "../ui/primitives";
import { Badge } from "../ui/badge";

type Product = {
  id: string;
  title: string;
  slug: string;
  image_url: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sale_price?: number | null;
  available_colors?: string[];
  pendant_types?: string[];
  allow_customer_image_upload?: boolean;
  gallery_images?: string[];
  main_category_id?: string | null;
  subcategory_ids?: string[];
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
};

type ProductVariant = {
  id: string;
  productId: string;
  color: string | null;
  pendantType: string | null;
  material: string | null;
  stock: number;
  priceOverride: number | null;
  isActive: boolean;
};

type CategoryNode = {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  subcategories?: CategoryNode[];
};

type CategoryTreeResponse = { categories: CategoryNode[] };

const DEFAULT_CATEGORY_TREE: CategoryNode[] = [
  
];

type ProductForm = {
  title: string;
  slug: string;
  image_url: string;
  price: string;
  sale_price: string;
  is_active: boolean;
  available_colors: string[];
  pendant_types: string[];
  allow_customer_image_upload: boolean;
  gallery_images: string[];
  main_category_id: string;
  subcategory_ids: string[];
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
};

type ProductSeedPayload = {
  title: string;
  slug: string;
  price: number;
  image_url: string;
  available_colors: string[];
  pendant_types: string[];
  allow_customer_image_upload?: boolean;
  sale_price?: number;
  mainKey: "necklaces" | "bracelets" | "keychains" | "other";
  subKey?: "men" | "women";
};
const AVAILABLE_COLORS: Array<{ label: string; swatch: string }> = [
  { label: "זהב", swatch: "#d4af37" },
  { label: "רוז גולד", swatch: "#b76e79" },
  { label: "כסף", swatch: "#c0c0c0" },
  { label: "שחור מט", swatch: "#1f2937" },
];
const AVAILABLE_PENDANTS = ["לב", "עיגול", "ריבוע", "מלבן ארוך"];

const DEMO_PRODUCT_SEEDS: ProductSeedPayload[] = [
  {
    title: "שרשרת חריטה קלאסית לגבר",
    slug: "mens-classic-necklace",
    price: 16900,
    sale_price: 14900,
    image_url: "https://images.pexels.com/photos/10983791/pexels-photo-10983791.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    available_colors: ["כסף", "שחור מט", "זהב"],
    pendant_types: ["מלבן ארוך", "עיגול"],
    allow_customer_image_upload: true,
    mainKey: "necklaces",
    subKey: "men",
  },
  {
    title: "שרשרת אלגנט לנשים",
    slug: "women-elegant-necklace",
    price: 17900,
    image_url: "https://images.pexels.com/photos/5370698/pexels-photo-5370698.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    available_colors: ["זהב", "רוז גולד", "כסף"],
    pendant_types: ["לב", "עיגול"],
    allow_customer_image_upload: true,
    mainKey: "necklaces",
    subKey: "women",
  },
  {
    title: "צמיד גורמט אישי לגבר",
    slug: "mens-curb-bracelet",
    price: 15900,
    image_url: "https://images.pexels.com/photos/10983785/pexels-photo-10983785.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    available_colors: ["שחור מט", "כסף", "זהב"],
    pendant_types: ["מלבן ארוך", "ריבוע"],
    allow_customer_image_upload: true,
    mainKey: "bracelets",
    subKey: "men",
  },
  {
    title: "צמיד נשים עדין",
    slug: "women-delicate-bracelet",
    price: 14900,
    sale_price: 12900,
    image_url: "https://images.pexels.com/photos/5370698/pexels-photo-5370698.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    available_colors: ["זהב", "רוז גולד", "כסף"],
    pendant_types: ["לב", "עיגול"],
    allow_customer_image_upload: true,
    mainKey: "bracelets",
    subKey: "women",
  },
  {
    title: "מחזיק מפתחות עם חריטה",
    slug: "engraved-keychain",
    price: 9900,
    image_url: "https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    available_colors: ["כסף", "שחור מט", "זהב"],
    pendant_types: ["ריבוע", "מלבן ארוך"],
    allow_customer_image_upload: true,
    mainKey: "keychains",
  },
  {
    title: "מוצר חריטה מיוחד",
    slug: "special-engraving-item",
    price: 11900,
    image_url: "https://images.pexels.com/photos/10983783/pexels-photo-10983783.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    available_colors: ["זהב", "כסף"],
    pendant_types: ["לב", "עיגול", "ריבוע"],
    allow_customer_image_upload: false,
    mainKey: "other",
  },
];

function PendantIcon({ name }: { name: string }) {
  const common = { size: 14, color: "var(--primary)", strokeWidth: 2 };
  if (name === "לב") return <Heart {...common} fill="rgba(201,169,110,0.22)" />;
  if (name === "עיגול") return <Circle {...common} fill="rgba(201,169,110,0.18)" />;
  if (name === "ריבוע") return <Square {...common} fill="rgba(201,169,110,0.18)" />;
  return <Minus {...common} />;
}

function toForm(p?: Product | null): ProductForm {
  return {
    title: p?.title ?? "",
    slug: p?.slug ?? "",
    image_url: p?.image_url ?? "",
    price: p ? String((p.price / 100).toFixed(2)) : "0.00",
    sale_price: p?.sale_price && Number.isFinite(p.sale_price) ? String((p.sale_price / 100).toFixed(2)) : "",
    is_active: p?.is_active ?? true,
    available_colors: Array.isArray(p?.available_colors) ? p!.available_colors : [],
    pendant_types: Array.isArray(p?.pendant_types) ? p!.pendant_types : [],
    allow_customer_image_upload: Boolean(p?.allow_customer_image_upload),
    gallery_images: Array.isArray(p?.gallery_images) ? p!.gallery_images : [],
    main_category_id: p?.main_category_id ?? "",
    subcategory_ids: Array.isArray(p?.subcategory_ids) ? p!.subcategory_ids : [],
    seo_title: p?.seo_title ?? "",
    seo_description: p?.seo_description ?? "",
    seo_keywords: p?.seo_keywords ?? "",
  };
}

function fmtMoney(v: number) {
  return `₪${(Number(v || 0) / 100).toLocaleString("he-IL")}`;
}

function parseShekelsToAgorot(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const shekels = Number(normalized);
  if (!Number.isFinite(shekels) || shekels < 0) return null;
  return Math.round(shekels * 100);
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("he-IL");
  } catch {
    return "—";
  }
}

function normalizeCategoryTree(input: unknown): CategoryNode[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => {
      const childrenRaw = Array.isArray(row.subcategories) ? row.subcategories : [];
      const subcategories = childrenRaw
        .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === "object")
        .map((c) => ({
          id: String(c.id ?? ""),
          name: String(c.name ?? ""),
          parentId: c.parentId ? String(c.parentId) : null,
          isActive: c.isActive !== false,
          subcategories: [],
        }))
        .filter((c) => c.id && c.name);
      return {
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        parentId: row.parentId ? String(row.parentId) : null,
        isActive: row.isActive !== false,
        subcategories,
      } as CategoryNode;
    })
    .filter((c) => c.id && c.name);
}

function normalizeProducts(input: unknown): Product[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      slug: String(row.slug ?? ""),
      image_url: typeof row.image_url === "string" ? row.image_url : null,
      price: Number(row.price ?? 0),
      is_active: row.is_active !== false,
      created_at: String(row.created_at ?? ""),
      updated_at: String(row.updated_at ?? ""),
      sale_price: typeof row.sale_price === "number" ? row.sale_price : null,
      available_colors: Array.isArray(row.available_colors) ? row.available_colors.filter((x): x is string => typeof x === "string") : [],
      pendant_types: Array.isArray(row.pendant_types) ? row.pendant_types.filter((x): x is string => typeof x === "string") : [],
      allow_customer_image_upload: Boolean(row.allow_customer_image_upload),
      gallery_images: Array.isArray(row.gallery_images) ? row.gallery_images.filter((x): x is string => typeof x === "string") : [],
      main_category_id: typeof row.main_category_id === "string" ? row.main_category_id : null,
      subcategory_ids: Array.isArray(row.subcategory_ids) ? row.subcategory_ids.filter((x): x is string => typeof x === "string") : [],
      seo_title: typeof row.seo_title === "string" ? row.seo_title : null,
      seo_description: typeof row.seo_description === "string" ? row.seo_description : null,
      seo_keywords: typeof row.seo_keywords === "string" ? row.seo_keywords : null,
    }))
    .filter((p) => p.id && p.title);
}

function normalizeVariants(input: unknown): ProductVariant[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? ""),
      productId: String(row.productId ?? ""),
      color: typeof row.color === "string" ? row.color : null,
      pendantType: typeof row.pendantType === "string" ? row.pendantType : null,
      material: typeof row.material === "string" ? row.material : null,
      stock: Number.isFinite(Number(row.stock)) ? Number(row.stock) : 0,
      priceOverride: Number.isFinite(Number(row.priceOverride)) ? Number(row.priceOverride) : null,
      isActive: row.isActive !== false,
    }))
    .filter((v) => v.id && v.productId);
}

export function ProductEditorPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, ProductVariant[]>>({});
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(toForm());
  const [openCreateWhenEmpty, setOpenCreateWhenEmpty] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [productsFetchError, setProductsFetchError] = useState<string | null>(null);

  function findMainCategoryId(mainKey: ProductSeedPayload["mainKey"]) {
    const keyMap: Record<ProductSeedPayload["mainKey"], string[]> = {
      necklaces: ["necklace", "שרשר"],
      bracelets: ["bracelet", "צמיד"],
      keychains: ["key", "מחזיק"],
      other: ["other", "אחר"],
    };
    const terms = keyMap[mainKey];
    const match = categoryTree.find((c) => {
      const source = `${String(c.name || "").toLowerCase()} ${String(c.id || "").toLowerCase()}`;
      return terms.some((t) => source.includes(t));
    });
    return match?.id ?? "";
  }

  function findSubcategoryId(mainId: string, subKey?: ProductSeedPayload["subKey"]) {
    if (!mainId || !subKey) return "";
    const main = categoryTree.find((c) => c.id === mainId);
    const subs = main?.subcategories ?? [];
    const terms = subKey === "men" ? ["גבר", "men"] : ["נשים", "אישה", "women", "woman"];
    const match = subs.find((s) => {
      const source = `${String(s.name || "").toLowerCase()} ${String(s.id || "").toLowerCase()}`;
      return terms.some((t) => source.includes(t));
    });
    return match?.id ?? "";
  }

  async function seedDemoProducts() {
    if (seedingDemo) return;
    setSeedingDemo(true);
    try {
      let created = 0;
      for (const item of DEMO_PRODUCT_SEEDS) {
        const mainId = findMainCategoryId(item.mainKey);
        const subId = findSubcategoryId(mainId, item.subKey);
        await apiFetch<{ product: Product }>(`/api/products`, {
          method: "POST",
          body: JSON.stringify({
            title: item.title,
            slug: item.slug,
            image_url: item.image_url,
            price: item.price,
            sale_price: item.sale_price ?? null,
            is_active: true,
            available_colors: item.available_colors,
            pendant_types: item.pendant_types,
            allow_customer_image_upload: item.allow_customer_image_upload ?? true,
            gallery_images: [],
            main_category_id: mainId || null,
            subcategory_ids: subId ? [subId] : [],
          }),
        });
        created += 1;
      }
      setProductsFetchError(null);
      toast(`נטענו ${created} מוצרי דמו בהצלחה`, "success");
      await refresh({ silent: true });
    } catch (e: any) {
      if (e?.error === "SLUG_EXISTS") {
        toast("נראה שמוצרי הדמו כבר קיימים", "warning");
        await refresh({ silent: true });
      } else {
        toast("טעינת מוצרי דמו נכשלה", "error");
      }
    } finally {
      setSeedingDemo(false);
    }
  }

  async function refresh(opts?: { silent?: boolean }) {
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const [out, variantsOut] = await Promise.all([
        apiFetch<{ products: Product[] }>(`/api/products?${params.toString()}`),
        apiFetch<{ variants: ProductVariant[] }>("/api/variants"),
      ]);
      const normalizedProducts = normalizeProducts(out?.products);
      const normalizedVariants = normalizeVariants(variantsOut?.variants);
      const grouped = normalizedVariants.reduce<Record<string, ProductVariant[]>>((acc, variant) => {
        if (!acc[variant.productId]) acc[variant.productId] = [];
        acc[variant.productId].push(variant);
        return acc;
      }, {});
      setProducts(normalizedProducts);
      setVariantsByProduct(grouped);
      setProductsFetchError(null);
    } catch {
      setProducts([]);
      setVariantsByProduct({});
      setProductsFetchError("אין חיבור לשרת המוצרים כרגע. בדוק שה־Backend רץ על פורט 4000 ונסה שוב.");
      toast("טעינת מוצרים נכשלה", "error");
    } finally {
      if (opts?.silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const out = await apiFetch<CategoryTreeResponse>("/api/categories/tree");
        if (!mounted) return;
        const rows = normalizeCategoryTree(out?.categories);
        setCategoryTree(rows.length > 0 ? rows : DEFAULT_CATEGORY_TREE);
      } catch {
        if (!mounted) return;
        setCategoryTree(DEFAULT_CATEGORY_TREE);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => refresh({ silent: true }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const parsedPriceAgorot = parseShekelsToAgorot(form.price);
  const parsedSalePriceAgorot = form.sale_price.trim() ? parseShekelsToAgorot(form.sale_price) : null;
  const canSave = form.title.trim().length > 0 && parsedPriceAgorot !== null;
  const salePriceInvalid =
    parsedSalePriceAgorot !== null && parsedPriceAgorot !== null && parsedSalePriceAgorot >= parsedPriceAgorot;

  async function onSave() {
    if (salePriceInvalid) {
      toast("מחיר הנחה חייב להיות קטן מהמחיר הרגיל", "error");
      return;
    }
    if (!canSave) {
      toast("יש למלא שם מוצר ומחיר תקין", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || null,
        image_url: form.image_url.trim() || null,
        price: parsedPriceAgorot,
        sale_price: parsedSalePriceAgorot,
        available_colors: form.available_colors,
        pendant_types: form.pendant_types,
        allow_customer_image_upload: form.allow_customer_image_upload,
        gallery_images: form.gallery_images.map((x) => x.trim()).filter(Boolean),
        main_category_id: form.main_category_id || null,
        subcategory_ids: form.subcategory_ids,
        is_active: form.is_active,
        seo_title: form.seo_title.trim() || null,
        seo_description: form.seo_description.trim() || null,
        seo_keywords: form.seo_keywords.trim() || null,
      };
      const payloadSize = JSON.stringify(payload).length;
      if (payloadSize > 9_000_000) {
        toast("התמונות כבדות מדי לשמירה, נסה תמונות קטנות יותר", "error");
        return;
      }
      if (editing) {
        await apiFetch<{ product: Product }>(`/api/products/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast("המוצר נשמר בהצלחה", "success");
        setEditing(null);
        setOpenCreateWhenEmpty(false);
        setForm(toForm());
      } else {
        await apiFetch<{ product: Product }>(`/api/products`, { method: "POST", body: JSON.stringify(payload) });
        toast("המוצר נוסף בהצלחה", "success");
        setEditing(null);
        setOpenCreateWhenEmpty(false);
        setForm(toForm());
      }
      await refresh({ silent: true });
    } catch (e: any) {
      if (e?.error === "SLUG_EXISTS") {
        toast("slug כבר קיים", "error");
      } else if (e?.error === "VALIDATION") {
        const details = e?.details;
        let fieldError: string | undefined;
        if (details?.fieldErrors && typeof details.fieldErrors === "object") {
          for (const value of Object.values(details.fieldErrors as Record<string, unknown>)) {
            if (Array.isArray(value) && typeof value[0] === "string") {
              fieldError = value[0];
              break;
            }
          }
        }
        toast(fieldError || "נתונים לא תקינים לשמירה", "error");
      } else if (e?.error === "FETCH_ERROR") {
        toast("לא ניתן להתחבר לשרת, בדוק שה-Backend פעיל", "error");
      } else if (e?.error === "FETCH_TIMEOUT") {
        toast("השמירה נמשכה יותר מדי זמן. נסה שוב או הקטן את גודל התמונות", "error");
      } else {
        toast("שמירה נכשלה", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(product: Product) {
    if (!confirm(`למחוק את "${product.title}"?`)) return;
    try {
      await apiFetch(`/api/products/${product.id}`, { method: "DELETE" });
      toast("המוצר נמחק", "success");
      await refresh({ silent: true });
    } catch {
      toast("מחיקה נכשלה", "error");
    }
  }

  function onEdit(product: Product) {
    setEditing(product);
    setForm(toForm(product));
    setOpenCreateWhenEmpty(true);
  }

  async function onToggleVisibility(product: Product) {
    try {
      await apiFetch(`/api/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !product.is_active }),
      });
      toast(!product.is_active ? "המוצר מוצג כעת" : "המוצר הוסתר", "success");
      await refresh({ silent: true });
    } catch {
      toast("עדכון סטטוס תצוגה נכשל", "error");
    }
  }

  function statusBadge(isActive: boolean) {
    return isActive ? (
      <Badge variant="success">פעיל</Badge>
    ) : (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          borderRadius: 999,
          border: "1px solid rgba(239,68,68,0.25)",
          color: "rgba(255,220,220,0.9)",
          background: "rgba(239,68,68,0.12)",
          fontSize: 11,
          padding: "2px 8px",
          fontWeight: 700,
        }}
      >
        לא פעיל
      </span>
    );
  }

  const previewImage = form.image_url.trim();
  const hasValidSalePrice = parsedSalePriceAgorot !== null && !salePriceInvalid;
  const previewMainPrice = hasValidSalePrice ? parsedSalePriceAgorot : parsedPriceAgorot ?? 0;
  const optionalGallerySlots = [0, 1, 2, 3];
  const isCreateMode = openCreateWhenEmpty || Boolean(editing);
  const selectedMainCategory = categoryTree.find((c) => c.id === form.main_category_id) ?? null;
  const availableSubcategories = selectedMainCategory?.subcategories ?? [];
  const mainImageInputRef = useRef<HTMLInputElement | null>(null);
  const galleryImageInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const getGalleryAt = (index: number) => form.gallery_images[index] ?? "";
  const setGalleryAt = (index: number, value: string) => {
    setForm((prev) => {
      const next = [...prev.gallery_images];
      while (next.length <= index) next.push("");
      next[index] = value;
      return { ...prev, gallery_images: next };
    });
  };

  const onUploadImage = (file: File, onDone: (url: string) => void) => {
    if (!file.type.startsWith("image/")) {
      toast("ניתן להעלות קבצי תמונה בלבד", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const out = typeof reader.result === "string" ? reader.result : "";
      if (!out) {
        toast("העלאה נכשלה", "error");
        return;
      }
      onDone(out);
      toast("התמונה נטענה", "success");
    };
    reader.onerror = () => toast("העלאה נכשלה", "error");
    reader.readAsDataURL(file);
  };

  if (!loading && products.length === 0 && !openCreateWhenEmpty) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: "70vh" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--foreground)" }}>קטלוג מוצרים</div>
          <div style={{ display: "flex", justifyContent: "flex-start", direction: "ltr" }}>
            <PrimaryButton
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(toForm());
                setOpenCreateWhenEmpty(true);
              }}
              style={{ padding: "12px 20px", minWidth: 150, fontSize: 14, lineHeight: 1.1 }}
            >
              <Plus size={16} />
              מוצר חדש
            </PrimaryButton>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--muted-foreground)" }}>
              {productsFetchError ? "הקטלוג לא נטען כרגע" : "אין מוצרים בקטלוג"}
            </div>
            {productsFetchError ? (
              <div
                style={{
                  maxWidth: 560,
                  fontSize: 13,
                  textAlign: "center",
                  color: "var(--destructive)",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.22)",
                  borderRadius: 12,
                  padding: "10px 12px",
                }}
              >
                {productsFetchError}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <SecondaryButton type="button" onClick={() => refresh({ silent: true })} disabled={refreshing || seedingDemo}>
                נסה שוב
              </SecondaryButton>
              <SecondaryButton type="button" onClick={seedDemoProducts} disabled={seedingDemo || Boolean(productsFetchError)}>
                {seedingDemo ? "טוען מוצרי דמו..." : "הטען מוצרי דמו"}
              </SecondaryButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "stretch", width: "100%" }}>
      <div style={{ flex: 1.6, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        {!isCreateMode ? (
          <>
            <PageHeader
              title="מוצרים"
              subtitle="ניהול מוצרים אמיתי המחובר ל־Backend החדש."
              actions={
                <div style={{ direction: "ltr" }}>
                  <PrimaryButton
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setForm(toForm());
                      setOpenCreateWhenEmpty(true);
                    }}
                    style={{ minWidth: 156, padding: "11px 18px", fontSize: 15, lineHeight: 1.1 }}
                  >
                    <Plus size={16} />
                    הוסף מוצר
                  </PrimaryButton>
                </div>
              }
            />

            <Card>
              {productsFetchError ? (
                <div
                  style={{
                    marginBottom: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(239,68,68,0.22)",
                    background: "rgba(239,68,68,0.08)",
                    color: "var(--destructive)",
                    fontSize: 12,
                    padding: "8px 10px",
                  }}
                >
                  {productsFetchError}
                </div>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                <SearchField value={query} onChange={setQuery} placeholder="חיפוש מוצר לפי שם או slug" />
                <SecondaryButton
                  type="button"
                  onClick={() => refresh({ silent: true })}
                  aria-label="רענון"
                  title="רענון"
                  style={{ width: 38, height: 38, padding: 0, justifyContent: "center" }}
                >
                  <RefreshCw size={15} style={{ opacity: refreshing ? 0.7 : 1 }} />
                </SecondaryButton>
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)", marginBottom: 10 }}>רשימת מוצרים</div>
              {loading ? (
                <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>טוען מוצרים...</div>
              ) : products.length === 0 ? (
                <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>אין מוצרים להצגה</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                        {["מוצר", "קטגוריה / תת קטגוריה", "מלאי", "תאריך הוספה", "סטטוס", "מחיר", "פעולות"].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "right",
                              padding: "12px 14px",
                              fontSize: 11,
                              color: "var(--muted-foreground)",
                              fontWeight: 800,
                              borderBottom: "1px solid var(--border)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p, idx) => (
                        <tr
                          key={p.id}
                          style={{ borderTop: idx > 0 ? "1px solid var(--border-subtle)" : "none", transition: "background-color 0.15s ease" }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.03)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                          }}
                        >
                          <td style={{ padding: "12px 14px", color: "var(--foreground)", fontWeight: 700 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ width: 42, height: 42, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", background: "var(--input)", flexShrink: 0 }}>
                                {p.image_url ? (
                                  <img src={p.image_url} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : null}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {p.title}
                                </div>
                                <div style={{ marginTop: 2, fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {p.slug}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--muted-foreground)", fontSize: 12 }}>
                            {(() => {
                              const main = categoryTree.find((c) => c.id === p.main_category_id);
                              const subs = (p.subcategory_ids ?? [])
                                .map((sid) => main?.subcategories?.find((s) => s.id === sid)?.name)
                                .filter(Boolean) as string[];
                              if (!main && subs.length === 0) return "—";
                              return `${main?.name ?? "—"}${subs.length ? ` / ${subs.join(", ")}` : ""}`;
                            })()}
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--foreground-secondary)", fontSize: 12 }}>
                            {(() => {
                              const variants = variantsByProduct[p.id] ?? [];
                              if (variants.length === 0) return "—";
                              const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
                              const preview = variants
                                .slice(0, 2)
                                .map((v) => `${v.color || "—"} / ${v.pendantType || "—"}: ${v.stock}`)
                                .join(" | ");
                              const extra = variants.length > 2 ? ` (+${variants.length - 2})` : "";
                              return `${totalStock} יח' (${preview}${extra})`;
                            })()}
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--muted-foreground)", fontSize: 12 }}>{fmtDate(p.created_at)}</td>
                          <td style={{ padding: "12px 14px" }}>{statusBadge(p.is_active)}</td>
                          <td style={{ padding: "12px 14px", color: "var(--foreground-secondary)", fontWeight: 800 }}>
                            {typeof p.sale_price === "number" && p.sale_price > 0 && p.sale_price < p.price ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ color: "#b7873f", fontWeight: 900, fontSize: 14 }}>{fmtMoney(p.sale_price)}</span>
                                <span style={{ fontSize: 11, color: "var(--muted-foreground)", textDecoration: "line-through", opacity: 0.9 }}>{fmtMoney(p.price)}</span>
                              </div>
                            ) : (
                              fmtMoney(p.price)
                            )}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                aria-label={p.is_active ? "מוצג" : "לא מוצג"}
                                title={p.is_active ? "מוצג" : "לא מוצג"}
                                onClick={() => onToggleVisibility(p)}
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 8,
                                  border: "1px solid var(--border)",
                                  background: "var(--input)",
                                  color: p.is_active ? "var(--info)" : "var(--muted-foreground)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = "var(--input)";
                                }}
                              >
                                {p.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                              <button
                                type="button"
                                aria-label="עריכת מוצר"
                                title="עריכה"
                                onClick={() => onEdit(p)}
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 8,
                                  border: "1px solid rgba(201,169,110,0.35)",
                                  background: "var(--input)",
                                  color: "#c9a96e",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = "rgba(201,169,110,0.12)";
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = "var(--input)";
                                }}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(p)}
                                aria-label="מחיקת מוצר"
                                title="מחיקה"
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 8,
                                  border: "1px solid rgba(239,68,68,0.25)",
                                  background: "var(--input)",
                                  color: "var(--destructive)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)";
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = "var(--input)";
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        ) : null}

        {isCreateMode ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>
              {editing ? "עריכת מוצר" : "יצירת מוצר"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, direction: "ltr" }}>
              <button
                type="button"
                aria-label="סגור מסך יצירה"
                onClick={() => {
                  setEditing(null);
                  setForm(toForm());
                  setOpenCreateWhenEmpty(false);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--input)",
                  color: "var(--muted-foreground)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
              <button
                type="button"
                aria-label="נקה הכל"
                onClick={() => {
                  setEditing(null);
                  setForm(toForm());
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--input)",
                  color: "var(--muted-foreground)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InputGroup label="שם מוצר" required>
              <TextInput value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </InputGroup>
            <InputGroup label="slug">
              <TextInput value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} />
            </InputGroup>
            <InputGroup label="מחיר (ש״ח)" required>
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                placeholder="149.90"
              />
            </InputGroup>
            <InputGroup label="מחיר הנחה (ש״ח)">
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={form.sale_price}
                onChange={(e) => setForm((p) => ({ ...p, sale_price: e.target.value }))}
                placeholder="129.90"
              />
              {salePriceInvalid ? (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--destructive)" }}>מחיר הנחה חייב להיות קטן מהמחיר הרגיל</div>
              ) : null}
            </InputGroup>
            <InputGroup label="קטגוריה ראשית">
              <SelectInput
                value={form.main_category_id}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    main_category_id: e.target.value,
                    subcategory_ids: [],
                  }))
                }
              >
                <option value="">ללא קטגוריה</option>
                {categoryTree
                  .filter((c) => c.isActive !== false)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </SelectInput>
            </InputGroup>
            <InputGroup label="תתי קטגוריות (אפשר לבחור כמה)">
              {!form.main_category_id ? (
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", padding: "10px 12px", border: "1px dashed var(--border)", borderRadius: 10 }}>
                  בחר קטגוריה ראשית כדי לבחור תתי קטגוריות
                </div>
              ) : availableSubcategories.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", padding: "10px 12px", border: "1px dashed var(--border)", borderRadius: 10 }}>
                  אין תתי קטגוריות לקטגוריה שנבחרה
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {availableSubcategories
                    .filter((s) => s.isActive !== false)
                    .map((sub) => {
                      const checked = form.subcategory_ids.includes(sub.id);
                      return (
                        <button
                          type="button"
                          key={sub.id}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              subcategory_ids: checked
                                ? prev.subcategory_ids.filter((id) => id !== sub.id)
                                : [...prev.subcategory_ids, sub.id],
                            }))
                          }
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "7px 10px",
                            border: checked ? "1px solid #60a5fa" : "1px solid var(--border)",
                            borderRadius: 999,
                            background: checked ? "rgba(96,165,250,0.12)" : "var(--input)",
                            boxShadow: checked ? "0 0 0 1px rgba(96,165,250,0.18) inset" : "none",
                            fontSize: 12,
                            color: "var(--foreground)",
                            cursor: "pointer",
                          }}
                        >
                          {sub.name}
                        </button>
                      );
                    })}
                </div>
              )}
            </InputGroup>
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
              <InputGroup label="SEO — כותרת דף">
                <TextInput
                  value={form.seo_title}
                  onChange={(e) => setForm((p) => ({ ...p, seo_title: e.target.value }))}
                  placeholder="למשל: שרשרת חריטה לגבר"
                />
              </InputGroup>
              <InputGroup label="SEO — מילות מפתח (Google)">
                <TextInput
                  value={form.seo_keywords}
                  onChange={(e) => setForm((p) => ({ ...p, seo_keywords: e.target.value }))}
                  placeholder="מופרדות בפסיק: חריטה, מתנה, אישית"
                />
              </InputGroup>
              <div style={{ gridColumn: "1 / -1" }}>
                <InputGroup label="SEO — תיאור">
                  <textarea
                    value={form.seo_description}
                    onChange={(e) => setForm((p) => ({ ...p, seo_description: e.target.value }))}
                    rows={2}
                    style={{
                      width: "100%",
                      background: "var(--input)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      color: "var(--foreground)",
                      fontSize: 13,
                      resize: "vertical",
                    }}
                  />
                </InputGroup>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InputGroup label="צבעים זמינים">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AVAILABLE_COLORS.map((color) => {
                  const checked = form.available_colors.includes(color.label);
                  return (
                    <button
                      type="button"
                      key={color.label}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          available_colors: checked
                            ? prev.available_colors.filter((x) => x !== color.label)
                            : [...prev.available_colors, color.label],
                        }))
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 10px",
                        border: checked ? "1px solid #60a5fa" : "1px solid var(--border)",
                        borderRadius: 999,
                        background: checked ? `${color.swatch}55` : `${color.swatch}22`,
                        boxShadow: checked ? "0 0 0 1px rgba(96,165,250,0.18) inset" : "none",
                        fontSize: 12,
                        fontWeight: checked ? 700 : 500,
                        color: "var(--foreground)",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: color.swatch,
                          border: "1px solid rgba(255,255,255,0.45)",
                          display: "inline-block",
                          boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
                        }}
                      />
                      {color.label}
                    </button>
                  );
                })}
              </div>
            </InputGroup>

            <InputGroup label="סוגי תליונים">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AVAILABLE_PENDANTS.map((pendant) => {
                  const checked = form.pendant_types.includes(pendant);
                  return (
                    <button
                      type="button"
                      key={pendant}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          pendant_types: checked
                            ? prev.pendant_types.filter((x) => x !== pendant)
                            : [...prev.pendant_types, pendant],
                        }))
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 10px",
                        border: checked ? "1px solid #60a5fa" : "1px solid var(--border)",
                        borderRadius: 999,
                        background: checked ? "rgba(96,165,250,0.12)" : "var(--input)",
                        boxShadow: checked ? "0 0 0 1px rgba(96,165,250,0.18) inset" : "none",
                        fontSize: 12,
                        color: "var(--foreground)",
                        cursor: "pointer",
                      }}
                    >
                      <PendantIcon name={pendant} />
                      {pendant}
                    </button>
                  );
                })}
              </div>
            </InputGroup>
          </div>

          {editing ? (
            <div
              style={{
                marginTop: 10,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px dashed var(--border)",
                background: "var(--input)",
                fontSize: 12,
                color: "var(--muted-foreground)",
                lineHeight: 1.5,
              }}
            >
              ניהול מלאי לפי וריאציות (צבע, תליון, מחיר מיוחד) מתבצע ב־
              <a href="/admin/inventory" style={{ color: "var(--primary)", fontWeight: 800, marginInlineStart: 4 }}>
                מלאי
              </a>
              .
            </div>
          ) : null}

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 12,
              fontSize: 13,
              color: "var(--foreground-secondary)",
              border: "1px solid var(--border)",
              background: "var(--input)",
              borderRadius: 12,
              padding: "10px 12px",
              minHeight: 44,
            }}
          >
            <input
              type="checkbox"
              checked={form.allow_customer_image_upload}
              onChange={(e) => setForm((p) => ({ ...p, allow_customer_image_upload: e.target.checked }))}
              style={{ accentColor: "var(--primary)", width: 16, height: 16, flexShrink: 0 }}
            />
            <span style={{ lineHeight: 1.3, fontWeight: 700 }}>לאפשר ללקוח להעלות תמונה אישית</span>
          </label>

          <InputGroup label="תמונות מוצר">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}>תמונה ראשית</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                <TextInput
                  value={form.image_url}
                  onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                  placeholder="כתובת URL של התמונה הראשית"
                />
                <input
                  ref={(el) => {
                    mainImageInputRef.current = el;
                  }}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    onUploadImage(file, (url) => setForm((p) => ({ ...p, image_url: url })));
                    e.currentTarget.value = "";
                  }}
                />
                <SecondaryButton type="button" onClick={() => mainImageInputRef.current?.click()}>
                  העלאה מהמחשב
                </SecondaryButton>
              </div>

              {optionalGallerySlots.map((slot, idx) => (
                <div key={slot} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 700 }}>
                    תמונה {idx + 2} (אופציונלי)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                    <TextInput
                      value={getGalleryAt(slot)}
                      onChange={(e) => setGalleryAt(slot, e.target.value)}
                      placeholder="או הדבקת קישור למעלה"
                    />
                    <input
                      ref={(el) => {
                        galleryImageInputRefs.current[slot] = el;
                      }}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        onUploadImage(file, (url) => setGalleryAt(slot, url));
                        e.currentTarget.value = "";
                      }}
                    />
                    <SecondaryButton type="button" onClick={() => galleryImageInputRefs.current[slot]?.click()}>
                      העלאה מהמחשב
                    </SecondaryButton>
                  </div>
                </div>
              ))}
            </div>
          </InputGroup>

          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <PrimaryButton type="button" onClick={onSave} disabled={saving}>
              {saving ? "שומר..." : "שמור"}
            </PrimaryButton>
          </div>
        </Card>
        ) : null}
      </div>

      {isCreateMode ? (
      <div style={{ width: 430, maxWidth: "38vw", display: "flex", justifyContent: "center" }}>
        <Card padding={16}>
          <style>
            {`@keyframes salePricePulse {
                0% { transform: scale(1); text-shadow: 0 0 0 rgba(201,169,110,0); }
                50% { transform: scale(1.04); text-shadow: 0 0 16px rgba(201,169,110,0.42), 0 0 28px rgba(245,189,79,0.22); }
                100% { transform: scale(1); text-shadow: 0 0 0 rgba(201,169,110,0); }
              }`}
          </style>
          <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>תצוגה מקדימה</div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
            <div
              style={{
                width: 390,
                background: "#f3efe9",
                border: "1px solid #c49a76",
                borderRadius: 18,
                padding: 12,
                color: "#1d1d1d",
              }}
            >
              <div style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 14, overflow: "hidden", background: "#e8e0d7" }}>
                {previewImage ? <img src={previewImage} alt={form.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
              </div>
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                  {form.title || "שם מוצר"}
                </div>
                <div style={{ marginTop: 8, fontSize: 32, fontWeight: 800, color: "#272727" }}>
                  <span
                    style={
                      hasValidSalePrice
                        ? {
                            color: "#b7873f",
                            display: "inline-block",
                            animation: "salePricePulse 1.6s ease-in-out infinite",
                          }
                        : undefined
                    }
                  >
                    {fmtMoney(previewMainPrice)}
                  </span>
                </div>
                {hasValidSalePrice ? (
                  <div style={{ marginTop: 4, fontSize: 18, color: "#7c7c7c", textDecoration: "line-through" }}>
                    {fmtMoney(parsedPriceAgorot ?? 0)}
                  </div>
                ) : null}
                {hasValidSalePrice ? (
                  <div
                    style={{
                      marginTop: 6,
                      display: "inline-flex",
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "rgba(201,169,110,0.18)",
                      color: "#9a6b2d",
                      fontSize: 13,
                      fontWeight: 800,
                      boxShadow: "0 0 14px rgba(201,169,110,0.18)",
                    }}
                  >
                    מחיר מבצע
                  </div>
                ) : null}
                <div style={{ marginTop: 12, display: "flex", justifyContent: "center", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {form.available_colors.map((color) => {
                    const swatch = AVAILABLE_COLORS.find((c) => c.label === color)?.swatch ?? "#9ca3af";
                    return (
                      <span
                        key={color}
                        title={color}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: swatch,
                          border: "2px solid rgba(0,0,0,0.25)",
                          display: "inline-block",
                        }}
                      />
                    );
                  })}
                </div>
                {form.available_colors.length === 0 ? (
                  <div style={{ marginTop: 8, fontSize: 13, color: "#6a6a6a" }}>לא נבחרו צבעים זמינים</div>
                ) : null}
                <button
                  type="button"
                  style={{
                    marginTop: 16,
                    minWidth: 120,
                    height: 44,
                    borderRadius: 999,
                    border: "1px solid #b5845e",
                    background: "#f3efe9",
                    color: "#2b2b2b",
                    fontSize: 22,
                    fontWeight: 700,
                    cursor: "default",
                  }}
                >
                  בחר
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
      ) : null}
    </div>
  );
}

