"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import { useToast } from "../ui/toast";
import { apiFetch } from "../lib/api";
import { firstOrderLineProductName } from "../lib/orderLines";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  MessageSquarePlus,
  Pencil,
  RefreshCw,
  Search,
  Star,
  UserRound,
  X,
} from "lucide-react";

type CustomerStatus = "new" | "repeat" | "inactive" | "no_orders";

type CustomerOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  total: number;
  productPreview: string;
  designNumber?: string;
};

type Customer = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  joinedAt: string;
  ordersCount: number;
  totalSpend: number;
  lastOrderAt?: string;
  lastOrderProduct?: string;
  status: CustomerStatus;
  tags: string[];
  savedDesigns: string[];
  internalNote: string;
  addressPlaceholder: string;
  recentOrders: CustomerOrder[];
  recentlyPurchased: string[];
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
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "ל";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function statusLabel(s: CustomerStatus) {
  if (s === "new") return "חדש";
  if (s === "repeat") return "חוזר";
  if (s === "no_orders") return "ללא הזמנות";
  return "לא פעיל";
}

function statusBadge(s: CustomerStatus) {
  if (s === "repeat") return <Badge variant="default">חוזר</Badge>;
  if (s === "new") return <Badge variant="info">חדש</Badge>;
  if (s === "no_orders") return <Badge variant="warning">ללא הזמנות</Badge>;
  return <Badge variant="muted">לא פעיל</Badge>;
}

function SegmentPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "rgba(201,169,110,0.15)" : "var(--input)",
        border: active ? "1px solid rgba(201,169,110,0.35)" : "1px solid var(--border)",
        color: active ? "var(--primary)" : "var(--foreground-secondary)",
        borderRadius: "999px",
        padding: "8px 12px",
        fontSize: "12px",
        fontWeight: 900,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
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

