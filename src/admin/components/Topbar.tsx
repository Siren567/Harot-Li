"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, ChevronDown, LogOut, User, Bell, AlertTriangle, ShoppingBag, X } from "lucide-react";
import { useToast } from "../ui/toast";
import { clearAdminAuth } from "../state/auth";
import { apiFetch } from "../lib/api";

type NotificationItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  kind: "order" | "stock";
  createdAt: string;
};

type DashboardPayload = {
  recentOrders?: Array<{ id: string; orderNumber: string; customer: string; createdAt: string }>;
  stockAlerts?: Array<{ id: string; name: string; sku: string; qty: number; kind: "out" | "low" }>;
};

const DISMISSED_NOTIFS_KEY = "harotli_admin_dismissed_notification_ids_v1";
const MAX_DISMISSED_IDS = 400;

function readDismissedNotificationIds(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISMISSED_NOTIFS_KEY) || "[]");
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function addDismissedNotificationIds(ids: Iterable<string>) {
  const merged = readDismissedNotificationIds();
  for (const id of ids) merged.add(id);
  const arr = [...merged].slice(-MAX_DISMISSED_IDS);
  try {
    localStorage.setItem(DISMISSED_NOTIFS_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export function Topbar() {
  const toast = useToast();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const prevStockKeysRef = useRef<Set<string>>(new Set());
  const seenKey = "harotli_admin_seen_notifications_v1";

  const recomputeUnread = useCallback((items: NotificationItem[]) => {
    let seenIds = new Set<string>();
    try {
      const parsed = JSON.parse(localStorage.getItem(seenKey) || "[]");
      if (Array.isArray(parsed)) seenIds = new Set(parsed.filter((x): x is string => typeof x === "string"));
    } catch {
      // ignore
    }
    setUnreadCount(items.filter((n) => !seenIds.has(n.id)).length);
  }, [seenKey]);

  const markAllSeen = useCallback(() => {
    const ids = notifications.map((n) => n.id);
    try {
      localStorage.setItem(seenKey, JSON.stringify(ids));
    } catch {
      // ignore storage failures
    }
    setUnreadCount(0);
  }, [notifications]);

  const loadNotifications = useCallback(async (silent?: boolean) => {
    try {
      const out = await apiFetch<DashboardPayload>("/api/orders/dashboard");
      const recentOrders = Array.isArray(out?.recentOrders) ? out.recentOrders : [];
      const stockAlerts = Array.isArray(out?.stockAlerts) ? out.stockAlerts : [];

      const orderItems: NotificationItem[] = recentOrders.slice(0, 6).map((o) => ({
        id: `order:${o.id}`,
        title: `הזמנה חדשה ${o.orderNumber}`,
        subtitle: `${o.customer || "לקוח"} · ${new Date(o.createdAt).toLocaleString("he-IL")}`,
        href: `/admin/orders?order=${encodeURIComponent(o.id)}&q=${encodeURIComponent(o.orderNumber)}`,
        kind: "order",
        createdAt: o.createdAt,
      }));

      const stockItems: NotificationItem[] = stockAlerts.slice(0, 8).map((s) => ({
        id: `stock:${s.id}:${s.kind}`,
        title: s.kind === "out" ? `אזל מלאי: ${s.name}` : `מלאי נמוך: ${s.name}`,
        subtitle: `${s.sku || "וריאציה"} · כמות ${s.qty}`,
        href: "/admin/inventory",
        kind: "stock",
        createdAt: new Date().toISOString(),
      }));

      const next = [...orderItems, ...stockItems]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 12);
      const dismissed = readDismissedNotificationIds();
      const visible = next.filter((n) => !dismissed.has(n.id));
      setNotifications(visible);

      const currentOrderIds = new Set(orderItems.map((x) => x.id));
      const currentStockKeys = new Set(stockItems.map((x) => x.id));
      const hasNewOrders = Array.from(currentOrderIds).some((id) => !prevOrderIdsRef.current.has(id));
      const hasNewStock = Array.from(currentStockKeys).some((id) => !prevStockKeysRef.current.has(id));
      prevOrderIdsRef.current = currentOrderIds;
      prevStockKeysRef.current = currentStockKeys;

      let seenIds = new Set<string>();
      try {
        const parsed = JSON.parse(localStorage.getItem(seenKey) || "[]");
        if (Array.isArray(parsed)) seenIds = new Set(parsed.filter((x): x is string => typeof x === "string"));
      } catch {
        // ignore parse failures
      }
      const unread = visible.filter((n) => !seenIds.has(n.id)).length;
      setUnreadCount(unread);

      if (!silent && (hasNewOrders || hasNewStock)) {
        toast("יש התראות חדשות", "info");
      }
    } catch {
      // keep bell quiet on transient failures
    }
  }, [toast]);

  function dismissNotification(id: string) {
    addDismissedNotificationIds([id]);
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      recomputeUnread(next);
      return next;
    });
  }

  function dismissAllNotifications() {
    if (notifications.length === 0) return;
    addDismissedNotificationIds(notifications.map((n) => n.id));
    setNotifications([]);
    setUnreadCount(0);
    try {
      localStorage.setItem(seenKey, JSON.stringify([]));
    } catch {
      // ignore
    }
  }

  function restoreDismissedNotifications() {
    try {
      localStorage.removeItem(DISMISSED_NOTIFS_KEY);
    } catch {
      // ignore
    }
    void loadNotifications(true);
  }

  const orderedNotifications = useMemo(() => notifications, [notifications]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let mounted = true;
    void loadNotifications(true);
    const timer = window.setInterval(() => {
      if (!mounted || document.visibilityState !== "visible") return;
      void loadNotifications(true);
    }, 25_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [loadNotifications]);

  function handleLogout() {
    clearAdminAuth();
    toast("התנתקת בהצלחה", "success");
    window.location.assign("/admin/login");
  }

  return (
    <header
      style={{
        height: "var(--topbar-height)",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        paddingInline: "24px",
        gap: "12px",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ flex: 1 }}>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "var(--input)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "7px 11px",
            color: "var(--foreground-secondary)",
            textDecoration: "none",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          <ExternalLink size={13} />
          חזרה לאתר
        </a>
      </div>

      <div style={{ position: "relative" }}>
        <button
          onClick={() => {
            setNotificationsOpen((v) => !v);
            setProfileOpen(false);
            if (!notificationsOpen) markAllSeen();
          }}
          style={{
            position: "relative",
            width: 36,
            height: 36,
            borderRadius: 10,
            background: notificationsOpen ? "var(--input)" : "transparent",
            border: "1px solid",
            borderColor: notificationsOpen ? "var(--border)" : "transparent",
            color: "var(--foreground-secondary)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          aria-label="התראות"
        >
          <Bell size={18} />
          {unreadCount > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -3,
                left: -3,
                minWidth: 18,
                height: 18,
                borderRadius: 999,
                background: "var(--destructive)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 900,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                paddingInline: 5,
                border: "2px solid var(--surface)",
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>

        {notificationsOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setNotificationsOpen(false)} />
            <div
              style={{
                position: "absolute",
                top: "44px",
                left: "0",
                width: "min(420px, calc(100vw - 24px))",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
                zIndex: 200,
                overflow: "hidden",
                animation: "fadeInDown 0.15s ease",
              }}
            >
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--foreground)" }}>התראות</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {orderedNotifications.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => dismissAllNotifications()}
                      style={{ background: "transparent", border: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                    >
                      נקה רשימה
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void loadNotifications(false)}
                    style={{ background: "transparent", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                  >
                    רענון
                  </button>
                </div>
              </div>
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {orderedNotifications.length === 0 ? (
                  <div style={{ padding: "14px 12px", fontSize: 12, color: "var(--muted-foreground)" }}>אין התראות כרגע.</div>
                ) : (
                  orderedNotifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "flex-start",
                        padding: "8px 8px 8px 12px",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <a
                        href={n.href}
                        onClick={() => setNotificationsOpen(false)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          padding: "2px 0",
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <span style={{ color: n.kind === "order" ? "var(--info)" : "var(--warning)", marginTop: 2, flexShrink: 0 }}>
                          {n.kind === "order" ? <ShoppingBag size={16} /> : <AlertTriangle size={16} />}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--foreground)" }}>{n.title}</div>
                          <div style={{ marginTop: 2, fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {n.subtitle}
                          </div>
                        </span>
                      </a>
                      <button
                        type="button"
                        aria-label="הסר מהרשימה"
                        title="הסר מהרשימה (נשאר במערכת — רק מוסתר כאן)"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dismissNotification(n.id);
                        }}
                        style={{
                          flexShrink: 0,
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "var(--input)",
                          color: "var(--muted-foreground)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 1,
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                <button
                  type="button"
                  onClick={() => restoreDismissedNotifications()}
                  style={{ background: "transparent", border: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 11, fontWeight: 600, width: "100%", textAlign: "center" }}
                >
                  הצג התראות שהוסרו מהרשימה
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <button
          onClick={() => {
            setProfileOpen((v) => !v);
            setNotificationsOpen(false);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: profileOpen ? "var(--input)" : "transparent",
            border: "1px solid",
            borderColor: profileOpen ? "var(--border)" : "transparent",
            borderRadius: "8px",
            padding: "6px 10px",
            cursor: "pointer",
            color: "var(--foreground-secondary)",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          <User size={16} style={{ color: "var(--muted-foreground)" }} />
          admin
          <ChevronDown size={14} style={{ color: "var(--muted-foreground)" }} />
        </button>

        {profileOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setProfileOpen(false)} />
            <div
              style={{
                position: "absolute",
                top: "44px",
                left: "0",
                width: "220px",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
                zIndex: 200,
                overflow: "hidden",
                animation: "fadeInDown 0.15s ease",
              }}
            >
              <button
                onClick={handleLogout}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  color: "var(--foreground-secondary)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  textAlign: "right",
                }}
              >
                <LogOut size={16} style={{ color: "var(--muted-foreground)" }} />
                התנתק
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeInDown { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </header>
  );
}

