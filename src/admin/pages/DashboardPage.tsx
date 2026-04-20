import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Receipt,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MousePointerClick,
  Percent,
  RefreshCw,
  RotateCcw,
  Timer,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { apiFetch } from "../lib/api";

type OrderStatusKey = "new" | "processing" | "shipped" | "completed" | "cancelled";
type PaymentStatusKey = "paid" | "unpaid";

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<"orders" | "visits" | "newCustomers" | "revenue">("orders");
  const [snapshot, setSnapshot] = useState<{
    stats: {
      totalRevenue: number;
      totalOrders: number;
      newCustomers: number;
      avgOrderValue: number;
      siteVisits: number;
      siteVisitsTrendPercent: number;
      conversionRatePercent: number;
      conversionRateTrendPercent: number;
      returningCustomersRatePercent: number;
      returningCustomersTrendPercent: number;
      avgSessionSeconds: number;
      avgSessionTrendPercent: number;
      pendingOrders: number;
      completedOrders: number;
      lowStockProducts: number;
      cancelledOrders: number;
      topProducts: Array<{ name: string; sales: number }>;
      customersWithoutOrders?: number;
    };
    revenueTrendPercent: number;
    chartMonthLabel: string;
    dailyRevenue: Array<{ date: string; total: number }>;
    dailyOrders: Array<{ date: string; total: number }>;
    dailySiteVisits: Array<{ date: string; total: number }>;
    dailyNewCustomers: Array<{ date: string; total: number }>;
    recentOrders: Array<{
      id: string;
      orderNumber: string;
      customer: string;
      total: number;
      status: OrderStatusKey;
      payment: PaymentStatusKey;
      design: string;
      createdAt: string;
    }>;
    stockAlerts: Array<{ id: string; name: string; sku: string; qty: number; kind: "out" | "low" }>;
  } | null>(null);

  const loadDashboard = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    setLoadError(null);
    try {
      const out = await apiFetch<any>("/api/orders/dashboard");
      setSnapshot(out);
    } catch (e: any) {
      setSnapshot(null);
      if (e?.status === 401) {
        setLoadError("נדרשת התחברות מחדש לאדמין.");
      } else if (e?.status === 0 || e?.error === "FETCH_TIMEOUT" || e?.error === "FETCH_ERROR") {
        setLoadError("לא ניתן להגיע לשרת. בדקו חיבור לרשת או שהבקאנד זמין (בפיתוח מקומי: הרצת backend).");
      } else {
        setLoadError("לא ניתן לטעון את נתוני הדאשבורד בזמן אמת.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadDashboard(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadDashboard]);

  const stats = snapshot?.stats ?? {
    totalRevenue: 0,
    totalOrders: 0,
    newCustomers: 0,
    avgOrderValue: 0,
    siteVisits: 0,
    siteVisitsTrendPercent: 0,
    conversionRatePercent: 0,
    conversionRateTrendPercent: 0,
    returningCustomersRatePercent: 0,
    returningCustomersTrendPercent: 0,
    avgSessionSeconds: 0,
    avgSessionTrendPercent: 0,
    pendingOrders: 0,
    completedOrders: 0,
    lowStockProducts: 0,
    cancelledOrders: 0,
    topProducts: [],
    customersWithoutOrders: 0,
  };
  const recentOrders = snapshot?.recentOrders ?? [];
  const stockAlerts = snapshot?.stockAlerts ?? [];
  const revenueTrendPercent = snapshot?.revenueTrendPercent ?? 0;
  const chartMonthLabel = snapshot?.chartMonthLabel ?? "";
  const outOfStock = stockAlerts.filter((s) => s.kind === "out");
  const lowStock = stockAlerts.filter((s) => s.kind === "low");

  const fmtMoney = (v: number) => `₪${Number(v || 0).toLocaleString("he-IL")}`;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const EMPTY_MSG = "אין כרגע נתונים";

  function payBadge(key: PaymentStatusKey) {
    return key === "paid" ? <Badge variant="success">שולם</Badge> : <Badge variant="warning">ממתין לתשלום</Badge>;
  }
  function statusBadge(key: OrderStatusKey) {
    if (key === "completed") return <Badge variant="success">הושלם</Badge>;
    if (key === "shipped") return <Badge variant="info">נשלח</Badge>;
    if (key === "processing") return <Badge variant="default">בטיפול</Badge>;
    if (key === "cancelled") return <Badge variant="error">בוטל</Badge>;
    return <Badge variant="info">התקבלה</Badge>;
  }

  function KpiCard({
    label,
    value,
    sub,
    icon: Icon,
    iconColor,
    href,
    subColor,
  }: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    iconColor: string;
    href?: string;
    subColor?: string;
  }) {
    const card = (
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          transition: "border-color 0.15s, transform 0.15s",
          cursor: href ? "pointer" : "default",
        }}
        onMouseEnter={(e) => {
          if (!href) return;
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          if (!href) return;
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              background: `${iconColor}18`,
              border: `1px solid ${iconColor}30`,
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: iconColor,
            }}
          >
            <Icon size={18} />
          </div>
          {sub && <div style={{ fontSize: "11px", color: subColor ?? "var(--primary)", fontWeight: 600 }}>{sub}</div>}
        </div>
        <div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--foreground)", lineHeight: 1.1 }}>{value}</div>
          <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "4px" }}>{label}</div>
        </div>
      </div>
    );

    if (!href) return card;
    return (
      <a href={href} style={{ textDecoration: "none" }}>
        {card}
      </a>
    );
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "20px",
  };

  const sectionCard: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "24px",
  };

  const tdStyle: React.CSSProperties = {
    padding: "13px 14px",
    fontSize: "13px",
    verticalAlign: "middle",
    color: "var(--foreground-secondary)",
  };

  const fmtSignedPercent = (v: number) => {
    const n = Number(v || 0);
    const sign = n > 0 ? "+" : "";
    return `${sign}${n}%`;
  };

  const fmtDuration = (seconds: number) => {
    const s = Math.max(0, Math.round(Number(seconds || 0)));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  const chartConfigs = useMemo(
    () => [
      {
        key: "orders" as const,
        label: "הזמנות",
        description: `${chartMonthLabel || "30 ימים אחרונים"} · כמות הזמנות לפי יום`,
        series: snapshot?.dailyOrders?.map((d) => Number(d.total || 0)) ?? [],
      },
      {
        key: "visits" as const,
        label: "כניסות לאתר",
        description: `${chartMonthLabel || "30 ימים אחרונים"} · כניסות יומיות לאתר`,
        series: snapshot?.dailySiteVisits?.map((d) => Number(d.total || 0)) ?? [],
      },
      {
        key: "newCustomers" as const,
        label: "לקוחות חדשים",
        description: `${chartMonthLabel || "30 ימים אחרונים"} · לקוחות שנרשמו בכל יום`,
        series: snapshot?.dailyNewCustomers?.map((d) => Number(d.total || 0)) ?? [],
      },
      {
        key: "revenue" as const,
        label: "הכנסות",
        description: `${chartMonthLabel || "30 ימים אחרונים"} · הכנסות לפי יום`,
        series: snapshot?.dailyRevenue?.map((d) => Number(d.total || 0)) ?? [],
      },
    ],
    [snapshot, chartMonthLabel]
  );
  const selectedChart = chartConfigs.find((c) => c.key === activeChart) ?? chartConfigs[0];
  const chartSeries = selectedChart.series.length > 0 ? selectedChart.series : [0, 0, 0, 0, 0, 0, 0];
  const maxPoint = Math.max(...chartSeries, 0);
  const hasRevenueData = maxPoint > 0;
  const chartPath = chartSeries
    .map((v, i) => {
      const x = (i / (chartSeries.length - 1)) * 100;
      const y = hasRevenueData ? 100 - (v / maxPoint) * 100 : 100;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)" }}>לוח בקרה</h1>
          <p style={{ fontSize: "13px", color: "var(--muted-foreground)", marginTop: "4px" }}>
            {loading ? "טוען נתונים..." : "תמונת מצב מהירה: הכנסות, הזמנות, מלאי ומוצרים מובילים."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadDashboard(true)}
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
      </div>
      {loadError ? (
        <div style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)", color: "var(--foreground)", borderRadius: "10px", padding: "10px 12px", fontSize: "12px", fontWeight: 600 }}>
          {loadError}
        </div>
      ) : null}

      {/* KPI row (like old dashboard) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
        <KpiCard
          label="סך ההכנסות"
          value={fmtMoney(stats.totalRevenue)}
          sub={revenueTrendPercent ? `${revenueTrendPercent}%+ מהחודש שעבר` : undefined}
          icon={TrendingUp}
          iconColor="var(--success)"
        />
        <KpiCard
          label="מספר הזמנות"
          value={String(stats.totalOrders)}
          sub={stats.totalOrders > 0 ? `${stats.pendingOrders} ממתינות` : undefined}
          icon={ShoppingBag}
          iconColor="var(--info)"
          href="#/admin/orders"
        />
        <KpiCard
          label="לקוחות חדשים"
          value={String(stats.newCustomers)}
          sub="30 ימים אחרונים"
          icon={Users}
          iconColor="var(--primary)"
          href="#/admin/customers"
        />
        <KpiCard
          label="ערך הזמנה ממוצע"
          value={fmtMoney(stats.avgOrderValue)}
          sub={chartMonthLabel}
          icon={Receipt}
          iconColor="var(--primary)"
        />
      </div>

      {/* Website stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
        <KpiCard
          label="כניסות לאתר"
          value={Number(stats.siteVisits || 0).toLocaleString("he-IL")}
          sub={`${fmtSignedPercent(stats.siteVisitsTrendPercent)} מהחודש שעבר`}
          subColor={stats.siteVisitsTrendPercent >= 0 ? "var(--success)" : "var(--destructive)"}
          icon={MousePointerClick}
          iconColor="var(--info)"
        />
        <KpiCard
          label="שיעור המרה"
          value={`${Number(stats.conversionRatePercent || 0).toLocaleString("he-IL")}%`}
          sub={`${fmtSignedPercent(stats.conversionRateTrendPercent)} מהחודש שעבר`}
          subColor={stats.conversionRateTrendPercent >= 0 ? "var(--success)" : "var(--destructive)"}
          icon={Percent}
          iconColor="var(--success)"
        />
        <KpiCard
          label="לקוחות חוזרים"
          value={`${Number(stats.returningCustomersRatePercent || 0).toLocaleString("he-IL")}%`}
          sub={`${fmtSignedPercent(stats.returningCustomersTrendPercent)} מהחודש שעבר`}
          subColor={stats.returningCustomersTrendPercent >= 0 ? "var(--success)" : "var(--destructive)"}
          icon={RotateCcw}
          iconColor="var(--primary)"
        />
        <KpiCard
          label="זמן שהייה ממוצע"
          value={fmtDuration(stats.avgSessionSeconds)}
          sub={`${fmtSignedPercent(stats.avgSessionTrendPercent)} מהחודש שעבר`}
          subColor={stats.avgSessionTrendPercent >= 0 ? "var(--success)" : "var(--destructive)"}
          icon={Timer}
          iconColor="var(--warning)"
        />
      </div>

      {/* Secondary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
        {[
          { label: "ממתינות", value: stats.pendingOrders, icon: AlertTriangle, color: "var(--warning)" },
          { label: "הושלמו", value: stats.completedOrders, icon: CheckCircle2, color: "var(--success)" },
          { label: "מוצרי מלאי נמוך", value: stats.lowStockProducts, icon: AlertTriangle, color: "var(--warning)" },
          { label: "בוטלו", value: stats.cancelledOrders, icon: XCircle, color: "var(--destructive)" },
        ].map((s) => (
          <div key={s.label} style={{ ...cardStyle, padding: "18px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: `${s.color}18`,
                border: `1px solid ${s.color}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: s.color,
                flexShrink: 0,
              }}
            >
              <s.icon size={18} />
            </div>
            <div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "4px" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts + Top products (lightweight, same card style) */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
        <div style={sectionCard}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)", marginBottom: "6px" }}>סקירת מדדים</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
            {chartConfigs.map((chart) => (
              <button
                key={chart.key}
                type="button"
                onClick={() => setActiveChart(chart.key)}
                style={{
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "999px",
                  background: activeChart === chart.key ? "rgba(201,169,110,0.16)" : "var(--surface)",
                  color: activeChart === chart.key ? "var(--foreground)" : "var(--muted-foreground)",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {chart.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "6px", lineHeight: 1.5 }}>
            {selectedChart.description}
          </p>
          <div style={{ marginTop: "16px", height: "240px", borderRadius: "12px", border: "1px solid var(--border-subtle)", background: "var(--surface)", padding: "12px" }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
              <defs>
                <linearGradient id="revenue-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(201,169,110,0.35)" />
                  <stop offset="100%" stopColor="rgba(201,169,110,0.02)" />
                </linearGradient>
              </defs>
              {[20, 40, 60, 80].map((g) => (
                <line key={g} x1="0" y1={g} x2="100" y2={g} stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
              ))}
              <path d={`${chartPath} L 100 100 L 0 100 Z`} fill="url(#revenue-gradient)" />
              <path d={chartPath} fill="none" stroke="var(--primary)" strokeWidth="1.8" />
            </svg>
          </div>
        </div>
        <div style={sectionCard}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)", marginBottom: "16px" }}>מוצרים מובילים</h3>
          {stats.topProducts.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--muted-foreground)", padding: "48px 0", textAlign: "center" }}>{EMPTY_MSG}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {stats.topProducts.slice(0, 5).map((p) => (
                <div
                  key={p.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--surface)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "3px" }}>מכירות: {p.sales}</div>
                  </div>
                  <Badge variant="muted">Top</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders + Stock alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: 600 }}>הזמנות אחרונות</h3>
            <a
              href="#/admin/orders"
              style={{
                fontSize: "12px",
                color: "var(--primary)",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
              }}
            >
              הכל <ArrowUpRight size={12} />
            </a>
          </div>
          {recentOrders.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--muted-foreground)", padding: "32px 24px", textAlign: "center" }}>{EMPTY_MSG}</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface)" }}>
                  {["הזמנה", "לקוח", "סכום", "תשלום", "סטטוס", "עיצוב", "תאריך"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 20px",
                        textAlign: "right",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--muted-foreground)",
                        letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o, i) => (
                  <tr key={o.id} style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}>
                    <td style={tdStyle}><strong style={{ color: "var(--foreground)" }}>{o.orderNumber}</strong></td>
                    <td style={tdStyle}>{o.customer}</td>
                    <td style={tdStyle}>{fmtMoney(o.total)}</td>
                    <td style={tdStyle}>{payBadge(o.payment)}</td>
                    <td style={tdStyle}>{statusBadge(o.status)}</td>
                    <td style={tdStyle}>{o.design}</td>
                    <td style={tdStyle}>{fmtDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
          <div
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: 600 }}>התראות מלאי</h3>
            <a
              href="#/admin/inventory"
              style={{
                fontSize: "12px",
                color: "var(--primary)",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
              }}
            >
              מלאי <ArrowUpRight size={12} />
            </a>
          </div>

          <div style={{ padding: "8px" }}>
            {stockAlerts.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--muted-foreground)", padding: "24px 12px", textAlign: "center" }}>{EMPTY_MSG}</p>
            ) : (
              <>
                {outOfStock.length > 0 && (
                  <>
                    <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--destructive)", padding: "8px 10px 4px", letterSpacing: "0.06em" }}>
                      אזל המלאי
                    </p>
                    {outOfStock.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "rgba(239,68,68,0.05)",
                          marginBottom: "4px",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px" }}>{p.sku}</div>
                        </div>
                        <Badge variant="error">0</Badge>
                      </div>
                    ))}
                  </>
                )}
                {lowStock.length > 0 && (
                  <>
                    <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--warning)", padding: "10px 10px 4px", letterSpacing: "0.06em" }}>
                      מלאי נמוך
                    </p>
                    {lowStock.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "rgba(245,158,11,0.06)",
                          marginBottom: "4px",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px" }}>{p.sku}</div>
                        </div>
                        <Badge variant="warning">{p.qty}</Badge>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </div>
  );
}

