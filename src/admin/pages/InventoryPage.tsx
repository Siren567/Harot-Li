"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../ui/badge";
import { useToast } from "../ui/toast";
import { apiFetch } from "../lib/api";
import { InputGroup, TextInput } from "../ui/primitives";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

type InventoryStatus = "in_stock" | "low" | "out_of_stock";

type InventoryProduct = {
  id: string;
  name: string;
  imageUrl: string;
  sku: string;
  category: string;
  customizable: boolean;
  stock: number;
  lowThreshold: number;
  price: number;
  variants: Array<{ id: string; label: string; stock: number }>;
};

type ProductApiRow = {
  id: string;
  title: string;
  slug: string;
  image_url: string | null;
  price: number;
  allow_customer_image_upload?: boolean;
  main_category_id?: string | null;
  main_category_name?: string | null;
  stock?: number;
  low_threshold?: number;
};

type ProductVariantApiRow = {
  id: string;
  productId: string;
  color?: string | null;
  pendantType?: string | null;
  material?: string | null;
  stock?: number;
  priceOverride?: number | null;
};

/** Full variant row for editing (same shape as product editor previously used). */
export type InventoryVariantFull = {
  id: string;
  productId: string;
  color: string | null;
  pendantType: string | null;
  material: string | null;
  stock: number;
  priceOverride: number | null;
  isActive: boolean;
};

