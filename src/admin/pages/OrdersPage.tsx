import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import { apiFetch } from "../lib/api";
import { getOrderLineItems } from "../lib/orderLines";
import {
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  MessageSquarePlus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

type PaymentStatus = "paid" | "pending" | "failed";
type OrderStatus = "new" | "processing" | "ready" | "shipped" | "completed" | "cancelled";
type BackendOrderStatus = "NEW" | "PAID" | "FULFILLED" | "SHIPPED" | "COMPLETED" | "CANCELLED" | "REFUNDED";

const BACKEND_STATUS_LABEL: Record<BackendOrderStatus, string> = {
  NEW: "חדש",
  PAID: "שולם",
  FULFILLED: "בהכנה",
  SHIPPED: "נשלח",
  COMPLETED: "הושלם",
  CANCELLED: "בוטל",
  REFUNDED: "זוכה",
};

const ALLOWED_TRANSITIONS: Record<BackendOrderStatus, BackendOrderStatus[]> = {
  NEW: ["PAID", "CANCELLED"],
  PAID: ["FULFILLED", "CANCELLED", "REFUNDED"],
  FULFILLED: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["COMPLETED", "REFUNDED"],
  COMPLETED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

type OrderItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
  customerImageUrl?: string | null;
};

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  createdAt: string;
  total: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  rawStatus: BackendOrderStatus;
  designNumber: string;
  items: OrderItem[];
  engravingText: string;
  pendantShape: string;
  material: string;
  color: string;
  notes?: string;
};

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
};

