"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import { useToast } from "../ui/toast";
import { apiFetch } from "../lib/api";
import { Card, PageHeader, PrimaryButton, SearchField, SecondaryButton, SelectInput } from "../ui/primitives";
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

type Coupon = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  hasNoExpiry: boolean;
  minCartAmount: number | null;
  maxCartAmount: number | null;
  minItemsQuantity: number | null;
  appliesToAllProducts: boolean;
  excludeSaleItems: boolean;
  newCustomersOnly: boolean;
  usageLimitTotal: number | null;
  usageLimitPerCustomer: number | null;
  usageCount: number;
  allowCombining: boolean;
  freeShipping: boolean;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = { coupons: Coupon[] };

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
};

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

function fmtMoney(v: number) {
  return `₪${(Number(v || 0) / 100).toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function typeLabel(t: DiscountType) {
  return t === "PERCENTAGE" ? "אחוז" : "סכום";
}

function valueLabel(t: DiscountType, v: number) {
  return t === "PERCENTAGE" ? `${v}%` : fmtMoney(v);
}

function statusBadge(c: Coupon) {
  const now = Date.now();
  const starts = c.startsAt ? new Date(c.startsAt).getTime() : null;
  const ends = c.endsAt ? new Date(c.endsAt).getTime() : null;
  if (!c.isActive) return <Badge variant="muted">לא פעיל</Badge>;
  if (!c.hasNoExpiry && ends && ends < now) return <Badge variant="error">פג תוקף</Badge>;
  if (starts && starts > now) return <Badge variant="info">מתוזמן</Badge>;
  return <Badge variant="success">פעיל</Badge>;
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

function Drawer({
  open,
  mode,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: Partial<Coupon> | null;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(() => ({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    discountType: (initial?.discountType ?? "PERCENTAGE") as DiscountType,
    discountValue: initial ? (initial.discountType === "FIXED_AMOUNT" ? agorotToShekelsInput(initial.discountValue) || 10 : initial.discountValue ?? 10) : 10,
    isActive: initial?.isActive ?? true,
    hasNoExpiry: initial?.hasNoExpiry ?? false,
    startsAt: initial?.startsAt ? toLocalDatetimeInput(initial.startsAt) : "",
    endsAt: initial?.endsAt ? toLocalDatetimeInput(initial.endsAt) : "",
    minCartAmount: agorotToShekelsInput(initial?.minCartAmount),
    maxCartAmount: agorotToShekelsInput(initial?.maxCartAmount),
    minItemsQuantity: initial?.minItemsQuantity ?? "",
    usageLimitTotal: initial?.usageLimitTotal ?? "",
    usageLimitPerCustomer: initial?.usageLimitPerCustomer ?? "",
    newCustomersOnly: initial?.newCustomersOnly ?? false,
    allowCombining: initial?.allowCombining ?? false,
    freeShipping: initial?.freeShipping ?? false,
    excludeSaleItems: initial?.excludeSaleItems ?? false,
  }));

  useEffect(() => {
    if (!open) return;
    setForm({
      code: initial?.code ?? "",
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      discountType: (initial?.discountType ?? "PERCENTAGE") as DiscountType,
      discountValue: initial ? (initial.discountType === "FIXED_AMOUNT" ? agorotToShekelsInput(initial.discountValue) || 10 : initial.discountValue ?? 10) : 10,
      isActive: initial?.isActive ?? true,
      hasNoExpiry: initial?.hasNoExpiry ?? false,
      startsAt: initial?.startsAt ? toLocalDatetimeInput(initial.startsAt) : "",
      endsAt: initial?.endsAt ? toLocalDatetimeInput(initial.endsAt) : "",
      minCartAmount: agorotToShekelsInput(initial?.minCartAmount),
      maxCartAmount: agorotToShekelsInput(initial?.maxCartAmount),
      minItemsQuantity: initial?.minItemsQuantity ?? "",
      usageLimitTotal: initial?.usageLimitTotal ?? "",
      usageLimitPerCustomer: initial?.usageLimitPerCustomer ?? "",
      newCustomersOnly: initial?.newCustomersOnly ?? false,
      allowCombining: initial?.allowCombining ?? false,
      freeShipping: initial?.freeShipping ?? false,
      excludeSaleItems: initial?.excludeSaleItems ?? false,
    });
  }, [initial, open]);

  if (!open) return null;

  const codeOk = form.code.trim().length >= 3;
  const nameOk = form.name.trim().length > 0;
  const valueOk = form.discountType === "PERCENTAGE" ? form.discountValue > 0 && form.discountValue <= 100 : form.discountValue > 0;
  const endAfterStart =
    !form.startsAt ||
    !form.endsAt ||
    new Date(fromLocalDatetimeInput(form.startsAt)).getTime() <= new Date(fromLocalDatetimeInput(form.endsAt)).getTime();

  const valid = codeOk && nameOk && valueOk && endAfterStart;

  async function submit() {
    if (!valid) {
      toast("יש שדות לא תקינים. בדוק קוד/שם/ערך/תאריכים.", "warning");
      return;
    }
    setSaving(true);
    try {
      const parsedDiscountValue =
        form.discountType === "FIXED_AMOUNT"
          ? shekelsToAgorot(form.discountValue)
          : Number(form.discountValue);
      if (parsedDiscountValue == null || !Number.isFinite(parsedDiscountValue)) {
        toast("ערך ההנחה לא תקין", "warning");
        setSaving(false);
        return;
      }
      const minCartAmountAgorot = form.minCartAmount === "" ? null : shekelsToAgorot(form.minCartAmount);
      const maxCartAmountAgorot = form.maxCartAmount === "" ? null : shekelsToAgorot(form.maxCartAmount);
      const payload: any = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description?.trim() ? form.description.trim() : null,
        discountType: form.discountType,
        discountValue: parsedDiscountValue,
        isActive: Boolean(form.isActive),
        hasNoExpiry: Boolean(form.hasNoExpiry),
        startsAt: form.startsAt ? fromLocalDatetimeInput(form.startsAt) : null,
        endsAt: form.hasNoExpiry ? null : form.endsAt ? fromLocalDatetimeInput(form.endsAt) : null,
        minCartAmount: minCartAmountAgorot,
        maxCartAmount: maxCartAmountAgorot,
        minItemsQuantity: form.minItemsQuantity === "" ? null : Number(form.minItemsQuantity),
        usageLimitTotal: form.usageLimitTotal === "" ? null : Number(form.usageLimitTotal),
        usageLimitPerCustomer: form.usageLimitPerCustomer === "" ? null : Number(form.usageLimitPerCustomer),
        newCustomersOnly: Boolean(form.newCustomersOnly),
        allowCombining: Boolean(form.allowCombining),
        freeShipping: Boolean(form.freeShipping),
        excludeSaleItems: Boolean(form.excludeSaleItems),
      };
      await onSave(payload);
      toast(mode === "create" ? "הקופון נוצר בהצלחה" : "הקופון עודכן בהצלחה", "success");
      onClose();
    } catch (e: any) {
      if (e?.error === "CODE_EXISTS") toast("קוד קופון כבר קיים", "error");
      else if (e?.error === "VALIDATION") toast("שגיאת ולידציה בשרת", "error");
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
        <div style={{ padding: "18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "var(--foreground)" }}>{mode === "create" ? "יצירת קופון" : "עריכת קופון"}</div>
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
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>פרטים בסיסיים</div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="קוד קופון" required invalid={!codeOk}>
                <input
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="VIP10"
                  style={inputStyle(!codeOk)}
                />
              </Field>
              <Field label="שם פנימי" required invalid={!nameOk}>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="VIP אפריל" style={inputStyle(!nameOk)} />
              </Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="תיאור / הערות">
                  <textarea
                    value={form.description ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    style={{ ...inputStyle(false), width: "100%", resize: "vertical", padding: "12px" }}
                  />
                </Field>
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>הנחה</div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
              <Field label="סוג הנחה">
                <select value={form.discountType} onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as DiscountType }))} style={selectStyle()}>
                  <option value="PERCENTAGE">אחוז</option>
                  <option value="FIXED_AMOUNT">סכום קבוע</option>
                </select>
              </Field>
              <Field label="ערך" required invalid={!valueOk}>
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => setForm((p) => ({ ...p, discountValue: Number(e.target.value) }))}
                  style={inputStyle(!valueOk)}
                />
              </Field>
              <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 800 }}>תצוגה</div>
                <div style={{ marginTop: 6, fontSize: 14, color: "var(--foreground)", fontWeight: 900 }}>
                  {form.discountType === "PERCENTAGE" ? `${form.discountValue}% הנחה` : `${fmtMoney(form.discountValue)} הנחה`}
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>תוקף והגבלות</div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Toggle label="פעיל" checked={form.isActive} onChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
              <Toggle label="ללא תפוגה" checked={form.hasNoExpiry} onChange={(v) => setForm((p) => ({ ...p, hasNoExpiry: v }))} />
              <Toggle label="לקוחות חדשים בלבד" checked={form.newCustomersOnly} onChange={(v) => setForm((p) => ({ ...p, newCustomersOnly: v }))} />
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="תאריך התחלה">
                <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))} style={inputStyle(false)} />
              </Field>
              <Field label="תאריך סיום" invalid={!endAfterStart}>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
                  style={inputStyle(!endAfterStart)}
                  disabled={form.hasNoExpiry}
                />
              </Field>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="מינ׳ סל (₪)">
                <input type="number" step="0.01" value={form.minCartAmount} onChange={(e) => setForm((p) => ({ ...p, minCartAmount: e.target.value === "" ? "" : Number(e.target.value) }))} style={inputStyle(false)} />
              </Field>
              <Field label="מקס׳ סל (₪)">
                <input type="number" step="0.01" value={form.maxCartAmount} onChange={(e) => setForm((p) => ({ ...p, maxCartAmount: e.target.value === "" ? "" : Number(e.target.value) }))} style={inputStyle(false)} />
              </Field>
              <Field label="מינ׳ כמות פריטים">
                <input type="number" value={form.minItemsQuantity} onChange={(e) => setForm((p) => ({ ...p, minItemsQuantity: e.target.value === "" ? "" : Number(e.target.value) }))} style={inputStyle(false)} />
              </Field>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="מגבלת שימושים כוללת">
                <input type="number" value={form.usageLimitTotal} onChange={(e) => setForm((p) => ({ ...p, usageLimitTotal: e.target.value === "" ? "" : Number(e.target.value) }))} style={inputStyle(false)} />
              </Field>
              <Field label="מגבלת שימושים ללקוח">
                <input type="number" value={form.usageLimitPerCustomer} onChange={(e) => setForm((p) => ({ ...p, usageLimitPerCustomer: e.target.value === "" ? "" : Number(e.target.value) }))} style={inputStyle(false)} />
              </Field>
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>התנהגות</div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Toggle label="אפשר שילוב קופונים" checked={form.allowCombining} onChange={(v) => setForm((p) => ({ ...p, allowCombining: v }))} />
              <Toggle label="משלוח חינם" checked={form.freeShipping} onChange={(v) => setForm((p) => ({ ...p, freeShipping: v }))} />
              <Toggle label="החרג פריטי מבצע (מוכן לעתיד)" checked={form.excludeSaleItems} onChange={(v) => setForm((p) => ({ ...p, excludeSaleItems: v }))} />
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-start", flexShrink: 0 }}>
          <SmallButton tone="primary" onClick={submit} disabled={saving}>
            {saving ? "שומר..." : "שמור קופון"}
          </SmallButton>
          <SmallButton tone="default" onClick={onClose} disabled={saving}>
            ביטול
          </SmallButton>
        </div>
      </aside>
    </>
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

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--input)",
        cursor: "pointer",
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: "var(--primary)" }} />
      <span style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground-secondary)" }}>{label}</span>
    </label>
  );
}

function toLocalDatetimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeInput(local: string) {
  // Interpret as local time and convert to ISO
  const d = new Date(local);
  return d.toISOString();
}

function agorotToShekelsInput(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return "";
  return Number(v) / 100;
}

function shekelsToAgorot(v: number | string) {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function CouponsPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [rowBusy, setRowBusy] = useState<null | { id: string; kind: "toggle" | "delete" | "validate" }>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "expired" | "scheduled">("all");
  const [type, setType] = useState<"all" | "percentage" | "fixed">("all");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Coupon | null>(null);

  async function refresh(opts?: { soft?: boolean }) {
    const soft = Boolean(opts?.soft && coupons.length > 0);
    if (soft) setListRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);
      if (type !== "all") params.set("type", type);
      const data = await apiFetch<ListResponse>(`/api/coupons?${params.toString()}`);
      setCoupons(data.coupons);
    } catch (e: any) {
      toast("טעינת קופונים נכשלה", "error");
    } finally {
      if (soft) setListRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => refresh({ soft: true }), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, type]);

  const summary = useMemo(() => {
    const now = Date.now();
    const active = coupons.filter((c) => c.isActive && (c.hasNoExpiry || !c.endsAt || new Date(c.endsAt).getTime() >= now)).length;
    const expired = coupons.filter((c) => !c.hasNoExpiry && c.endsAt && new Date(c.endsAt).getTime() < now).length;
    const top = coupons.slice().sort((a, b) => b.usageCount - a.usageCount)[0];
    const totalUses = coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0);
    return { active, expired, top, totalUses };
  }, [coupons]);

  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(coupons.length / PAGE_SIZE));
  const pageItems = useMemo(() => coupons.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE), [coupons, page]);

  useEffect(() => setPage(1), [q, status, type]);

  async function onSave(payload: any) {
    if (drawerMode === "create") {
      await apiFetch<{ coupon: Coupon }>("/api/coupons", { method: "POST", body: JSON.stringify(payload) });
    } else if (editing) {
      await apiFetch<{ coupon: Coupon }>(`/api/coupons/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    }
    await refresh({ soft: coupons.length > 0 });
  }

  async function toggleActive(c: Coupon) {
    setRowBusy({ id: c.id, kind: "toggle" });
    try {
      await apiFetch<{ coupon: Coupon }>(`/api/coupons/${c.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !c.isActive }) });
      toast(!c.isActive ? "הקופון הופעל" : "הקופון הושבת", "success");
      await refresh({ soft: true });
    } catch {
      toast("הפעולה נכשלה", "error");
    } finally {
      setRowBusy(null);
    }
  }

  async function remove(c: Coupon) {
    if (!confirm(`למחוק את הקופון ${c.code}?`)) return;
    setRowBusy({ id: c.id, kind: "delete" });
    try {
      await apiFetch<void>(`/api/coupons/${c.id}`, { method: "DELETE" });
      toast("הקופון נמחק", "success");
      await refresh({ soft: true });
    } catch {
      toast("מחיקה נכשלה", "error");
    } finally {
      setRowBusy(null);
    }
  }

  async function runValidate(c: Coupon) {
    setRowBusy({ id: c.id, kind: "validate" });
    try {
      const out = await apiFetch<any>("/api/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code: c.code, cartSubtotal: 30_000, itemsQuantity: 1, customerEmail: null }),
      });
      toast(out.ok ? "בדיקת קופון: תקין (דמו)" : `בדיקת קופון: ${out.message}`, out.ok ? "success" : "warning");
    } catch {
      toast("בדיקת קופון נכשלה", "error");
    } finally {
      setRowBusy(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setDrawerMode("create");
    setDrawerOpen(true);
  }

  function openEdit(c: Coupon) {
    setEditing(c);
    setDrawerMode("edit");
    setDrawerOpen(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 18 }}>
      {/* Header */}
      <PageHeader
        title="החנות וקופונים"
        subtitle="קופונים אמיתיים עם ולידציה ושימושים בבסיס נתונים (מוכן לחיבור מלא לסטור)."
        actions={
          <>
            <SecondaryButton type="button" onClick={() => toast("ייצוא קופונים (placeholder)", "info")}>
              <Download size={16} />
              ייצוא
            </SecondaryButton>
            <PrimaryButton type="button" onClick={openCreate}>
              <Plus size={16} />
              קופון חדש
            </PrimaryButton>
          </>
        }
      />

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
        <SummaryCard title="קופונים פעילים" value={String(summary.active)} hint="כולל ללא תפוגה" tone="success" icon={CheckCircle2} />
        <SummaryCard title="קופונים שפג תוקפם" value={String(summary.expired)} hint="תאריך סיום עבר" tone="error" icon={Calendar} />
        <SummaryCard title="קופון שנוצל הכי הרבה" value={summary.top ? summary.top.code : "—"} hint={summary.top ? `${summary.top.usageCount} שימושים` : "אין נתונים"} tone="primary" icon={ArrowUpRight} />
        <SummaryCard title="סך שימושים" value={String(summary.totalUses)} hint="מצטבר" tone="muted" icon={Filter} />
      </div>

      {/* Filters */}
      <Card padding={14}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "center" }}>
          <SearchField value={q} onChange={setQ} placeholder="חיפוש לפי קוד / שם" />
          <SelectInput value={status} onChange={(e) => setStatus(e.target.value as any)} aria-label="סטטוס">
            <option value="all">כל הסטטוסים</option>
            <option value="active">פעילים</option>
            <option value="inactive">לא פעילים</option>
            <option value="expired">פג תוקף</option>
            <option value="scheduled">מתוזמנים</option>
          </SelectInput>
          <SelectInput value={type} onChange={(e) => setType(e.target.value as any)} aria-label="סוג הנחה">
            <option value="all">כל הסוגים</option>
            <option value="percentage">אחוז</option>
            <option value="fixed">סכום קבוע</option>
          </SelectInput>
          <SecondaryButton
            type="button"
            onClick={() => {
              setQ("");
              setStatus("all");
              setType("all");
            }}
            style={{ background: "transparent" }}
          >
            נקה
          </SecondaryButton>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted-foreground)" }}>
          {loading ? "טוען..." : listRefreshing ? "מעדכן רשימה…" : `מציג ${coupons.length.toLocaleString("he-IL")} קופונים`}
        </div>
      </Card>

      {/* Table */}
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--foreground)" }}>קופונים</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>ניהול קופונים פעילים/מתוזמנים/פגי תוקף.</div>
          </div>
          <SmallButton tone="default" onClick={() => refresh({ soft: coupons.length > 0 })} disabled={loading || listRefreshing}>
            <Filter size={16} style={{ animation: listRefreshing ? "spin 0.9s linear infinite" : "none" }} />
            רענון
          </SmallButton>
        </div>

        {listRefreshing ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--foreground-secondary)",
              background: "rgba(201,169,110,0.1)",
              borderBottom: "1px solid rgba(201,169,110,0.22)",
            }}
          >
            <Loader2 size={16} style={{ animation: "spin 0.85s linear infinite", flexShrink: 0 }} />
            מעדכן את הרשימה מהשרת…
          </div>
        ) : null}

        {loading ? (
          <div style={{ padding: 24, color: "var(--muted-foreground)", fontSize: 13 }}>טוען קופונים…</div>
        ) : coupons.length === 0 ? (
          <div style={{ padding: 24 }}>
            <div style={{ ...cardStyle, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "var(--foreground)" }}>אין קופונים כרגע</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                צור את הקופון הראשון שלך כדי להתחיל.
              </div>
              <div style={{ marginTop: 12 }}>
                <SmallButton tone="primary" onClick={openCreate}>
                  <Plus size={16} />
                  יצירת קופון
                </SmallButton>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ position: "relative", overflowX: "auto" }}>
            {listRefreshing ? (
              <div
                aria-busy="true"
                aria-label="מעדכן"
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 3,
                  background: "rgba(10, 10, 12, 0.35)",
                  backdropFilter: "blur(1px)",
                  pointerEvents: "none",
                }}
              />
            ) : null}
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1180, position: "relative", zIndex: 1 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["קוד", "סוג", "ערך", "סטטוס", "תוקף", "שימושים", "מינ׳ סל", "נוצר", "פעולות"].map((h) => (
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
                {pageItems.map((c) => (
                  <tr
                    key={c.id}
                    style={{ cursor: "pointer", background: "transparent" }}
                    onClick={() => openEdit(c)}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    <td style={{ padding: "13px 14px", fontSize: 13, fontWeight: 900, color: "var(--foreground-secondary)", whiteSpace: "nowrap" }}>
                      {c.code}
                      <div style={{ marginTop: 3, fontSize: 11, color: "var(--muted-foreground)" }}>{c.name}</div>
                    </td>
                    <td style={{ padding: "13px 14px", fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{typeLabel(c.discountType)}</td>
                    <td style={{ padding: "13px 14px", fontSize: 12, color: "var(--foreground-secondary)", fontWeight: 900, whiteSpace: "nowrap" }}>{valueLabel(c.discountType, c.discountValue)}</td>
                    <td style={{ padding: "13px 14px", whiteSpace: "nowrap" }}>{statusBadge(c)}</td>
                    <td style={{ padding: "13px 14px", fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                      {c.hasNoExpiry ? "ללא תפוגה" : `${fmtDate(c.startsAt)} → ${fmtDate(c.endsAt)}`}
                    </td>
                    <td style={{ padding: "13px 14px", fontSize: 12, color: "var(--foreground-secondary)", fontWeight: 900, whiteSpace: "nowrap" }}>
                      {c.usageCount}
                      {c.usageLimitTotal != null ? <span style={{ color: "var(--muted-foreground)", fontWeight: 800 }}> / {c.usageLimitTotal}</span> : null}
                    </td>
                    <td style={{ padding: "13px 14px", fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                      {c.minCartAmount != null ? fmtMoney(c.minCartAmount) : "—"}
                    </td>
                    <td style={{ padding: "13px 14px", fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{fmtDateTime(c.createdAt)}</td>
                    <td style={{ padding: "13px 14px" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {(() => {
                          const rowLocked = rowBusy?.id === c.id;
                          const spin = { animation: "spin 0.85s linear infinite" as const };
                          return (
                            <>
                              <SmallButton tone="default" disabled={rowLocked} onClick={() => openEdit(c)}>
                                <Pencil size={16} />
                                עריכה
                              </SmallButton>
                              <SmallButton
                                tone="primary"
                                disabled={rowLocked}
                                onClick={() => toggleActive(c)}
                              >
                                {rowBusy?.id === c.id && rowBusy.kind === "toggle" ? (
                                  <Loader2 size={16} style={spin} />
                                ) : (
                                  <CheckCircle2 size={16} />
                                )}
                                {rowBusy?.id === c.id && rowBusy.kind === "toggle" ? "מעבד…" : c.isActive ? "השבת" : "הפעל"}
                              </SmallButton>
                              <SmallButton tone="danger" disabled={rowLocked} onClick={() => remove(c)}>
                                {rowBusy?.id === c.id && rowBusy.kind === "delete" ? (
                                  <Loader2 size={16} style={spin} />
                                ) : (
                                  <Trash2 size={16} style={{ color: "var(--destructive)" }} />
                                )}
                                {rowBusy?.id === c.id && rowBusy.kind === "delete" ? "מוחק…" : "מחיקה"}
                              </SmallButton>
                              <SmallButton tone="default" disabled={rowLocked} onClick={() => runValidate(c)}>
                                {rowBusy?.id === c.id && rowBusy.kind === "validate" ? (
                                  <Loader2 size={16} style={spin} />
                                ) : (
                                  <Eye size={16} />
                                )}
                                {rowBusy?.id === c.id && rowBusy.kind === "validate" ? "בודק…" : "בדיקה"}
                              </SmallButton>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {coupons.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              עמוד {page.toLocaleString("he-IL")} מתוך {pageCount.toLocaleString("he-IL")}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <SmallButton disabled={page <= 1 || listRefreshing} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronRight size={16} />
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
              <SmallButton disabled={page >= pageCount || listRefreshing} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                הבא
                <ChevronLeft size={16} />
              </SmallButton>
            </div>
          </div>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        mode={drawerMode}
        initial={drawerMode === "edit" ? editing : null}
        onClose={() => setDrawerOpen(false)}
        onSave={onSave}
      />
      <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </div>
  );
}

