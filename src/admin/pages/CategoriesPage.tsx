"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import { useToast } from "../ui/toast";
import { apiFetch } from "../lib/api";
import { Card, PageHeader, PrimaryButton, SearchField, SecondaryButton, SelectInput } from "../ui/primitives";
import {
  Layers3,
  ListTree,
  PauseCircle,
  FolderTree,
  Plus,
  X,
  Pencil,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
  subcategories?: Category[];
};

type TreeResponse = { categories: Category[] };
type StatsResponse = { stats: { total: number; main: number; sub: number; active: number; inactive: number } };

function fallbackStatsFromTree(categories: Category[]): StatsResponse["stats"] {
  const main = categories.length;
  const sub = categories.reduce((acc, c) => acc + (c.subcategories?.length ?? 0), 0);
  const total = main + sub;
  const activeMain = categories.filter((c) => c.isActive).length;
  const activeSub = categories.reduce(
    (acc, c) => acc + ((c.subcategories ?? []).filter((s) => s.isActive).length),
    0
  );
  const active = activeMain + activeSub;
  return { total, main, sub, active, inactive: total - active };
}

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
};

function typeLabel(c: Category) {
  return c.parentId ? "תת קטגוריה" : "ראשית";
}

function statusBadge(isActive: boolean) {
  return isActive ? <Badge variant="success">פעילה</Badge> : <Badge variant="muted">לא פעילה</Badge>;
}

function SummaryCard({
  title,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint?: string;
  tone: "muted" | "success" | "warning" | "info" | "error" | "primary";
  icon: React.ElementType;
}) {
  const toneMap: Record<string, { color: string; bg: string; border: string }> = {
    primary: { color: "var(--primary)", bg: "rgba(201,169,110,0.12)", border: "rgba(201,169,110,0.24)" },
    muted: { color: "var(--muted-foreground)", bg: "var(--input)", border: "var(--border)" },
    success: { color: "var(--success)", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.22)" },
    warning: { color: "var(--warning)", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.22)" },
    info: { color: "var(--info)", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.22)" },
    error: { color: "var(--destructive)", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.22)" },
  };
  const t = toneMap[tone];
  return (
    <div style={{ ...cardStyle, padding: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: t.bg,
          border: `1px solid ${t.border}`,
          color: t.color,
          flexShrink: 0,
        }}
      >
        <Icon size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--foreground)", lineHeight: 1.15 }}>{value}</div>
        <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "2px" }}>{title}</div>
        {hint ? <div style={{ fontSize: "11px", color: t.color, marginTop: "6px", fontWeight: 800 }}>{hint}</div> : null}
      </div>
    </div>
  );
}

function inputStyle(invalid: boolean): React.CSSProperties {
  return {
    width: "100%",
    background: "var(--input)",
    border: `1px solid ${invalid ? "var(--destructive)" : "var(--border)"}`,
    borderRadius: "12px",
    padding: "10px 12px",
    color: "var(--foreground)",
    outline: "none",
    fontSize: "13px",
  };
}

function selectStyle(): React.CSSProperties {
  return {
    width: "100%",
    background: "var(--input)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "10px 12px",
    color: "var(--foreground)",
    outline: "none",
    fontSize: "13px",
    appearance: "none",
  };
}

function Field({
  label,
  required,
  invalid,
  children,
}: {
  label: string;
  required?: boolean;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted-foreground)" }}>{label}</div>
        {required ? <span style={{ color: "var(--destructive)", fontWeight: 900 }}>*</span> : null}
        {invalid ? <span style={{ color: "var(--destructive)", fontSize: 11, fontWeight: 900 }}>לא תקין</span> : null}
      </div>
      {children}
    </div>
  );
}