function normalizeInventoryVariants(input: unknown): InventoryVariantFull[] {
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

function parseShekelsToAgorot(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const shekels = Number(normalized);
  if (!Number.isFinite(shekels) || shekels < 0) return null;
  return Math.round(shekels * 100);
}

function fmtMoney(v: number) {
  return `₪${(Number(v || 0) / 100).toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function getStatus(stock: number, lowThreshold: number): InventoryStatus {
  if (stock <= 0) return "out_of_stock";
  if (stock <= lowThreshold) return "low";
  return "in_stock";
}

function statusLabel(status: InventoryStatus) {
  if (status === "in_stock") return "במלאי";
  if (status === "low") return "מלאי נמוך";
  return "אזל מהמלאי";
}

function statusVariant(status: InventoryStatus): "success" | "warning" | "error" {
  if (status === "in_stock") return "success";
  if (status === "low") return "warning";
  return "error";
}

function inputStyle(pulse: boolean): React.CSSProperties {
  return {
    width: "110px",
    background: "var(--input)",
    border: `1px solid ${pulse ? "rgba(201,169,110,0.7)" : "var(--border)"}`,
    borderRadius: "12px",
    padding: "9px 12px",
    color: "var(--foreground)",
    outline: "none",
    fontSize: "13px",
    textAlign: "right",
  };
}

function SmallButton({
  tone,
  children,
  onClick,
  disabled,
}: {
  tone?: "primary" | "default" | "danger";
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const bg =
    tone === "primary" ? "var(--primary)" : tone === "danger" ? "rgba(239,68,68,0.12)" : "var(--input)";
  const border =
    tone === "primary" ? "1px solid rgba(201,169,110,0.35)" : tone === "danger" ? "1px solid rgba(239,68,68,0.25)" : "1px solid var(--border)";
  const color =
    tone === "primary" ? "var(--primary-foreground)" : tone === "danger" ? "var(--destructive)" : "var(--foreground-secondary)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg,
        border,
        color,
        borderRadius: "10px",
        padding: "8px 10px",
        fontSize: "12px",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

type VariantDraft = {
  color: string;
  pendantType: string;
  material: string;
  stock: string;
  priceOverride: string;
  isActive: boolean;
};

function Drawer({
  open,
  product,
  variants,
  onClose,
  onVariantsSaved,
}: {
  open: boolean;
  product: InventoryProduct | null;
  variants: InventoryVariantFull[];
  onClose: () => void;
  onVariantsSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [variantDrafts, setVariantDrafts] = useState<Record<string, VariantDraft>>({});
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);
  const [savingAllVariants, setSavingAllVariants] = useState(false);
  const [addingVariant, setAddingVariant] = useState(false);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);

  const variantsSyncKey = useMemo(
    () => variants.map((v) => `${v.id}:${v.stock}:${v.priceOverride}:${v.color}:${v.pendantType}:${v.material}`).join("|"),
    [variants]
  );

  useEffect(() => {
    if (!open || !product) return;
    const next: Record<string, VariantDraft> = {};
    for (const v of variants) {
      next[v.id] = {
        color: v.color ?? "",
        pendantType: v.pendantType ?? "",
        material: v.material ?? "",
        stock: String(v.stock ?? 0),
        priceOverride:
          v.priceOverride != null && Number.isFinite(v.priceOverride) ? (v.priceOverride / 100).toFixed(2) : "",
        isActive: v.isActive !== false,
      };
    }
    setVariantDrafts(next);
  }, [open, product?.id, variantsSyncKey, variants]);

  const updateDraft = useCallback((variantId: string, patch: Partial<VariantDraft>) => {
    setVariantDrafts((prev) => {
      const cur = prev[variantId];
      if (!cur) return prev;
      return { ...prev, [variantId]: { ...cur, ...patch } };
    });
  }, []);

  async function saveVariant(variantId: string, options?: { skipRefresh?: boolean; silent?: boolean }) {
    const d = variantDrafts[variantId];
    if (!d) return;
    const stockNum = Math.max(0, Math.floor(Number(d.stock) || 0));
    const priceAgorot = parseShekelsToAgorot(d.priceOverride.trim());
    if (d.priceOverride.trim() && priceAgorot === null) {
      toast("מחיר מיוחד לא תקין (לדוגמה 12.90)", "error");
      return;
    }
    setSavingVariantId(variantId);
    try {
      await apiFetch(`/api/variants/${variantId}`, {
        method: "PATCH",
        body: JSON.stringify({
          color: d.color.trim() || null,
          pendantType: d.pendantType.trim() || null,
          material: d.material.trim() || null,
          stock: stockNum,
          priceOverride: d.priceOverride.trim() ? priceAgorot : null,
          isActive: Boolean(d.isActive),
        }),
      });
      if (!options?.silent) toast("הוריאציה נשמרה", "success");
      if (!options?.skipRefresh) await onVariantsSaved();
    } catch {
      toast("שמירת וריאציה נכשלה", "error");
    } finally {
      setSavingVariantId(null);
    }
  }

  async function addVariant() {
    if (!product) return;
    setAddingVariant(true);
    try {
      await apiFetch("/api/variants", {
        method: "POST",
        body: JSON.stringify({
          productId: product.id,
          color: "חדש",
          stock: 0,
          lowThreshold: 5,
          isActive: true,
        }),
      });
      toast("ווריאציה נוספה", "success");
      await onVariantsSaved();
    } catch (e: any) {
      if (e?.error === "VARIANT_COMBINATION_EXISTS") {
        toast("כבר קיימת וריאציה זהה. עדכן צבע/צורה בווריאציה קיימת.", "warning");
      } else {
        toast("הוספת וריאציה נכשלה", "error");
      }
    } finally {
      setAddingVariant(false);
    }
  }

  async function deleteVariant(variantId: string) {
    if (variants.length <= 1) {
      toast("חייבת להישאר לפחות וריאציה אחת", "warning");
      return;
    }
    setDeletingVariantId(variantId);
    try {
      await apiFetch(`/api/variants/${variantId}`, { method: "DELETE" });
      toast("ווריאציה נמחקה", "success");
      await onVariantsSaved();
    } catch {
      toast("מחיקת וריאציה נכשלה", "error");
    } finally {
      setDeletingVariantId(null);
    }
  }

  async function saveAllVariants() {
    if (variants.length === 0) return;
    setSavingAllVariants(true);
    try {
      for (const v of variants) {
        await saveVariant(v.id, { skipRefresh: true, silent: true });
      }
      toast("כל הווריאציות נשמרו", "success");
      await onVariantsSaved();
    } finally {
      setSavingAllVariants(false);
    }
  }

  if (!open) return null;
  const s = product ? getStatus(product.stock, product.lowThreshold) : "in_stock";
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200 }} onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100svh",
          width: "min(780px, 94vw)",
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "18px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--foreground)" }}>מלאי — וריאציות</div>
            <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "2px" }}>
              {product?.name ?? "—"} · {product?.sku ?? "—"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              background: "var(--input)",
              color: "var(--foreground-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", flex: 1, minHeight: 0 }}>
          {product ? (
            <>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{ width: 96, height: 96, borderRadius: 14, overflow: "hidden", background: "var(--input)", border: "1px solid var(--border)", flexShrink: 0 }}>
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "var(--foreground)", lineHeight: 1.2 }}>{product.name}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Badge variant={statusVariant(s)}>{statusLabel(s)}</Badge>
                    {product.customizable ? <Badge variant="default">מותאם אישית</Badge> : <Badge variant="muted">לא מותאם אישית</Badge>}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)" }}>
                    מחיר בסיס: <span style={{ color: "var(--foreground-secondary)", fontWeight: 900 }}>{fmtMoney(product.price)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 800 }}>מלאי כולל (לפי וריאציות)</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "var(--foreground-secondary)", fontWeight: 900 }}>{product.stock}</div>
                </div>
                <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 800 }}>התראת מלאי נמוך (בטבלה)</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "var(--foreground-secondary)", fontWeight: 900 }}>{product.lowThreshold}</div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>
                    ווריאציות מוצר ({variants.length})
                  </div>
                  <button
                    type="button"
                    onClick={addVariant}
                    disabled={addingVariant}
                    style={{
                      border: "1px solid var(--border)",
                      background: "var(--input)",
                      color: "var(--foreground-secondary)",
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: addingVariant ? "not-allowed" : "pointer",
                      opacity: addingVariant ? 0.65 : 1,
                    }}
                  >
                    <Plus size={14} />
                    {addingVariant ? "מוסיף..." : "הוסף וריאציה"}
                  </button>
                </div>
                {variants.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                    אין וריאציות פעילות למוצר זה. הזמנות מהחנות דורשות וריאציה פעילה.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {variants.map((v) => {
                      const d = variantDrafts[v.id];
                      if (!d) return null;
                      return (
                        <div
                          key={v.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr)) 88px 100px 88px auto",
                            gap: 8,
                            alignItems: "end",
                            background: "var(--input)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            padding: 12,
                          }}
                        >
                          <InputGroup label="צבע">
                            <TextInput value={d.color} onChange={(e) => updateDraft(v.id, { color: e.target.value })} />
                          </InputGroup>
                          <InputGroup label="סוג תליון">
                            <TextInput value={d.pendantType} onChange={(e) => updateDraft(v.id, { pendantType: e.target.value })} />
                          </InputGroup>
                          <InputGroup label="חומר">
                            <TextInput value={d.material} onChange={(e) => updateDraft(v.id, { material: e.target.value })} />
                          </InputGroup>
                          <InputGroup label="מלאי">
                            <TextInput type="number" min={0} value={d.stock} onChange={(e) => updateDraft(v.id, { stock: e.target.value })} />
                          </InputGroup>
                          <InputGroup label="מחיר מיוחד (₪)">
                            <TextInput placeholder="0.00" value={d.priceOverride} onChange={(e) => updateDraft(v.id, { priceOverride: e.target.value })} />
                          </InputGroup>
                          <InputGroup label="סטטוס">
                            <label style={{ display: "flex", alignItems: "center", gap: 8, height: 40 }}>
                              <input
                                type="checkbox"
                                checked={Boolean(d.isActive)}
                                onChange={(e) => updateDraft(v.id, { isActive: e.target.checked })}
                                style={{ accentColor: "var(--primary)" }}
                              />
                              <span style={{ fontSize: 12, color: "var(--foreground-secondary)", fontWeight: 800 }}>
                                {d.isActive ? "פעיל" : "כבוי"}
                              </span>
                            </label>
                          </InputGroup>
                          <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
                            <button
                              type="button"
                              aria-label="מחק וריאציה"
                              title="מחק וריאציה"
                              onClick={() => deleteVariant(v.id)}
                              disabled={deletingVariantId === v.id || variants.length <= 1}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                border: "1px solid rgba(239,68,68,0.3)",
                                background: "rgba(239,68,68,0.08)",
                                color: "var(--destructive)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor:
                                  deletingVariantId === v.id || variants.length <= 1 || savingAllVariants
                                    ? "not-allowed"
                                    : "pointer",
                                opacity: deletingVariantId === v.id || variants.length <= 1 || savingAllVariants ? 0.5 : 1,
                                alignSelf: "end",
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>אין מוצר להצגה.</div>
          )}
        </div>

        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-start", flexShrink: 0 }}>
          <SmallButton tone="primary" onClick={saveAllVariants} disabled={savingAllVariants || Boolean(savingVariantId)}>
            {savingAllVariants ? "שומר שינויים..." : "שמור שינויים"}
          </SmallButton>
          <SmallButton tone="primary" onClick={onClose}>
            סיום
          </SmallButton>
        </div>
      </aside>
    </>
  );
}

export function InventoryPage() {
  const toast = useToast();
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [customizableFilter, setCustomizableFilter] = useState<"all" | "yes" | "no">("all");

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ["all", ...Array.from(set)];
  }, [products]);

  async function refreshInventory(silent?: boolean) {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    try {
      const [out, variantsOut] = await Promise.all([
        apiFetch<{ products: ProductApiRow[] }>("/api/products"),
        apiFetch<{ variants: ProductVariantApiRow[] }>("/api/variants"),
      ]);
      const rows = Array.isArray(out?.products) ? out.products : [];
      const variants = Array.isArray(variantsOut?.variants) ? variantsOut.variants : [];
      const byProduct = variants.reduce<Record<string, ProductVariantApiRow[]>>((acc, v) => {
        const key = String(v.productId || "");
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(v);
        return acc;
      }, {});
      const normalizedFull = normalizeInventoryVariants(variants);
      const fullByProduct = normalizedFull.reduce<Record<string, InventoryVariantFull[]>>((acc, v) => {
        const key = v.productId;
        if (!acc[key]) acc[key] = [];
        acc[key].push(v);
        return acc;
      }, {});
      setFullVariantsByProduct(fullByProduct);
      setProducts(
        rows.map((p) => ({
          variants: (byProduct[p.id] ?? []).map((v) => ({
            id: v.id,
            label: [v.color, v.pendantType, v.material].filter(Boolean).join(" / ") || "וריאציה",
            stock: Number.isFinite(Number(v.stock)) ? Math.max(0, Number(v.stock)) : 0,
          })),
          id: p.id,
          name: p.title || "מוצר",
          imageUrl: p.image_url || "",
          sku: p.slug || p.id,
          category: p.main_category_name?.trim() || p.main_category_id || "ללא קטגוריה",
          customizable: Boolean(p.allow_customer_image_upload),
          stock: (byProduct[p.id] ?? []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0),
          lowThreshold: Number.isFinite(Number(p.low_threshold)) ? Math.max(0, Number(p.low_threshold)) : 5,
          price: Number.isFinite(Number(p.price)) ? Number(p.price) : 0,
        }))
      );
    } catch {
      toast("טעינת מלאי נכשלה", "error");
      setProducts([]);
      setFullVariantsByProduct({});
    } finally {
      if (!silent) setLoading(false);
      if (silent) setRefreshing(false);
    }
  }

  useEffect(() => {
    refreshInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const s = getStatus(p.stock, p.lowThreshold);
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" ? true : s === statusFilter;
      const matchesCategory = categoryFilter === "all" ? true : p.category === categoryFilter;
      const matchesCustom = customizableFilter === "all" ? true : customizableFilter === "yes" ? p.customizable : !p.customizable;
      return matchesQuery && matchesStatus && matchesCategory && matchesCustom;
    });
  }, [categoryFilter, customizableFilter, products, query, statusFilter]);

  const summary = useMemo(() => {
    const all = products.length;
    let inStock = 0;
    let low = 0;
    let out = 0;
    for (const p of products) {
      const s = getStatus(p.stock, p.lowThreshold);
      if (s === "in_stock") inStock += 1;
      else if (s === "low") low += 1;
      else out += 1;
    }
    return { all, inStock, low, out };
  }, [products]);

  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, categoryFilter, customizableFilter]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const headerChecked = pageItems.length > 0 && pageItems.every((p) => selectedSet.has(p.id));

  function setHeaderChecked(next: boolean) {
    if (!next) {
      setSelectedIds((prev) => prev.filter((id) => !pageItems.some((p) => p.id === id)));
      return;
    }
    setSelectedIds((prev) => {
      const out = new Set(prev);
      for (const p of pageItems) out.add(p.id);
      return Array.from(out);
    });
  }

  const [recentlyChanged, setRecentlyChanged] = useState<Record<string, boolean>>({});
  const timeoutsRef = useRef<Record<string, number>>({});

  function pulseRow(id: string) {
    setRecentlyChanged((prev) => ({ ...prev, [id]: true }));
    if (timeoutsRef.current[id]) window.clearTimeout(timeoutsRef.current[id]);
    timeoutsRef.current[id] = window.setTimeout(() => {
      setRecentlyChanged((prev) => ({ ...prev, [id]: false }));
    }, 900);
  }

  const [drawerProductId, setDrawerProductId] = useState<string | null>(null);
  const [fullVariantsByProduct, setFullVariantsByProduct] = useState<Record<string, InventoryVariantFull[]>>({});
  const drawerProduct = useMemo(() => (drawerProductId ? products.find((p) => p.id === drawerProductId) ?? null : null), [drawerProductId, products]);
  const drawerVariants = useMemo(
    () => (drawerProductId ? fullVariantsByProduct[drawerProductId] ?? [] : []),
    [drawerProductId, fullVariantsByProduct]
  );

  const [bulkStock, setBulkStock] = useState<number>(0);

  const lowStockProducts = useMemo(() => {
    return products
      .map((p) => ({ p, s: getStatus(p.stock, p.lowThreshold) }))
      .filter((x) => x.s === "low")
      .sort((a, b) => a.p.stock - b.p.stock)
      .slice(0, 6)
      .map((x) => x.p);
  }, [products]);

  const [focusProductId, setFocusProductId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusProductId) return;
    const el = document.getElementById(`stock_${focusProductId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    pulseRow(focusProductId);
  }, [focusProductId, page]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setCustomizableFilter("all");
    setPage(1);
    setSelectedIds([]);
  }

  async function applyBulkUpdate() {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      const product = products.find((p) => p.id === id);
      if (!product) continue;
      const nextStock = Number.isFinite(bulkStock) ? bulkStock : 0;
      if (product.variants.length > 0) {
        for (const v of product.variants) {
          try {
            await apiFetch(`/api/variants/${v.id}`, { method: "PATCH", body: JSON.stringify({ stock: nextStock }) });
          } catch {
            // summary toast below
          }
        }
      } else {
        toast("למוצר ללא וריאציות אין מסלול עדכון מלאי. יש ליצור/להפעיל וריאציה תחילה.", "warning");
      }
      pulseRow(id);
    }
    await refreshInventory(true);
    toast("עדכון מלאי מרוכז נשמר", "success");
  }

  async function markSelectedAsOutOfStock() {
    if (selectedIds.length === 0) return;
    setProducts((prev) => prev.map((p) => (selectedSet.has(p.id) ? { ...p, stock: 0 } : p)));
    for (const id of selectedIds) pulseRow(id);
    for (const id of selectedIds) {
      const product = products.find((p) => p.id === id);
      if (!product) continue;
      if (product.variants.length > 0) {
        for (const v of product.variants) {
          try {
            await apiFetch(`/api/variants/${v.id}`, { method: "PATCH", body: JSON.stringify({ stock: 0 }) });
          } catch {
            // handled with summary toast
          }
        }
      } else {
        toast("למוצר ללא וריאציות אין מסלול עדכון מלאי. יש ליצור/להפעיל וריאציה תחילה.", "warning");
      }
    }
    await refreshInventory(true);
    toast("סומן כנגמר במלאי", "warning");
  }

  const hasFilters = query.trim().length > 0 || statusFilter !== "all" || categoryFilter !== "all" || customizableFilter !== "all";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "18px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <h1 style={{ fontSize: "22px", fontWeight: 900, color: "var(--foreground)" }}>מלאי</h1>
          <p style={{ fontSize: "13px", color: "var(--muted-foreground)", marginTop: "3px", lineHeight: 1.6 }}>
            ניהול מלאי חי לפי וריאציות פעילות — מחובר ישירות להזמנות ולחנות.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-start", flex: "1 1 260px" }}>
          <button
            type="button"
            onClick={() => refreshInventory(true)}
            disabled={refreshing}
            style={{
              background: "var(--primary)",
              border: "1px solid rgba(201,169,110,0.35)",
              color: "var(--primary-foreground)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "12px",
              fontWeight: 900,
              cursor: refreshing ? "not-allowed" : "pointer",
              opacity: refreshing ? 0.75 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <RefreshCw size={16} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            {refreshing ? "מרענן..." : "רענון"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(201,169,110,0.12)", border: "1px solid rgba(201,169,110,0.3)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Boxes size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--foreground)" }}>{summary.all}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>סך מוצרים</div>
          </div>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.22)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CheckCircle2 size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--foreground)" }}>{summary.inStock}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>במלאי</div>
          </div>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.22)", color: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertTriangle size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--foreground)" }}>{summary.low}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>מלאי נמוך</div>
          </div>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.22)", color: "var(--destructive)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <XCircle size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--foreground)" }}>{summary.out}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>אזל מהמלאי</div>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש מוצר / SKU"
              style={{
                width: "100%",
                background: "var(--input)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "10px 12px",
                paddingRight: "38px",
                color: "var(--foreground)",
                outline: "none",
                fontSize: "13px",
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              width: "100%",
              background: "var(--input)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "10px 12px",
              paddingRight: "14px",
              color: "var(--foreground)",
              outline: "none",
              fontSize: "13px",
              appearance: "none",
            }}
            aria-label="סטטוס מלאי"
          >
            <option value="all">כל הסטטוסים</option>
            <option value="in_stock">במלאי</option>
            <option value="low">מלאי נמוך</option>
            <option value="out_of_stock">אזל מהמלאי</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              width: "100%",
              background: "var(--input)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "10px 12px",
              color: "var(--foreground)",
              outline: "none",
              fontSize: "13px",
            }}
            aria-label="קטגוריה"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "כל הקטגוריות" : c}
              </option>
            ))}
          </select>

          <select
            value={customizableFilter}
            onChange={(e) => setCustomizableFilter(e.target.value as any)}
            style={{
              width: "100%",
              background: "var(--input)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "10px 12px",
              color: "var(--foreground)",
              outline: "none",
              fontSize: "13px",
            }}
            aria-label="מוצר מותאם אישית"
          >
            <option value="all">הכל</option>
            <option value="yes">כן</option>
            <option value="no">לא</option>
          </select>

          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            style={{
              background: "transparent",
              border: "1px solid",
              borderColor: hasFilters ? "var(--border)" : "transparent",
              color: hasFilters ? "var(--foreground-secondary)" : "var(--muted-foreground)",
              borderRadius: "12px",
              padding: "10px 12px",
              fontSize: "12px",
              fontWeight: 900,
              cursor: hasFilters ? "pointer" : "default",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              whiteSpace: "nowrap",
              width: "100%",
            }}
            aria-disabled={!hasFilters}
          >
            נקה מסננים
          </button>
        </div>

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>מציג {filtered.length.toLocaleString("he-IL")} מוצרים</div>
          {hasFilters ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {statusFilter !== "all" ? <Badge variant="muted">{statusLabel(statusFilter)}</Badge> : null}
              {categoryFilter !== "all" ? <Badge variant="muted">קטגוריה: {categoryFilter}</Badge> : null}
              {customizableFilter !== "all" ? <Badge variant="muted">{customizableFilter === "yes" ? "מותאם אישית" : "לא מותאם אישית"}</Badge> : null}
              {query.trim() ? <Badge variant="muted">חיפוש: {query.trim()}</Badge> : null}
            </div>
          ) : null}
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, color: "var(--foreground)" as any, fontWeight: 900 }}>
            נבחרו {selectedIds.length.toLocaleString("he-IL")} מוצרים
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="number"
                value={bulkStock}
                onChange={(e) => setBulkStock(Number(e.target.value))}
                style={{
                  width: 120,
                  background: "var(--input)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  color: "var(--foreground)",
                  outline: "none",
                  fontSize: 13,
                }}
                aria-label="כמות עבור עדכון מלאי מרוכז"
              />
              <SmallButton tone="primary" onClick={applyBulkUpdate}>
                עדכון מלאי מרוכז
              </SmallButton>
            </div>
            <SmallButton tone="default" onClick={markSelectedAsOutOfStock}>
              סימון כנגמר
            </SmallButton>
            <SmallButton tone="danger" onClick={() => toast("מחיקה (placeholder) — אין פעולה אמיתית בדמו", "error")}>
              <Trash2 size={16} style={{ color: "var(--destructive)" }} />
              מחיקה (placeholder)
            </SmallButton>
          </div>
        </div>
      ) : null}

      {/* Table */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>טבלת מלאי</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>עריכת כמות וסף ישירות על וריאציות פעילות</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>עדכון אוטומטי</div>
        </div>

        {loading ? (
          <div style={{ padding: 24 }}>
            <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>טוען מלאי...</div>
          </div>
        ) : products.length === 0 ? (
          <div style={{ padding: 24 }}>
            <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "var(--foreground)" }}>אין מוצרים במלאי</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6 }}>בשלב זה אין נתונים בדמו.</div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24 }}>
            <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "var(--foreground)" }}>אין מוצרים להצגה</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                נסה לשנות מסננים או לנקות אותם.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1160 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {[
                    "תמונה",
                    "שם מוצר",
                    "SKU",
                    "קטגוריה",
                    "מלאי נוכחי",
                    "מלאי לפי צבע/וריאציה",
                    "התראת מלאי נמוך",
                    "סטטוס מלאי",
                    "מחיר",
                    "פעולות",
                  ].map((h) => (
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
                      {h === "פעולות" ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 10 }}>
                          <span>{h}</span>
                          <input
                            type="checkbox"
                            checked={headerChecked}
                            onChange={(e) => setHeaderChecked(e.target.checked)}
                            style={{ accentColor: "var(--primary)" }}
                            aria-label="בחירה הכל"
                          />
                        </div>
                      ) : (
                        h
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => {
                  const s = getStatus(p.stock, p.lowThreshold);
                  const pulsing = Boolean(recentlyChanged[p.id]);
                  const isSelected = selectedSet.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      style={{
                        background: focusProductId === p.id ? "rgba(201,169,110,0.06)" : "transparent",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td style={{ padding: "13px 14px", width: 110 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", background: "var(--input)", border: "1px solid var(--border)" }}>
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: "13px 14px", minWidth: 220 }}>
                        <button
                          type="button"
                          onClick={() => setDrawerProductId(p.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--foreground)",
                            cursor: "pointer",
                            padding: 0,
                            fontSize: 13,
                            fontWeight: 900,
                            textAlign: "right",
                          }}
                        >
                          {p.name}
                        </button>
                        <div style={{ marginTop: 3, fontSize: 11, color: "var(--muted-foreground)" }}>
                          {p.customizable ? "מותאם אישית" : "לא מותאם אישית"}
                        </div>
                      </td>
                      <td style={{ padding: "13px 14px", whiteSpace: "nowrap", fontSize: 13, color: "var(--foreground-secondary)", fontWeight: 900 }}>{p.sku}</td>
                      <td style={{ padding: "13px 14px", whiteSpace: "nowrap", fontSize: 12, color: "var(--muted-foreground)" }}>{p.category}</td>

                      <td style={{ padding: "13px 14px" }}>
                        <input
                          id={`stock_${p.id}`}
                          type="number"
                          value={p.stock}
                          readOnly
                          style={inputStyle(pulsing)}
                          aria-label={`מלאי כולל עבור ${p.name}`}
                        />
                      </td>
                      <td style={{ padding: "13px 14px", minWidth: 240 }}>
                        {p.variants.length === 0 ? (
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>ללא וריאציות</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {p.variants.map((v) => (
                              <div key={v.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 6, alignItems: "center" }}>
                                <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {v.label}
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  value={v.stock}
                                  readOnly
                                  style={{ ...inputStyle(false), width: "100%" }}
                                  aria-label={`מלאי וריאציה ${v.label}`}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "13px 14px" }}>
                        <input
                          type="number"
                          value={p.lowThreshold}
                          readOnly
                          style={inputStyle(pulsing)}
                          aria-label={`עריכת התראה עבור ${p.name}`}
                        />
                      </td>
                      <td style={{ padding: "13px 14px", whiteSpace: "nowrap" }}>
                        <Badge variant={statusVariant(s)}>{statusLabel(s)}</Badge>
                        {pulsing ? (
                          <div style={{ marginTop: 6, fontSize: 11, color: "var(--primary)", fontWeight: 900 }}>עודכן</div>
                        ) : null}
                      </td>
                      <td style={{ padding: "13px 14px", whiteSpace: "nowrap", fontSize: 13, fontWeight: 900, color: "var(--foreground-secondary)" }}>{fmtMoney(p.price)}</td>
                      <td style={{ padding: "13px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const next = e.target.checked;
                              setSelectedIds((prev) => {
                                const set = new Set(prev);
                                if (next) set.add(p.id);
                                else set.delete(p.id);
                                return Array.from(set);
                              });
                            }}
                            style={{ accentColor: "var(--primary)" }}
                            aria-label={`בחירת ${p.name}`}
                          />

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <SmallButton tone="primary" onClick={() => setDrawerProductId(p.id)}>
                              <RefreshCw size={16} />
                              עדכן מלאי
                            </SmallButton>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              עמוד {page.toLocaleString("he-IL")} מתוך {pageCount.toLocaleString("he-IL")}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <SmallButton
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                הקודם
              </SmallButton>
              {Array.from({ length: Math.min(5, pageCount) }).map((_, idx) => {
                const start = Math.max(1, Math.min(page - 2, pageCount - 4));
                const n = start + idx;
                if (n > pageCount) return null;
                const active = n === page;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: active ? "rgba(201,169,110,0.15)" : "var(--input)",
                      border: active ? "1px solid rgba(201,169,110,0.35)" : "1px solid var(--border)",
                      color: active ? "var(--primary)" : "var(--foreground-secondary)",
                      fontWeight: 900,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {n}
                  </button>
                );
              })}
              <SmallButton
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                הבא
              </SmallButton>
            </div>
          </div>
        )}
      </div>

      {/* Low stock alerts */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>כמות מוצרים במלאי נמוך</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Quick edit למוצרים הקריטיים</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{lowStockProducts.length ? `${lowStockProducts.length} מוצרים` : "—"}</div>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {lowStockProducts.length === 0 ? (
            <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, color: "var(--muted-foreground)", fontSize: 13 }}>
              אין כרגע פריטי מלאי נמוך.
            </div>
          ) : (
            lowStockProducts.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  background: "var(--input)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "12px 12px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)" }}>
                    מלאי: <span style={{ color: "var(--foreground-secondary)", fontWeight: 900 }}>{p.stock}</span> · סף:{" "}
                    <span style={{ color: "var(--foreground-secondary)", fontWeight: 900 }}>{p.lowThreshold}</span>
                  </div>
                </div>
                <SmallButton
                  tone="primary"
                  onClick={() => {
                    setDrawerProductId(p.id);
                    const idx = filtered.findIndex((x) => x.id === p.id);
                    const nextPage = idx >= 0 ? Math.floor(idx / PAGE_SIZE) + 1 : 1;
                    setPage(nextPage);
                    setFocusProductId(p.id);
                  }}
                >
                  עדכן עכשיו
                </SmallButton>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
      <Drawer
        open={Boolean(drawerProductId)}
        product={drawerProduct}
        variants={drawerVariants}
        onClose={() => setDrawerProductId(null)}
        onVariantsSaved={() => refreshInventory(true)}
      />
    </div>
  );
}