function fmtMoney(v: number) {
  return `₪${Number(v || 0).toLocaleString("he-IL")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentBadge(status: PaymentStatus) {
  if (status === "paid") return <Badge variant="success">שולם</Badge>;
  if (status === "failed") return <Badge variant="error">נכשל</Badge>;
  return <Badge variant="warning">ממתין לתשלום</Badge>;
}

function orderBadge(status: OrderStatus) {
  if (status === "completed") return <Badge variant="success">הושלם</Badge>;
  if (status === "shipped") return <Badge variant="info">נשלח</Badge>;
  if (status === "ready") return <Badge variant="default">מוכן</Badge>;
  if (status === "processing") return <Badge variant="default">בטיפול</Badge>;
  if (status === "cancelled") return <Badge variant="error">בוטל</Badge>;
  return <Badge variant="info">חדש</Badge>;
}

function statusLabel(status: OrderStatus) {
  if (status === "new") return "חדש";
  if (status === "processing") return "בטיפול";
  if (status === "ready") return "מוכן";
  if (status === "shipped") return "נשלח";
  if (status === "completed") return "הושלם";
  return "בוטל";
}

function paymentLabel(status: PaymentStatus) {
  if (status === "paid") return "שולם";
  if (status === "failed") return "נכשל";
  return "ממתין לתשלום";
}

function extractOrderNote(rawOrder: any) {
  const details = rawOrder?.deliveryDetails;
  if (!details) return "";
  const obj =
    typeof details === "object"
      ? details
      : typeof details === "string"
        ? (() => {
            try {
              return JSON.parse(details);
            } catch {
              return null;
            }
          })()
        : null;
  if (!obj || typeof obj !== "object") return "";
  return String((obj as any).orderNotes ?? "").trim();
}

function extractCustomizationFromLineItems(lineItems: any[]) {
  const engravingLines = lineItems
    .map((it) => String(it?.engravingText ?? "").trim())
    .filter((v) => v.length > 0);
  const colors = Array.from(
    new Set(
      lineItems
        .map((it) => String(it?.color ?? "").trim())
        .filter((v) => v.length > 0),
    ),
  );
  const materials = Array.from(
    new Set(
      lineItems
        .map((it) => String(it?.material ?? "").trim())
        .filter((v) => v.length > 0),
    ),
  );
  const shapes = Array.from(
    new Set(
      lineItems
        .map((it) => String(it?.pendantShape ?? "").trim())
        .filter((v) => v.length > 0),
    ),
  );
  return {
    engravingText: engravingLines.length ? engravingLines.join(" | ") : "—",
    color: colors.length ? colors.join(", ") : "—",
    material: materials.length ? materials.join(", ") : "—",
    pendantShape: shapes.length ? shapes.join(", ") : "—",
  };
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "muted" | "success" | "warning" | "info" | "error";
}) {
  const toneMap: Record<string, { color: string; bg: string; border: string }> = {
    default: { color: "var(--primary)", bg: "rgba(201,169,110,0.12)", border: "rgba(201,169,110,0.24)" },
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
        <ArrowUpRight size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--foreground)", lineHeight: 1.15 }}>{value}</div>
        <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "2px" }}>{label}</div>
        {hint && <div style={{ fontSize: "11px", color: t.color, marginTop: "6px", fontWeight: 600 }}>{hint}</div>}
      </div>
    </div>
  );
}

function Drawer({
  open,
  order,
  onClose,
  onStatusUpdated,
}: {
  open: boolean;
  order: Order | null;
  onClose: () => void;
  onStatusUpdated: (id: string, next: BackendOrderStatus) => void;
}) {
  const [nextStatus, setNextStatus] = useState<BackendOrderStatus | "">("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setNextStatus("");
    setErr(null);
  }, [order?.id]);

  if (!open) return null;

  const allowed = order ? ALLOWED_TRANSITIONS[order.rawStatus] ?? [] : [];

  async function handleSave() {
    if (!order || !nextStatus) return;
    setSaving(true);
    setErr(null);
    try {
      await apiFetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      onStatusUpdated(order.id, nextStatus);
      setNextStatus("");
    } catch (e: any) {
      setErr(e?.error === "INVALID_TRANSITION" ? "מעבר סטטוס לא חוקי" : "שגיאה בעדכון סטטוס");
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
          width: "min(520px, 92vw)",
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
        }}
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
            <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--foreground)" }}>פרטי הזמנה</div>
            <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "2px" }}>{order?.orderNumber ?? "—"}</div>
          </div>
          <button
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
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "18px", overflowY: "auto" }}>
          {!order ? (
            <div style={{ ...cardStyle, padding: "16px", color: "var(--muted-foreground)", fontSize: "13px" }}>אין נתונים להצגה.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ ...cardStyle, padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--foreground)" }}>{order.orderNumber}</div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {paymentBadge(order.paymentStatus)}
                    {orderBadge(order.orderStatus)}
                  </div>
                </div>
                <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>לקוח</div>
                    <div style={{ fontSize: "13px", color: "var(--foreground)", fontWeight: 700, marginTop: "3px" }}>{order.customerName}</div>
                    <div style={{ fontSize: "12px", color: "var(--foreground-secondary)", marginTop: "6px" }}>{order.customerPhone}</div>
                    <div style={{ fontSize: "12px", color: "var(--foreground-secondary)", marginTop: "2px" }}>{order.customerEmail}</div>
                  </div>
                  <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>סיכום</div>
                    <div style={{ fontSize: "13px", color: "var(--foreground)", fontWeight: 800, marginTop: "3px" }}>{fmtMoney(order.total)}</div>
                    <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "6px" }}>{fmtDate(order.createdAt)}</div>
                    <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "2px" }}>מס׳ עיצוב: {order.designNumber}</div>
                  </div>
                </div>
              </div>

              <div style={{ ...cardStyle, padding: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--foreground)" }}>מוצרים בהזמנה</div>
                <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {order.items.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        padding: "10px 12px",
                        border: "1px solid var(--border)",
                        background: "var(--input)",
                        borderRadius: "12px",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "12px", color: "var(--foreground)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {it.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px" }}>כמות: {it.qty}</div>
                        {it.customerImageUrl ? (
                          <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => window.open(it.customerImageUrl || "", "_blank", "noopener,noreferrer")}
                              style={{
                                background: "var(--input)",
                                border: "1px solid var(--border)",
                                color: "var(--foreground-secondary)",
                                borderRadius: "8px",
                                padding: "5px 8px",
                                fontSize: "11px",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Eye size={13} />
                              צפייה בתמונה
                            </button>
                            <a
                              href={it.customerImageUrl}
                              download={`customer-image-${order.orderNumber || it.id}.png`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                background: "transparent",
                                border: "1px solid var(--border)",
                                color: "var(--foreground-secondary)",
                                borderRadius: "8px",
                                padding: "5px 8px",
                                fontSize: "11px",
                                fontWeight: 800,
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Download size={13} />
                              הורדה
                            </a>
                          </div>
                        ) : null}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--foreground-secondary)", fontWeight: 700 }}>{fmtMoney(it.price)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...cardStyle, padding: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--foreground)" }}>פרטי התאמה אישית</div>
                <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[
                    { k: "טקסט חריטה", v: order.engravingText || "—" },
                    { k: "צורת תליון", v: order.pendantShape },
                    { k: "חומר", v: order.material },
                    { k: "צבע", v: order.color },
                  ].map((row) => (
                    <div key={row.k} style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px" }}>
                      <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{row.k}</div>
                      <div style={{ fontSize: "12px", color: "var(--foreground-secondary)", marginTop: "4px", fontWeight: 700 }}>{row.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "10px", background: "var(--input)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>הערות</div>
                  <div style={{ fontSize: "12px", color: "var(--foreground-secondary)", marginTop: "4px", lineHeight: 1.6 }}>
                    {order.notes?.trim() ? order.notes : "—"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "14px 18px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: "10px",
            alignItems: "center",
            justifyContent: "flex-start",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
            <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
              סטטוס נוכחי: {order ? BACKEND_STATUS_LABEL[order.rawStatus] : "—"}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as BackendOrderStatus | "")}
                disabled={!order || allowed.length === 0 || saving}
                style={{
                  background: "var(--input)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  flex: 1,
                }}
              >
                <option value="">{allowed.length ? "בחר סטטוס חדש…" : "אין מעברים אפשריים"}</option>
                {allowed.map((s) => (
                  <option key={s} value={s}>{BACKEND_STATUS_LABEL[s]}</option>
                ))}
              </select>
              <button
                onClick={handleSave}
                disabled={!nextStatus || saving}
                style={{
                  background: nextStatus && !saving ? "var(--primary)" : "rgba(201,169,110,0.4)",
                  color: "var(--primary-foreground)",
                  border: "1px solid rgba(201,169,110,0.35)",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: nextStatus && !saving ? "pointer" : "not-allowed",
                }}
              >
                {saving ? "שומר…" : "עדכון סטטוס"}
              </button>
            </div>
            {err && (
              <div style={{ fontSize: "11px", color: "var(--destructive)" }}>{err}</div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export function OrdersPage() {
  const initialUrlState = useMemo(() => {
    if (typeof window === "undefined") return { q: "", orderId: "" };
    const params = new URLSearchParams(window.location.search);
    return { q: params.get("q") ?? "", orderId: params.get("order") ?? "" };
  }, []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listLoadError, setListLoadError] = useState<string | null>(null);

  const loadOrders = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    try {
      setListLoadError(null);
      const out = await apiFetch<{ orders: any[] }>("/api/orders?limit=500");
      const rows = Array.isArray(out?.orders) ? out.orders : [];
      const mapped: Order[] = rows.map((o: any) => {
        const lineItems = getOrderLineItems(o);
        const customization = extractCustomizationFromLineItems(lineItems);
        const lineItemsTotalAgorot = lineItems.reduce((sum: number, it: any) => {
          const unit = Number(it?.unitPrice ?? 0);
          const qty = Number(it?.qty ?? 1);
          if (!Number.isFinite(unit) || !Number.isFinite(qty)) return sum;
          return sum + unit * qty;
        }, 0);
        const subtotalAgorot = Number(o.subtotal);
        const shippingAgorot = Number(o.shippingFee ?? 0);
        const discountAgorot = Number(o.discountAmount ?? 0);
        const totalFromSummary =
          Number.isFinite(subtotalAgorot) && subtotalAgorot > 0
            ? subtotalAgorot + (Number.isFinite(shippingAgorot) ? shippingAgorot : 0) - (Number.isFinite(discountAgorot) ? discountAgorot : 0)
            : null;
        const rawTotalAgorot = Number(o.total ?? 0);
        const totalAgorot = Number.isFinite(totalFromSummary ?? NaN)
          ? Math.max(0, Number(totalFromSummary))
          : lineItemsTotalAgorot > 0
            ? lineItemsTotalAgorot
            : Number.isFinite(rawTotalAgorot)
              ? Math.max(0, rawTotalAgorot)
              : 0;
        const raw: BackendOrderStatus = (o.status as BackendOrderStatus) ?? "NEW";
        const uiStatus: OrderStatus =
          raw === "COMPLETED" || raw === "PAID"
            ? "completed"
            : raw === "CANCELLED" || raw === "REFUNDED"
              ? "cancelled"
              : raw === "SHIPPED"
                ? "shipped"
                : raw === "FULFILLED"
                  ? "ready"
                  : "new";
        return {
          id: String(o.id ?? ""),
          orderNumber: String(o.orderNumber ?? ""),
          customerName: String(o.customer?.fullName ?? o.customer?.email ?? "לקוח"),
          customerPhone: String(o.customer?.phone ?? "—"),
          customerEmail: String(o.customer?.email ?? "—"),
          createdAt: String(o.createdAt ?? new Date().toISOString()),
          total: totalAgorot / 100,
          paymentStatus: (() => {
            // Prefer the real payment field written by the PayPlus webhook; fall back to the
            // legacy status-derived value for orders created before payment fields existed.
            const raw2 = String(o.paymentStatus ?? "").toLowerCase();
            if (raw2 === "paid" || raw2 === "failed" || raw2 === "pending") return raw2 as PaymentStatus;
            if (raw2 === "cancelled") return "failed";
            return raw === "PAID" || raw === "COMPLETED" ? "paid" : raw === "CANCELLED" || raw === "REFUNDED" ? "failed" : "pending";
          })(),
          orderStatus: uiStatus,
          rawStatus: raw,
          designNumber: "—",
          items: lineItems.map((it: any, idx: number) => ({
            id: String(it?.id ?? `${o.id}-${idx}`),
            name: String(it?.title ?? it?.nameSnapshot ?? it?.name ?? "מוצר"),
            qty: Number(it?.qty ?? 1),
            price: Number(it?.unitPrice ?? 0) / 100,
            customerImageUrl: typeof it?.customerImageUrl === "string" && it.customerImageUrl.trim() ? it.customerImageUrl : null,
          })),
          engravingText: customization.engravingText,
          pendantShape: customization.pendantShape,
          material: customization.material,
          color: customization.color,
          notes: extractOrderNote(o),
        };
      });
      setOrders(mapped);
    } catch (e: any) {
      setOrders([]);
      if (e?.status === 503 && e?.error === "DATABASE_UNAVAILABLE") {
        setListLoadError(
          "מסד הנתונים לא זמין מהשרת. בדקו DATABASE_URL ו־Postgres; לאחר החזרת החיבור רעננו את העמוד."
        );
      } else {
        setListLoadError("לא ניתן לטעון הזמנות מהשרת.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders(false);
  }, [loadOrders]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadOrders(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadOrders]);

  const [query, setQuery] = useState(initialUrlState.q);
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [payment, setPayment] = useState<PaymentStatus | "all">("all");
  const [datePreset, setDatePreset] = useState<"all" | "today" | "7d" | "30d">("30d");
  const [selected, setSelected] = useState<Order | null>(null);
  const [notePopoverOrderId, setNotePopoverOrderId] = useState<string | null>(null);
  const [noteEditorOrder, setNoteEditorOrder] = useState<Order | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteEditorError, setNoteEditorError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialUrlState.orderId || orders.length === 0) return;
    const matched = orders.find((o) => o.id === initialUrlState.orderId);
    if (matched) setSelected(matched);
  }, [initialUrlState.orderId, orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const from =
      datePreset === "today"
        ? now - 1000 * 60 * 60 * 24
        : datePreset === "7d"
          ? now - 1000 * 60 * 60 * 24 * 7
          : datePreset === "30d"
            ? now - 1000 * 60 * 60 * 24 * 30
            : 0;
    return orders.filter((o) => {
      const matchesQuery =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q);
      const matchesStatus = status === "all" ? true : o.orderStatus === status;
      const matchesPayment = payment === "all" ? true : o.paymentStatus === payment;
      const matchesDate = from === 0 ? true : new Date(o.createdAt).getTime() >= from;
      return matchesQuery && matchesStatus && matchesPayment && matchesDate;
    });
  }, [datePreset, orders, payment, query, status]);

  const counts = useMemo(() => {
    const all = orders.length;
    const byStatus = (s: OrderStatus) => orders.filter((o) => o.orderStatus === s).length;
    const byPay = (p: PaymentStatus) => orders.filter((o) => o.paymentStatus === p).length;
    return {
      all,
      newOrders: byStatus("new"),
      processing: byStatus("processing"),
      paid: byPay("paid"),
      shipped: byStatus("shipped"),
      cancelled: byStatus("cancelled"),
    };
  }, [orders]);

  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const hasFilters =
    query.trim().length > 0 || status !== "all" || payment !== "all" || datePreset !== "30d";

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setPayment("all");
    setDatePreset("30d");
    setPage(1);
  }

  async function handleAddNote(order: Order) {
    const current = String(order.notes ?? "").trim();
    setNoteEditorOrder(order);
    setNoteDraft(current);
    setNoteEditorError(null);
  }

  async function handleSaveNote() {
    if (!noteEditorOrder) return;
    const next = noteDraft;
    setNoteSaving(true);
    setNoteEditorError(null);
    try {
      const out = await apiFetch<{ ok?: boolean; note?: string }>(`/api/orders/${noteEditorOrder.id}/note`, {
        method: "PATCH",
        body: JSON.stringify({ note: next }),
      });
      const saved = String(out?.note ?? next).trim();
      setOrders((prev) => prev.map((x) => (x.id === noteEditorOrder.id ? { ...x, notes: saved } : x)));
      setSelected((cur) => (cur && cur.id === noteEditorOrder.id ? { ...cur, notes: saved } : cur));
      if (!saved) setNotePopoverOrderId((cur) => (cur === noteEditorOrder.id ? null : cur));
      setNoteEditorOrder(null);
      setNoteDraft("");
    } catch {
      setNoteEditorError("לא ניתן לשמור הערה כרגע");
    } finally {
      setNoteSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {listLoadError && (
        <div
          style={{
            border: "1px solid rgba(239, 68, 68, 0.35)",
            background: "rgba(239, 68, 68, 0.1)",
            color: "var(--destructive)",
            borderRadius: "10px",
            padding: "12px 14px",
            fontSize: "13px",
            lineHeight: 1.45,
          }}
        >
          {listLoadError}
        </div>
      )}
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)" }}>הזמנות</h1>
          <p style={{ fontSize: "13px", color: "var(--muted-foreground)", marginTop: "3px" }}>
            ניהול הזמנות, סטטוסים ותשלומים — תצוגה נקייה ומוכנה לחיבור לבקאנד.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => loadOrders(true)}
            disabled={refreshing}
            style={{
              background: "var(--input)",
              border: "1px solid var(--border)",
              color: "var(--foreground-secondary)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "12px",
              fontWeight: 800,
              cursor: refreshing ? "not-allowed" : "pointer",
              opacity: refreshing ? 0.7 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <RefreshCw size={16} style={{ animation: refreshing ? "spin 0.9s linear infinite" : "none" }} />
            {refreshing ? "מרענן…" : "רענון"}
          </button>
          <button
            type="button"
            style={{
              background: "var(--input)",
              border: "1px solid var(--border)",
              color: "var(--foreground-secondary)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <Download size={16} />
            ייצוא הזמנות
          </button>
        </div>
      </div>

      {/* Summary cards row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
        <SummaryCard label="סך הזמנות" value={String(counts.all)} hint="30 ימים אחרונים (דמו)" tone="muted" />
        <SummaryCard label="הזמנות חדשות" value={String(counts.newOrders)} hint="דורש קשר / אישור" tone="default" />
        <SummaryCard label="ממתינות לטיפול" value={String(counts.processing)} hint="בסטטוס בטיפול" tone="warning" />
        <SummaryCard label="שולמו" value={String(counts.paid)} hint="תשלום הושלם" tone="success" />
        <SummaryCard label="נשלחו" value={String(counts.shipped)} hint="מוכנות למסירה" tone="info" />
        <SummaryCard label="בוטלו" value={String(counts.cancelled)} hint="תשלום/ביטול" tone="error" />
      </div>

      {/* Filters */}
      <div style={{ ...cardStyle, padding: "14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "10px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="חיפוש לפי מספר הזמנה / לקוח"
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

          <div style={{ position: "relative" }}>
            <Filter size={16} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as any);
                setPage(1);
              }}
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
                appearance: "none",
              }}
              aria-label="סטטוס הזמנה"
            >
              <option value="all">כל הסטטוסים</option>
              <option value="new">חדש</option>
              <option value="processing">בטיפול</option>
              <option value="ready">מוכן</option>
              <option value="shipped">נשלח</option>
              <option value="completed">הושלם</option>
              <option value="cancelled">בוטל</option>
            </select>
          </div>

          <div style={{ position: "relative" }}>
            <Filter size={16} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <select
              value={payment}
              onChange={(e) => {
                setPayment(e.target.value as any);
                setPage(1);
              }}
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
                appearance: "none",
              }}
              aria-label="סטטוס תשלום"
            >
              <option value="all">כל התשלומים</option>
              <option value="paid">שולם</option>
              <option value="pending">ממתין לתשלום</option>
              <option value="failed">נכשל</option>
            </select>
          </div>

          <div style={{ position: "relative" }}>
            <Calendar size={16} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value as any);
                setPage(1);
              }}
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
                appearance: "none",
              }}
              aria-label="תאריך"
            >
              <option value="30d">30 ימים אחרונים</option>
              <option value="7d">7 ימים אחרונים</option>
              <option value="today">היום</option>
              <option value="all">כל הזמן</option>
            </select>
          </div>

          <button
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
              fontWeight: 800,
              cursor: hasFilters ? "pointer" : "default",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              whiteSpace: "nowrap",
            }}
            aria-disabled={!hasFilters}
          >
            <X size={16} />
            נקה
          </button>
        </div>

        <div style={{ marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
            מציג {filtered.length.toLocaleString("he-IL")} הזמנות
          </div>
          {hasFilters && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {query.trim() && <Badge variant="muted">חיפוש: {query.trim()}</Badge>}
              {status !== "all" && <Badge variant="muted">סטטוס: {statusLabel(status as OrderStatus)}</Badge>}
              {payment !== "all" && <Badge variant="muted">תשלום: {paymentLabel(payment as PaymentStatus)}</Badge>}
              {datePreset !== "30d" && <Badge variant="muted">טווח: {datePreset === "today" ? "היום" : datePreset === "7d" ? "7 ימים" : datePreset === "all" ? "כל הזמן" : "30 ימים"}</Badge>}
            </div>
          )}
        </div>
      </div>

      {/* Orders table */}
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--foreground)" }}>רשימת הזמנות</div>
            <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "2px" }}>לחץ על שורה לצפייה בפרטים.</div>
          </div>
          <button
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--foreground-secondary)",
              borderRadius: "10px",
              padding: "9px 10px",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Filter size={16} />
            סינון מתקדם
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 16, color: "var(--muted-foreground)", fontSize: 12 }}>טוען הזמנות...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "24px" }}>
            <div style={{ ...cardStyle, padding: "20px", background: "var(--card)" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--foreground)" }}>אין הזמנות כרגע</div>
              <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "6px", lineHeight: 1.6 }}>
                אין הזמנות להצגה עבור המסננים שנבחרו.
              </div>
              <div style={{ marginTop: "12px" }}>
                <button
                  onClick={clearFilters}
                  style={{
                    background: "var(--input)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground-secondary)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  נקה מסננים
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1060 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {[
                    "מספר הזמנה",
                    "לקוח",
                    "תאריך",
                    "סהכ הוצאה",
                    "סטטוס תשלום",
                    "סטטוס הזמנה",
                    "מספר עיצוב",
                    "מוצרים",
                    "פעולות",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "right",
                        padding: "12px 14px",
                        fontSize: "11px",
                        color: "var(--muted-foreground)",
                        fontWeight: 700,
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
                {pageItems.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o)}
                    style={{
                      cursor: "pointer",
                      background: "transparent",
                      borderBottom: "1px solid var(--border)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "13px 14px", fontSize: "13px", color: "var(--foreground-secondary)", fontWeight: 800, whiteSpace: "nowrap" }}>
                      {o.orderNumber}
                    </td>
                    <td style={{ padding: "13px 14px", fontSize: "13px", color: "var(--foreground-secondary)", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", position: "relative" }}>
                        <span style={{ color: "var(--foreground)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "8px" }}>
                          {o.customerName}
                          {o.notes?.trim() ? (
                            <button
                              type="button"
                              aria-label="צפה בהערה"
                              title="צפה בהערה"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNotePopoverOrderId((cur) => (cur === o.id ? null : o.id));
                              }}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                border: "1px solid rgba(245,158,11,0.45)",
                                background: "rgba(245,158,11,0.16)",
                                color: "var(--warning)",
                                fontSize: 12,
                                fontWeight: 900,
                                lineHeight: 1,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              !
                            </button>
                          ) : null}
                        </span>
                        <span style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>{o.customerPhone}</span>
                        {notePopoverOrderId === o.id && o.notes?.trim() ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: "absolute",
                              top: "calc(100% + 6px)",
                              right: 0,
                              width: "min(320px, 55vw)",
                              borderRadius: "10px",
                              border: "1px solid var(--border)",
                              background: "var(--card)",
                              boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
                              padding: "10px 12px",
                              zIndex: 20,
                            }}
                          >
                            <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginBottom: "4px" }}>הערה להזמנה</div>
                            <div style={{ fontSize: "12px", color: "var(--foreground-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{o.notes}</div>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td style={{ padding: "13px 14px", fontSize: "12px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{fmtDate(o.createdAt)}</td>
                    <td style={{ padding: "13px 14px", fontSize: "13px", color: "var(--foreground-secondary)", fontWeight: 800, whiteSpace: "nowrap" }}>
                      {fmtMoney(o.total)}
                    </td>
                    <td style={{ padding: "13px 14px", whiteSpace: "nowrap" }}>{paymentBadge(o.paymentStatus)}</td>
                    <td style={{ padding: "13px 14px", whiteSpace: "nowrap" }}>{orderBadge(o.orderStatus)}</td>
                    <td style={{ padding: "13px 14px", fontSize: "12px", color: "var(--foreground-secondary)", whiteSpace: "nowrap", fontWeight: 700 }}>
                      {o.designNumber}
                    </td>
                    <td style={{ padding: "13px 14px", fontSize: "12px", color: "var(--foreground-secondary)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ color: "var(--foreground-secondary)", fontWeight: 700 }}>
                          {o.items[0]?.name ?? "—"}
                          {o.items.length > 1 ? ` +${o.items.length - 1}` : ""}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>כמות: {o.items.reduce((a, i) => a + i.qty, 0)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "13px 14px" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-start" }}>
                        <button
                          onClick={() => handleAddNote(o)}
                          style={{
                            background: "var(--primary)",
                            border: "1px solid rgba(201,169,110,0.35)",
                            color: "var(--primary-foreground)",
                            borderRadius: "10px",
                            padding: "8px 10px",
                            fontSize: "12px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <MessageSquarePlus size={16} />
                          הוספת הערה
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
            עמוד {page.toLocaleString("he-IL")} מתוך {pageCount.toLocaleString("he-IL")}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                background: "var(--input)",
                border: "1px solid var(--border)",
                color: "var(--foreground-secondary)",
                borderRadius: "10px",
                padding: "8px 10px",
                fontSize: "12px",
                fontWeight: 800,
                cursor: page <= 1 ? "default" : "pointer",
                opacity: page <= 1 ? 0.5 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <ChevronRight size={16} />
              הקודם
            </button>

            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {Array.from({ length: Math.min(5, pageCount) }).map((_, idx) => {
                const start = Math.max(1, Math.min(page - 2, pageCount - 4));
                const n = start + idx;
                if (n > pageCount) return null;
                const active = n === page;
                return (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "10px",
                      background: active ? "rgba(201,169,110,0.15)" : "var(--input)",
                      border: active ? "1px solid rgba(201,169,110,0.35)" : "1px solid var(--border)",
                      color: active ? "var(--primary)" : "var(--foreground-secondary)",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              style={{
                background: "var(--input)",
                border: "1px solid var(--border)",
                color: "var(--foreground-secondary)",
                borderRadius: "10px",
                padding: "8px 10px",
                fontSize: "12px",
                fontWeight: 800,
                cursor: page >= pageCount ? "default" : "pointer",
                opacity: page >= pageCount ? 0.5 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              הבא
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      </div>

      <Drawer
        open={Boolean(selected)}
        order={selected}
        onClose={() => setSelected(null)}
        onStatusUpdated={(id, next) => {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === id
                ? {
                    ...o,
                    rawStatus: next,
                    orderStatus:
                      next === "COMPLETED" || next === "PAID"
                        ? "completed"
                        : next === "CANCELLED" || next === "REFUNDED"
                          ? "cancelled"
                          : next === "SHIPPED"
                            ? "shipped"
                            : next === "FULFILLED"
                              ? "ready"
                              : "new",
                    paymentStatus:
                      next === "PAID" || next === "COMPLETED"
                        ? "paid"
                        : next === "CANCELLED" || next === "REFUNDED"
                          ? "failed"
                          : "pending",
                  }
                : o,
            ),
          );
          setSelected((cur) => (cur && cur.id === id ? { ...cur, rawStatus: next } : cur));
        }}
      />
      {noteEditorOrder && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 360 }}
            onClick={() => {
              if (noteSaving) return;
              setNoteEditorOrder(null);
              setNoteEditorError(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(560px, calc(100vw - 32px))",
              borderRadius: "14px",
              border: "1px solid var(--border)",
              background: "var(--card)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
              zIndex: 370,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--foreground)" }}>עריכת הערה להזמנה</div>
                <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "2px" }}>
                  {noteEditorOrder.orderNumber}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (noteSaving) return;
                  setNoteEditorOrder(null);
                  setNoteEditorError(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted-foreground)",
                  cursor: noteSaving ? "default" : "pointer",
                  opacity: noteSaving ? 0.55 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              disabled={noteSaving}
              rows={5}
              placeholder="הוסף/ערוך הערה להזמנה"
              style={{
                width: "100%",
                resize: "vertical",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--input)",
                color: "var(--foreground)",
                padding: "10px 12px",
                fontSize: "13px",
                lineHeight: 1.45,
                fontFamily: "inherit",
              }}
            />
            {noteEditorError && <div style={{ fontSize: "12px", color: "var(--destructive)" }}>{noteEditorError}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  if (noteSaving) return;
                  setNoteEditorOrder(null);
                  setNoteEditorError(null);
                }}
                style={{
                  background: "var(--input)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground-secondary)",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: noteSaving ? "default" : "pointer",
                  opacity: noteSaving ? 0.65 : 1,
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={noteSaving}
                style={{
                  background: "rgba(201,169,110,0.16)",
                  border: "1px solid rgba(201,169,110,0.35)",
                  color: "var(--primary)",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: noteSaving ? "default" : "pointer",
                  opacity: noteSaving ? 0.75 : 1,
                }}
              >
                {noteSaving ? "שומר…" : "שמירה"}
              </button>
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </div>
  );
}