function Drawer({
  open,
  mode,
  initial,
  mains,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: (Partial<Category> & { parentName?: string; parentSlug?: string }) | null;
  mains: Category[];
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(() => ({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    imageUrl: initial?.imageUrl ?? "",
    kind: (initial?.parentId ? "sub" : "main") as "main" | "sub",
    parentId: initial?.parentId ?? "",
    isActive: initial?.isActive ?? true,
    sortOrder: initial?.sortOrder ?? 0,
    seoTitle: initial?.seoTitle ?? "",
    seoDescription: initial?.seoDescription ?? "",
  }));

  useEffect(() => {
    if (!open) return;
    setForm({
      name: initial?.name ?? "",
      slug: initial?.slug ?? "",
      description: initial?.description ?? "",
      imageUrl: initial?.imageUrl ?? "",
      kind: (initial?.parentId ? "sub" : "main") as "main" | "sub",
      parentId: initial?.parentId ?? "",
      isActive: initial?.isActive ?? true,
      sortOrder: initial?.sortOrder ?? 0,
      seoTitle: initial?.seoTitle ?? "",
      seoDescription: initial?.seoDescription ?? "",
    });
  }, [initial, open]);

  if (!open) return null;

  const forceSubFlow = mode === "create" && Boolean(initial?.parentId);
  const isSub = forceSubFlow || form.kind === "sub";
  const nameOk = form.name.trim().length > 0;
  const kindOk = !isSub || Boolean(form.parentId);
  const valid = nameOk && kindOk;
  const selectedParentMeta = isSub ? mains.find((m) => m.id === form.parentId) : null;
  const sectionTitle = isSub ? "פרטי תת קטגוריה" : "פרטי קטגוריה";
  const nameLabel = isSub ? "שם תת קטגוריה" : "שם קטגוריה";

  async function submit() {
    if (!valid) {
      toast("נא להשלים שדות חובה (שם + קטגוריית אב לתת-קטגוריה).", "warning");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        slug: form.slug.trim() ? form.slug.trim() : null,
        description: form.description.trim() ? form.description.trim() : null,
        imageUrl: form.imageUrl.trim() ? form.imageUrl.trim() : null,
        parentId: isSub ? form.parentId : null,
        isActive: Boolean(form.isActive),
        sortOrder: Number(form.sortOrder || 0),
        seoTitle: form.seoTitle.trim() ? form.seoTitle.trim() : null,
        seoDescription: form.seoDescription.trim() ? form.seoDescription.trim() : null,
      };
      await onSave(payload);
      toast(mode === "create" ? "הקטגוריה נוצרה בהצלחה" : "הקטגוריה עודכנה בהצלחה", "success");
      onClose();
    } catch (e: any) {
      if (e?.error === "SLUG_EXISTS") toast("Slug כבר קיים", "error");
      else if (e?.error === "PARENT_NOT_FOUND") toast("קטגוריית האב שנבחרה לא קיימת", "error");
      else if (e?.error === "PARENT_NOT_MAIN") toast("אפשר לבחור כתבת-אב רק מקטגוריה ראשית", "error");
      else if (e?.error === "HAS_SUBCATEGORIES") toast("לא ניתן למחוק קטגוריה שיש לה תתי-קטגוריות", "error");
      else if (e?.error === "HAS_PRODUCTS") toast("לא ניתן למחוק קטגוריה עם שיוכי מוצרים", "error");
      else toast("שמירה נכשלה", "error");
    } finally {
      setSaving(false);
    }
  }

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
          width: "min(640px, 92vw)",
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: 18, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "var(--foreground)" }}>
              {mode === "create" ? (isSub ? "יצירת תת קטגוריה" : "יצירת קטגוריה") : isSub ? "עריכת תת קטגוריה" : "עריכת קטגוריה"}
            </div>
            <div style={{ marginTop: 2, fontSize: 12, color: "var(--muted-foreground)" }}>שמירה אמיתית בבסיס נתונים</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--input)",
              color: "var(--foreground-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="סגור"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...cardStyle, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>{sectionTitle}</div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label={nameLabel} required invalid={!nameOk}>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle(!nameOk)} />
              </Field>
              <Field label="Slug">
                <input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} style={inputStyle(false)} placeholder={isSub ? "necklaces-men" : "necklaces"} />
              </Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="תיאור">
                  <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} style={{ ...inputStyle(false), padding: 12, resize: "vertical" }} />
                </Field>
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>היררכיה ותצוגה</div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="סוג קטגוריה" required invalid={!kindOk}>
                <select
                  value={isSub ? "sub" : form.kind}
                  onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value as any, parentId: e.target.value === "main" ? "" : p.parentId }))}
                  style={selectStyle()}
                  disabled={forceSubFlow}
                >
                  <option value="main">ראשית</option>
                  <option value="sub">תת קטגוריה</option>
                </select>
              </Field>
              <Field label="קטגוריית אב" required={isSub} invalid={isSub && !form.parentId}>
                <select value={form.parentId} onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))} style={selectStyle()} disabled={!isSub}>
                  <option value="">בחר קטגוריית אב</option>
                  {mains.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {isSub && selectedParentMeta ? (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                      background: "var(--input)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "6px 8px",
                      lineHeight: 1.5,
                    }}
                  >
                    קטגוריית אב נבחרה: <strong style={{ color: "var(--foreground)" }}>{selectedParentMeta.name}</strong> · slug:{" "}
                    <span style={{ color: "var(--foreground)" }}>{selectedParentMeta.slug}</span>
                  </div>
                ) : null}
              </Field>
              <Field label="סדר תצוגה">
                <input type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} style={inputStyle(false)} />
              </Field>
            </div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="תמונה (URL)">
                <input value={form.imageUrl} onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))} style={inputStyle(false)} placeholder="https://..." />
              </Field>
              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--input)",
                  cursor: "pointer",
                  height: 44,
                  marginTop: 22,
                }}
              >
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} style={{ accentColor: "var(--primary)" }} />
                <span style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground-secondary)" }}>פעילה</span>
              </label>
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>SEO</div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="SEO title">
                <input value={form.seoTitle} onChange={(e) => setForm((p) => ({ ...p, seoTitle: e.target.value }))} style={inputStyle(false)} />
              </Field>
              <Field label="SEO description">
                <input value={form.seoDescription} onChange={(e) => setForm((p) => ({ ...p, seoDescription: e.target.value }))} style={inputStyle(false)} />
              </Field>
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-start", flexShrink: 0 }}>
          <SmallButton tone="primary" onClick={submit} disabled={saving}>
            {saving ? "שומר..." : "שמור"}
          </SmallButton>
          <SmallButton tone="default" onClick={onClose} disabled={saving}>
            ביטול
          </SmallButton>
        </div>
      </aside>
    </>
  );
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
  const bg = tone === "primary" ? "var(--primary)" : tone === "danger" ? "rgba(239,68,68,0.12)" : "var(--input)";
  const border =
    tone === "primary"
      ? "1px solid rgba(201,169,110,0.35)"
      : tone === "danger"
        ? "1px solid rgba(239,68,68,0.25)"
        : "1px solid var(--border)";
  const color = tone === "primary" ? "var(--primary-foreground)" : tone === "danger" ? "var(--destructive)" : "var(--foreground-secondary)";
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