function Drawer({
  open,
  customer,
  onClose,
  onAddNote,
}: {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onAddNote: () => void;
}) {
  if (!open) return null;
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
          width: "min(560px, 92vw)",
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
            <div style={{ fontSize: "14px", fontWeight: 900, color: "var(--foreground)" }}>פרטי לקוח</div>
            <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "2px" }}>{customer?.email ?? "—"}</div>
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
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "18px", overflowY: "auto" }}>
          {!customer ? (
            <div style={{ ...cardStyle, padding: "16px", color: "var(--muted-foreground)", fontSize: "13px" }}>אין נתונים להצגה.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ ...cardStyle, padding: "16px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: "rgba(201,169,110,0.12)",
                      border: "1px solid rgba(201,169,110,0.25)",
                      color: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                    aria-label="אוואטר לקוח"
                  >
                    {initials(customer.fullName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <div style={{ fontSize: "16px", fontWeight: 900, color: "var(--foreground)", lineHeight: 1.2 }}>{customer.fullName}</div>
                      {statusBadge(customer.status)}
                    </div>
                    <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted-foreground)" }}>
                      הצטרפות: <span style={{ color: "var(--foreground-secondary)", fontWeight: 800 }}>{fmtDate(customer.joinedAt)}</span>
                    </div>
                    <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <Badge variant="muted">{customer.phone}</Badge>
                      <Badge variant="muted">{customer.email}</Badge>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 800 }}>סך הוצאה</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "var(--foreground-secondary)", fontWeight: 900 }}>{fmtMoney(customer.totalSpend)}</div>
                  </div>
                  <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 800 }}>מספר הזמנות</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "var(--foreground-secondary)", fontWeight: 900 }}>{customer.ordersCount}</div>
                  </div>
                  <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 800 }}>הזמנה אחרונה</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--foreground-secondary)", fontWeight: 900 }}>
                      {customer.lastOrderAt ? fmtDateTime(customer.lastOrderAt) : "—"}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted-foreground)" }}>{customer.lastOrderProduct ?? ""}</div>
                  </div>
                  <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 800 }}>עיצובים שמורים</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "var(--foreground-secondary)", fontWeight: 900 }}>
                      {customer.savedDesigns.length}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted-foreground)" }}>
                      {customer.savedDesigns.slice(0, 3).join(", ")}
                      {customer.savedDesigns.length > 3 ? "…" : ""}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "10px", background: "var(--input)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 800 }}>כתובת (placeholder)</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.6, fontWeight: 800 }}>
                    {customer.addressPlaceholder}
                  </div>
                </div>
              </div>

              <div style={{ ...cardStyle, padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 900, color: "var(--foreground)" }}>תגיות</div>
                  <Badge variant="muted">דמו</Badge>
                </div>
                <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {customer.tags.length ? customer.tags.map((t) => <Badge key={t} variant="default">{t}</Badge>) : <Badge variant="muted">אין תגיות</Badge>}
                </div>
              </div>

              <div style={{ ...cardStyle, padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 900, color: "var(--foreground)" }}>הערות פנימיות</div>
                  <button
                    type="button"
                    onClick={onAddNote}
                    style={{
                      background: "var(--input)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground-secondary)",
                      borderRadius: "10px",
                      padding: "8px 10px",
                      fontSize: "12px",
                      fontWeight: 900,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <MessageSquarePlus size={16} />
                    הוספת הערה
                  </button>
                </div>
                <div style={{ marginTop: "10px", background: "var(--input)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, color: "var(--foreground-secondary)", fontSize: 12, lineHeight: 1.7, fontWeight: 700 }}>
                  {customer.internalNote || "—"}
                </div>
              </div>

              <div style={{ ...cardStyle, padding: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 900, color: "var(--foreground)" }}>הזמנות אחרונות</div>
                <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {customer.recentOrders.length ? (
                    customer.recentOrders.map((o) => (
                      <div
                        key={o.id}
                        style={{
                          padding: "10px 12px",
                          border: "1px solid var(--border)",
                          background: "var(--input)",
                          borderRadius: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: "var(--foreground)", fontWeight: 900 }}>{o.orderNumber}</div>
                          <div style={{ marginTop: 3, fontSize: 11, color: "var(--muted-foreground)" }}>
                            {fmtDateTime(o.createdAt)} · {o.productPreview}
                          </div>
                          {o.designNumber ? <div style={{ marginTop: 3, fontSize: 11, color: "var(--muted-foreground)" }}>מס׳ עיצוב: {o.designNumber}</div> : null}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--foreground-secondary)", fontWeight: 900, whiteSpace: "nowrap" }}>{fmtMoney(o.total)}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: "12px", color: "var(--muted-foreground)", fontSize: 13, background: "var(--input)", border: "1px solid var(--border)", borderRadius: 12 }}>
                      אין הזמנות עדיין.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ ...cardStyle, padding: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 900, color: "var(--foreground)" }}>מוצרים שנרכשו לאחרונה</div>
                <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {customer.recentlyPurchased.length ? customer.recentlyPurchased.map((x) => <Badge key={x} variant="muted">{x}</Badge>) : <Badge variant="muted">—</Badge>}
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
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              border: "1px solid rgba(201,169,110,0.35)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "12px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            סיום
          </button>
          <button
            type="button"
            onClick={onAddNote}
            style={{
              background: "var(--input)",
              color: "var(--foreground-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "12px",
              fontWeight: 900,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <MessageSquarePlus size={16} />
            הוספת הערה
          </button>
          <button
            type="button"
            onClick={() => {}}
            style={{
              background: "transparent",
              color: "var(--foreground-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "12px",
              fontWeight: 900,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Pencil size={16} />
            עריכה
          </button>
        </div>
      </aside>
    </>
  );
}

export function CustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCustomers = useCallback(
    async (silent?: boolean) => {
      if (!silent) setLoading(true);
      if (silent) setRefreshing(true);
      try {
        const out = await apiFetch<{ orders: any[] }>("/api/orders?limit=1000");
        const rows = Array.isArray(out?.orders) ? out.orders : [];
        const byCustomer = new Map<string, Customer>();
        for (const o of rows) {
          const customer = o?.customer ?? {};
          const email = String(customer.email ?? "").trim();
          const id = String(customer.id ?? email).trim();
          if (!id) continue;
          const displayEmail = email || "—";
          const createdAt = String(customer.createdAt ?? o.createdAt ?? new Date().toISOString());
          const fullName = String(customer.fullName ?? (email ? email.split("@")[0] : "לקוח") ?? "לקוח");
          const phone = String(customer.phone ?? "—");
          const total = Number(o.total ?? 0);
          const orderDate = String(o.createdAt ?? createdAt);
          const existing = byCustomer.get(id);
          const previewName = firstOrderLineProductName(o);
          const orderEntry: CustomerOrder = {
            id: String(o.id ?? `${id}-${orderDate}`),
            orderNumber: String(o.orderNumber ?? "—"),
            createdAt: orderDate,
            total,
            productPreview: previewName,
            designNumber: "—",
          };
          if (!existing) {
            byCustomer.set(id, {
              id,
              fullName,
              email: displayEmail,
              phone,
              joinedAt: createdAt,
              ordersCount: 1,
              totalSpend: total,
              lastOrderAt: orderDate,
              lastOrderProduct: previewName,
              status: "new",
              tags: [],
              savedDesigns: [],
              internalNote: "",
              addressPlaceholder: "—",
              recentOrders: [orderEntry],
              recentlyPurchased: [previewName],
            });
          } else {
            existing.ordersCount += 1;
            existing.totalSpend += total;
            if (!existing.lastOrderAt || new Date(orderDate).getTime() > new Date(existing.lastOrderAt).getTime()) {
              existing.lastOrderAt = orderDate;
              existing.lastOrderProduct = previewName;
            }
            existing.recentOrders.push(orderEntry);
            if (!existing.recentlyPurchased.includes(previewName)) existing.recentlyPurchased.push(previewName);
          }
        }
        const mapped = Array.from(byCustomer.values()).map((c) => {
          c.recentOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          if (c.ordersCount === 0) c.status = "no_orders";
          else if (c.ordersCount >= 2) c.status = "repeat";
          else c.status = "new";
          return c;
        });
        setCustomers(mapped);
      } catch (e: any) {
        setCustomers([]);
        if (e?.status === 503 && e?.error === "DATABASE_UNAVAILABLE") {
          toast("מסד הנתונים לא זמין — לא ניתן לטעון לקוחות מההזמנות.", "error");
        } else {
          toast("טעינת לקוחות נכשלה", "error");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadCustomers(false);
  }, [loadCustomers]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadCustomers(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadCustomers]);

  const now = Date.now();
  const monthAgo = now - 1000 * 60 * 60 * 24 * 30;

  const summary = useMemo(() => {
    const total = customers.length;
    const newThisMonth = customers.filter((c) => new Date(c.joinedAt).getTime() >= monthAgo).length;
    const repeat = customers.filter((c) => c.status === "repeat").length;
    const activeOrders = customers.filter((c) => c.ordersCount > 0 && c.lastOrderAt && new Date(c.lastOrderAt).getTime() >= monthAgo).length;
    const topSpenders = customers.filter((c) => c.totalSpend >= 1000).length;
    const avgOrders = total ? Math.round((customers.reduce((a, c) => a + c.ordersCount, 0) / total) * 10) / 10 : 0;
    return { total, newThisMonth, repeat, activeOrders, topSpenders, avgOrders };
  }, [customers, monthAgo]);

  // UI state
  const [segment, setSegment] = useState<"all" | "new" | "repeat" | "no_orders">("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "all">("all");
  const [spendRange, setSpendRange] = useState<"all" | "0-300" | "300-800" | "800-1500" | "1500+">("all");
  const [joinedPreset, setJoinedPreset] = useState<"all" | "30d" | "90d" | "year">("90d");
  const [ordersPreset, setOrdersPreset] = useState<"all" | "0" | "1-2" | "3-5" | "6+">("all");
  const [sortBy, setSortBy] = useState<"name" | "spend" | "last_order" | "joined">("spend");

  const [selected, setSelected] = useState<Customer | null>(null);

  const hasFilters =
    query.trim().length > 0 ||
    segment !== "all" ||
    statusFilter !== "all" ||
    spendRange !== "all" ||
    joinedPreset !== "90d" ||
    ordersPreset !== "all" ||
    sortBy !== "spend";

  function clearFilters() {
    setSegment("all");
    setQuery("");
    setStatusFilter("all");
    setSpendRange("all");
    setJoinedPreset("90d");
    setOrdersPreset("all");
    setSortBy("spend");
  }

  function matchesSpend(totalSpend: number) {
    if (spendRange === "all") return true;
    if (spendRange === "0-300") return totalSpend >= 0 && totalSpend < 300;
    if (spendRange === "300-800") return totalSpend >= 300 && totalSpend < 800;
    if (spendRange === "800-1500") return totalSpend >= 800 && totalSpend < 1500;
    return totalSpend >= 1500;
  }

  function matchesJoined(joinedAt: string) {
    if (joinedPreset === "all") return true;
    const t = new Date(joinedAt).getTime();
    const from = joinedPreset === "30d" ? now - 1000 * 60 * 60 * 24 * 30 : joinedPreset === "90d" ? now - 1000 * 60 * 60 * 24 * 90 : now - 1000 * 60 * 60 * 24 * 365;
    return t >= from;
  }

  function matchesOrders(ordersCount: number) {
    if (ordersPreset === "all") return true;
    if (ordersPreset === "0") return ordersCount === 0;
    if (ordersPreset === "1-2") return ordersCount >= 1 && ordersCount <= 2;
    if (ordersPreset === "3-5") return ordersCount >= 3 && ordersCount <= 5;
    return ordersCount >= 6;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const segOk = (c: Customer) => {
      if (segment === "all") return true;
      if (segment === "new") return c.status === "new";
      if (segment === "repeat") return c.status === "repeat";
      return c.status === "no_orders";
    };
    const statusOk = (c: Customer) => (statusFilter === "all" ? true : c.status === statusFilter);
    const queryOk = (c: Customer) =>
      !q || c.fullName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q);

    const arr = customers
      .filter((c) => segOk(c))
      .filter((c) => statusOk(c))
      .filter((c) => queryOk(c))
      .filter((c) => matchesSpend(c.totalSpend))
      .filter((c) => matchesJoined(c.joinedAt))
      .filter((c) => matchesOrders(c.ordersCount));

    arr.sort((a, b) => {
      if (sortBy === "name") return a.fullName.localeCompare(b.fullName, "he");
      if (sortBy === "joined") return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
      if (sortBy === "last_order") return (b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0) - (a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0);
      return b.totalSpend - a.totalSpend;
    });
    return arr;
  }, [customers, joinedPreset, now, ordersPreset, query, segment, sortBy, spendRange, statusFilter]);

  // pagination
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE), [filtered, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [joinedPreset, ordersPreset, query, segment, sortBy, spendRange, statusFilter]);

  const insights = useMemo(() => {
    const recentRepeat = customers.filter((c) => c.ordersCount >= 2 && c.lastOrderAt && new Date(c.lastOrderAt).getTime() >= monthAgo).slice(0, 6);
    return { recentRepeat };
  }, [customers, monthAgo]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "18px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 900, color: "var(--foreground)" }}>לקוחות</h1>
          <p style={{ fontSize: "13px", color: "var(--muted-foreground)", marginTop: "3px", lineHeight: 1.6 }}>
            תובנות לקוח מהירות: הוצאה מצטברת, פעילות הזמנות ועיצובים שמורים — UI בלבד (דמו).
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => loadCustomers(true)}
            disabled={refreshing}
            style={{
              background: "var(--input)",
              border: "1px solid var(--border)",
              color: "var(--foreground-secondary)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "12px",
              fontWeight: 900,
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
            onClick={() => toast("ייצוא לקוחות (placeholder)", "info")}
            style={{
              background: "var(--input)",
              border: "1px solid var(--border)",
              color: "var(--foreground-secondary)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "12px",
              fontWeight: 900,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <Download size={16} />
            ייצוא לקוחות
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px" }}>
        <SummaryCard title="סך לקוחות" value={String(summary.total)} hint="סה״כ במערכת" tone="muted" icon={UserRound} />
        <SummaryCard title="לקוחות חדשים החודש" value={String(summary.newThisMonth)} hint="30 ימים אחרונים" tone="info" icon={Calendar} />
        <SummaryCard title="לקוחות חוזרים" value={String(summary.repeat)} hint="כולל VIP" tone="primary" icon={Star} />
        <SummaryCard title="לקוחות עם הזמנות פעילות" value={String(summary.activeOrders)} hint="פעילות אחרונה" tone="warning" icon={Filter} />
        <SummaryCard title="לקוחות מובילים לפי הוצאה" value={String(summary.topSpenders)} hint="₪1,000+" tone="success" icon={Star} />
        <SummaryCard title="ממוצע הזמנות ללקוח" value={String(summary.avgOrders)} hint="דמו" tone="muted" icon={Filter} />
      </div>

      {loading ? (
        <div style={{ ...cardStyle, padding: "14px", color: "var(--muted-foreground)", fontSize: 13 }}>טוען לקוחות...</div>
      ) : null}

      {/* Segments */}
      <div style={{ ...cardStyle, padding: "12px 14px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <SegmentPill label="כל הלקוחות" active={segment === "all"} onClick={() => setSegment("all")} />
          <SegmentPill label="חדשים" active={segment === "new"} onClick={() => setSegment("new")} />
          <SegmentPill label="חוזרים" active={segment === "repeat"} onClick={() => setSegment("repeat")} />
          <SegmentPill label="ללא הזמנות" active={segment === "no_orders"} onClick={() => setSegment("no_orders")} />
        </div>
        <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>מציג {filtered.length.toLocaleString("he-IL")} לקוחות</div>
      </div>

      {/* Filters */}
      <div style={{ ...cardStyle, padding: "14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr auto", gap: "10px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם / אימייל / טלפון"
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
              color: "var(--foreground)",
              outline: "none",
              fontSize: "13px",
              appearance: "none",
            }}
            aria-label="סטטוס לקוח"
          >
            <option value="all">כל הסטטוסים</option>
            <option value="new">חדש</option>
            <option value="repeat">חוזר</option>
            <option value="no_orders">ללא הזמנות</option>
            <option value="inactive">לא פעיל</option>
          </select>

          <select
            value={spendRange}
            onChange={(e) => setSpendRange(e.target.value as any)}
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
            aria-label="טווח הוצאה"
          >
            <option value="all">טווח הוצאה</option>
            <option value="0-300">₪0–₪300</option>
            <option value="300-800">₪300–₪800</option>
            <option value="800-1500">₪800–₪1,500</option>
            <option value="1500+">₪1,500+</option>
          </select>

          <select
            value={joinedPreset}
            onChange={(e) => setJoinedPreset(e.target.value as any)}
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
            aria-label="תאריך הצטרפות"
          >
            <option value="all">כל הזמן</option>
            <option value="30d">30 ימים</option>
            <option value="90d">90 ימים</option>
            <option value="year">שנה</option>
          </select>

          <select
            value={ordersPreset}
            onChange={(e) => setOrdersPreset(e.target.value as any)}
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
            aria-label="מספר הזמנות"
          >
            <option value="all">מס׳ הזמנות</option>
            <option value="0">0</option>
            <option value="1-2">1–2</option>
            <option value="3-5">3–5</option>
            <option value="6+">6+</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
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
            aria-label="מיון"
          >
            <option value="name">מיון: לפי שם</option>
            <option value="spend">מיון: לפי הוצאה</option>
            <option value="last_order">מיון: לפי הזמנה אחרונה</option>
            <option value="joined">מיון: לפי תאריך הצטרפות</option>
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
          <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>פילטר תגיות: Placeholder</div>
          {hasFilters ? (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {segment !== "all" ? <Badge variant="muted">סגמנט: {segment === "new" ? "חדשים" : segment === "repeat" ? "חוזרים" : "ללא הזמנות"}</Badge> : null}
              {statusFilter !== "all" ? <Badge variant="muted">סטטוס: {statusLabel(statusFilter as CustomerStatus)}</Badge> : null}
              {spendRange !== "all" ? <Badge variant="muted">הוצאה: {spendRange}</Badge> : null}
              {joinedPreset !== "90d" ? <Badge variant="muted">הצטרפות: {joinedPreset}</Badge> : null}
              {ordersPreset !== "all" ? <Badge variant="muted">הזמנות: {ordersPreset}</Badge> : null}
              {query.trim() ? <Badge variant="muted">חיפוש: {query.trim()}</Badge> : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Table + insights */}
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: "16px", alignItems: "start" }}>
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 900, color: "var(--foreground)" }}>רשימת לקוחות</div>
              <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "2px" }}>לחץ על שורה לצפייה בפרטי הלקוח.</div>
            </div>
            <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>UI בלבד</div>
          </div>

          {customers.length === 0 ? (
            <div style={{ padding: "24px" }}>
              <div style={{ ...cardStyle, padding: "20px", background: "var(--card)" }}>
                <div style={{ fontSize: "14px", fontWeight: 900, color: "var(--foreground)" }}>אין לקוחות כרגע</div>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "24px" }}>
              <div style={{ ...cardStyle, padding: "20px", background: "var(--card)" }}>
                <div style={{ fontSize: "14px", fontWeight: 900, color: "var(--foreground)" }}>אין תוצאות</div>
                <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "6px", lineHeight: 1.6 }}>
                  אין לקוחות להצגה עבור המסננים שנבחרו.
                </div>
                <div style={{ marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={clearFilters}
                    style={{
                      background: "var(--input)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground-secondary)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      fontSize: "12px",
                      fontWeight: 900,
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
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1180 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    {[
                      "לקוח",
                      "אימייל",
                      "טלפון",
                      "תאריך הצטרפות",
                      "מספר הזמנות",
                      "סך הוצאה",
                      "הזמנה אחרונה",
                      "סטטוס לקוח",
                      "תגיות",
                      "פעולות",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "right",
                          padding: "12px 14px",
                          fontSize: "11px",
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
                      onClick={() => setSelected(c)}
                      style={{ cursor: "pointer", background: "transparent" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                    >
                      <td style={{ padding: "13px 14px", minWidth: 220 }}>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 12,
                              background: "rgba(201,169,110,0.12)",
                              border: "1px solid rgba(201,169,110,0.25)",
                              color: "var(--primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 900,
                              flexShrink: 0,
                            }}
                            aria-label="אוואטר"
                          >
                            {initials(c.fullName)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {c.fullName}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                              CLV: <span style={{ color: "var(--foreground-secondary)", fontWeight: 900 }}>{fmtMoney(c.totalSpend)}</span> · שמורים:{" "}
                              <span style={{ color: "var(--foreground-secondary)", fontWeight: 900 }}>{c.savedDesigns.length}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "13px 14px", fontSize: 12, color: "var(--foreground-secondary)", whiteSpace: "nowrap" }}>{c.email}</td>
                      <td style={{ padding: "13px 14px", fontSize: 12, color: "var(--foreground-secondary)", whiteSpace: "nowrap" }}>{c.phone}</td>
                      <td style={{ padding: "13px 14px", fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{fmtDate(c.joinedAt)}</td>
                      <td style={{ padding: "13px 14px", fontSize: 12, color: "var(--foreground-secondary)", fontWeight: 900, whiteSpace: "nowrap" }}>{c.ordersCount}</td>
                      <td style={{ padding: "13px 14px", fontSize: 12, color: "var(--foreground-secondary)", fontWeight: 900, whiteSpace: "nowrap" }}>{fmtMoney(c.totalSpend)}</td>
                      <td style={{ padding: "13px 14px", fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                        {c.lastOrderAt ? fmtDate(c.lastOrderAt) : "—"}
                        {c.lastOrderProduct ? <div style={{ marginTop: 3, fontSize: 11, color: "var(--muted-foreground)" }}>{c.lastOrderProduct}</div> : null}
                      </td>
                      <td style={{ padding: "13px 14px", whiteSpace: "nowrap" }}>{statusBadge(c.status)}</td>
                      <td style={{ padding: "13px 14px", minWidth: 220 }}>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {c.tags.slice(0, 3).map((t) => (
                            <Badge key={t} variant="muted">
                              {t}
                            </Badge>
                          ))}
                          {c.tags.length > 3 ? <Badge variant="muted">+{c.tags.length - 3}</Badge> : null}
                        </div>
                      </td>
                      <td style={{ padding: "13px 14px" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => setSelected(c)}
                            style={{
                              background: "var(--input)",
                              border: "1px solid var(--border)",
                              color: "var(--foreground-secondary)",
                              borderRadius: "10px",
                              padding: "8px 10px",
                              fontSize: "12px",
                              fontWeight: 900,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Eye size={16} />
                            צפייה
                          </button>
                          <button
                            type="button"
                            onClick={() => toast("עריכת לקוח (placeholder)", "info")}
                            style={{
                              background: "transparent",
                              border: "1px solid var(--border)",
                              color: "var(--foreground-secondary)",
                              borderRadius: "10px",
                              padding: "8px 10px",
                              fontSize: "12px",
                              fontWeight: 900,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Pencil size={16} />
                            עריכה
                          </button>
                          <button
                            type="button"
                            onClick={() => toast("הוספת הערה (placeholder)", "success")}
                            style={{
                              background: "var(--primary)",
                              border: "1px solid rgba(201,169,110,0.35)",
                              color: "var(--primary-foreground)",
                              borderRadius: "10px",
                              padding: "8px 10px",
                              fontSize: "12px",
                              fontWeight: 900,
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
          {filtered.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                עמוד {page.toLocaleString("he-IL")} מתוך {pageCount.toLocaleString("he-IL")}
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{
                    background: "var(--input)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground-secondary)",
                    borderRadius: "10px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    fontWeight: 900,
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
                        type="button"
                        onClick={() => setPage(n)}
                        style={{
                          width: "34px",
                          height: "34px",
                          borderRadius: "10px",
                          background: active ? "rgba(201,169,110,0.15)" : "var(--input)",
                          border: active ? "1px solid rgba(201,169,110,0.35)" : "1px solid var(--border)",
                          color: active ? "var(--primary)" : "var(--foreground-secondary)",
                          fontWeight: 900,
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
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                  style={{
                    background: "var(--input)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground-secondary)",
                    borderRadius: "10px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    fontWeight: 900,
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
          )}
        </div>

        {/* Insights */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ ...cardStyle, padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 900, color: "var(--foreground)" }}>תובנות מהירות</div>
              <Badge variant="muted">דמו</Badge>
            </div>

            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "var(--foreground)" }}>לקוחות עם הזמנה חוזרת לאחרונה</div>
                  <Badge variant="success">{insights.recentRepeat.length}</Badge>
                </div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {insights.recentRepeat.length ? (
                    insights.recentRepeat.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelected(c)}
                        style={{
                          background: "transparent",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          padding: "10px 10px",
                          textAlign: "right",
                          cursor: "pointer",
                          color: "var(--foreground-secondary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 900, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.fullName}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{fmtMoney(c.totalSpend)}</span>
                      </button>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>אין פריטים להצגה.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, padding: "14px" }}>
            <div style={{ fontSize: "13px", fontWeight: 900, color: "var(--foreground)" }}>טיפ מהיר</div>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
              בדמו ניתן לזהות מהר לקוחות עם עיצובים שמורים ללא הזמנה — הם יעד מצוין להודעת וואטסאפ/מייל (בעתיד, אחרי חיבור מערכת).
            </div>
          </div>
        </div>
      </div>

      <Drawer
        open={Boolean(selected)}
        customer={selected}
        onClose={() => setSelected(null)}
        onAddNote={() => toast("הוספת הערה (placeholder)", "success")}
      />
      <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </div>
  );
}