export function CategoriesPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<Category[]>([]);
  const [stats, setStats] = useState<StatsResponse["stats"] | null>(null);

  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "main" | "sub">("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Category | null>(null);
  const [prefillParentId, setPrefillParentId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([
        apiFetch<TreeResponse>("/api/categories/tree"),
        apiFetch<StatsResponse>("/api/categories/stats"),
      ]);
      const categories = t.categories ?? [];
      setTree(categories);
      setStats(s.stats ?? fallbackStatsFromTree(categories));
    } catch {
      setTree([]);
      setStats(null);
      toast("טעינת הקטגוריות נכשלה.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flat = useMemo(() => {
    const out: Category[] = [];
    for (const m of tree) {
      out.push(m);
      for (const s of m.subcategories ?? []) out.push(s);
    }
    return out;
  }, [tree]);

  const mains = useMemo(() => tree.map((x) => ({ ...x, subcategories: undefined })), [tree]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return flat.filter((c) => {
      const matchesQ = !needle || c.name.toLowerCase().includes(needle) || c.slug.toLowerCase().includes(needle);
      const matchesType = type === "all" ? true : type === "main" ? !c.parentId : Boolean(c.parentId);
      const matchesStatus = status === "all" ? true : status === "active" ? c.isActive : !c.isActive;
      return matchesQ && matchesType && matchesStatus;
    });
  }, [flat, q, status, type]);
  const filteredTree = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out: Category[] = [];
    for (const main of tree) {
      const mainMatchesQuery = !needle || main.name.toLowerCase().includes(needle) || main.slug.toLowerCase().includes(needle);
      const mainMatchesStatus = status === "all" ? true : status === "active" ? main.isActive : !main.isActive;
      const subcategories = (main.subcategories ?? []).filter((sub) => {
        const subMatchesQuery = !needle || sub.name.toLowerCase().includes(needle) || sub.slug.toLowerCase().includes(needle);
        const subMatchesStatus = status === "all" ? true : status === "active" ? sub.isActive : !sub.isActive;
        return subMatchesQuery && subMatchesStatus;
      });
      if (type === "main") {
        if (mainMatchesQuery && mainMatchesStatus) out.push({ ...main, subcategories: [] });
        continue;
      }
      if (type === "sub") {
        if (subcategories.length > 0) out.push({ ...main, subcategories });
        continue;
      }
      if (mainMatchesQuery && mainMatchesStatus) {
        out.push({ ...main, subcategories });
        continue;
      }
      if (subcategories.length > 0) out.push({ ...main, subcategories });
    }
    return out;
  }, [q, status, tree, type]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedId(tree[0]?.id ?? null);
      return;
    }
    const exists = flat.some((item) => item.id === selectedId);
    if (!exists) setSelectedId(tree[0]?.id ?? null);
  }, [flat, selectedId, tree]);

  async function onSave(payload: any) {
    if (drawerMode === "create") {
      await apiFetch<{ category: Category }>("/api/categories", { method: "POST", body: JSON.stringify(payload) });
    } else if (editing) {
      await apiFetch<{ category: Category }>(`/api/categories/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    }
    await refresh();
  }

  function openCreate() {
    setEditing(null);
    setPrefillParentId(null);
    setDrawerMode("create");
    setDrawerOpen(true);
  }

  function openCreateSub(parentId: string) {
    setEditing(null);
    setPrefillParentId(parentId);
    setDrawerMode("create");
    setDrawerOpen(true);
  }

  function openCreateSubFromHeader() {
    const parentId = selectedCategory?.parentId ? selectedCategory.parentId : selectedCategory?.id;
    if (parentId) {
      openCreateSub(parentId);
      return;
    }
    if (mains.length === 0) {
      toast("יש ליצור קטגוריה ראשית לפני תת קטגוריה.", "warning");
      return;
    }
    openCreateSub(mains[0].id);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setPrefillParentId(null);
    setDrawerMode("edit");
    setDrawerOpen(true);
  }

  async function toggle(c: Category) {
    try {
      await apiFetch<{ category: Category }>(`/api/categories/${c.id}/toggle`, { method: "POST", body: JSON.stringify({ isActive: !c.isActive }) });
      toast(!c.isActive ? "הקטגוריה הופעלה" : "הקטגוריה הושבתה", "success");
      await refresh();
    } catch (e: any) {
      toast("הפעולה נכשלה", "error");
    }
  }

  const drawerInitial = useMemo(() => {
    if (drawerMode === "edit") return editing;
    if (prefillParentId) {
      const parent = mains.find((m) => m.id === prefillParentId);
      return {
        parentId: prefillParentId,
        name: "",
        slug: "",
        isActive: true,
        sortOrder: 0,
        description: "",
        seoTitle: "",
        seoDescription: "",
        imageUrl: "",
        parentName: parent?.name,
        parentSlug: parent?.slug,
      };
    }
    return null;
  }, [drawerMode, editing, mains, prefillParentId]);

  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const main of tree) {
      map.set(main.id, main.name);
      for (const sub of main.subcategories ?? []) {
        map.set(sub.id, main.name);
      }
    }
    return map;
  }, [tree]);

  const selectedCategory = useMemo(() => flat.find((item) => item.id === selectedId) ?? null, [flat, selectedId]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20 }}>
      <PageHeader
        title="קטגוריות"
        subtitle="ניהול פשוט וברור של קטגוריות ראשיות ותתי קטגוריות."
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <SecondaryButton type="button" onClick={openCreateSubFromHeader}>
              <Plus size={16} />
              תת קטגוריה חדשה
            </SecondaryButton>
            <PrimaryButton type="button" onClick={openCreate}>
              <Plus size={16} />
              קטגוריה חדשה
            </PrimaryButton>
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <SummaryCard title="סך כל הקטגוריות" value={String(stats?.total ?? "—")} tone="primary" icon={Layers3} />
        <SummaryCard title="קטגוריות ראשיות" value={String(stats?.main ?? "—")} tone="muted" icon={ListTree} />
        <SummaryCard title="תת קטגוריות" value={String(stats?.sub ?? "—")} tone="info" icon={FolderTree} />
        <SummaryCard title="קטגוריות לא פעילות" value={String(stats?.inactive ?? "—")} tone="warning" icon={PauseCircle} />
      </div>

      <Card padding={12}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
          <SearchField value={q} onChange={setQ} placeholder="חיפוש לפי שם או slug" />
          <SelectInput value={type} onChange={(e) => setType(e.target.value as any)} aria-label="סוג">
            <option value="all">כל הסוגים</option>
            <option value="main">ראשיות בלבד</option>
            <option value="sub">תתי קטגוריות בלבד</option>
          </SelectInput>
          <SelectInput value={status} onChange={(e) => setStatus(e.target.value as any)} aria-label="סטטוס">
            <option value="all">כל הסטטוסים</option>
            <option value="active">פעילות</option>
            <option value="inactive">לא פעילות</option>
          </SelectInput>
          <SecondaryButton type="button" onClick={() => refresh()}>
            רענון
          </SecondaryButton>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
        <Card padding={12}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>עץ קטגוריות</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{loading ? "טוען..." : `${filtered.length} רשומות`}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredTree.length === 0 && !loading ? (
              <div style={{ ...cardStyle, padding: 14, color: "var(--muted-foreground)", fontSize: 13 }}>אין קטגוריות להצגה לפי הסינון.</div>
            ) : (
              filteredTree.map((main) => {
                const isSelectedMain = selectedId === main.id;
                return (
                  <div
                    key={main.id}
                    style={{
                      ...cardStyle,
                      padding: 12,
                      background: isSelectedMain ? "rgba(201,169,110,0.07)" : "var(--card)",
                      borderColor: isSelectedMain ? "rgba(201,169,110,0.35)" : "var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(main.id)}
                        style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", textAlign: "right", color: "var(--foreground)" }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 900 }}>{main.name}</div>
                        <div style={{ marginTop: 3, fontSize: 12, color: "var(--muted-foreground)" }}>{main.slug}</div>
                        <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted-foreground)" }}>
                          {(main.subcategories ?? []).length} תתי קטגוריות • 0 מוצרים
                        </div>
                      </button>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-start" }}>
                        {statusBadge(main.isActive)}
                        <SmallButton tone="default" onClick={() => openEdit(main)}>
                          <Pencil size={14} />
                          עריכה
                        </SmallButton>
                        <SmallButton tone="default" onClick={() => openCreateSub(main.id)}>
                          <Plus size={14} />
                          הוסף תת קטגוריה
                        </SmallButton>
                        <SmallButton tone="primary" onClick={() => toggle(main)}>
                          {main.isActive ? "השבת" : "הפעל"}
                        </SmallButton>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, borderRight: "2px solid var(--border)", paddingRight: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {(main.subcategories ?? []).length === 0 ? (
                        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>אין תתי קטגוריות תחת קטגוריה זו.</div>
                      ) : (
                        (main.subcategories ?? []).map((sub) => {
                          const selected = selectedId === sub.id;
                          return (
                            <div
                              key={sub.id}
                              style={{
                                background: selected ? "rgba(201,169,110,0.08)" : "var(--input)",
                                border: "1px solid var(--border)",
                                borderRadius: 10,
                                padding: "8px 10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedId(sub.id)}
                                style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", textAlign: "right", color: "var(--foreground-secondary)" }}
                              >
                                <div style={{ fontSize: 12, fontWeight: 900 }}>{sub.name}</div>
                                <div style={{ marginTop: 2, fontSize: 11, color: "var(--muted-foreground)" }}>{sub.slug}</div>
                              </button>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                {statusBadge(sub.isActive)}
                                <SmallButton tone="default" onClick={() => openEdit(sub)}>
                                  עריכה
                                </SmallButton>
                                <SmallButton tone="primary" onClick={() => toggle(sub)}>
                                  {sub.isActive ? "השבת" : "הפעל"}
                                </SmallButton>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>רשימת קטגוריות</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{filtered.length.toLocaleString("he-IL")} פריטים</div>
        </div>
        {loading ? (
          <div style={{ padding: 16, color: "var(--muted-foreground)", fontSize: 12 }}>טוען...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 760 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["שם קטגוריה", "slug", "סוג", "קטגוריית אב", "מספר מוצרים", "סטטוס", "פעולות"].map((h) => (
                    <th key={h} style={{ textAlign: "right", padding: "10px 12px", fontSize: 11, color: "var(--muted-foreground)", fontWeight: 800, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedId(c.id)}
                    onDoubleClick={() => openEdit(c)}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--foreground-secondary)", fontWeight: 800 }}>{c.name}</td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted-foreground)" }}>{c.slug}</td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted-foreground)" }}>{typeLabel(c)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted-foreground)" }}>{c.parentId ? parentMap.get(c.parentId) ?? "—" : "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted-foreground)" }}>0</td>
                    <td style={{ padding: "10px 12px" }}>{statusBadge(c.isActive)}</td>
                    <td style={{ padding: "10px 12px" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <SmallButton tone="default" onClick={() => openEdit(c)}>
                          עריכה
                        </SmallButton>
                        {!c.parentId ? (
                          <SmallButton tone="default" onClick={() => openCreateSub(c.id)}>
                            הוסף תת קטגוריה
                          </SmallButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        mode={drawerMode}
        initial={drawerMode === "edit" ? editing : drawerInitial}
        mains={mains}
        onClose={() => setDrawerOpen(false)}
        onSave={onSave}
      />
    </div>
  );
}

