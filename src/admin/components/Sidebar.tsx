"use client";

import {
  LayoutDashboard,
  LayoutTemplate,
  ShoppingBag,
  Package,
  Boxes,
  Tag,
  Users,
  Ticket,
  Gem,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "לוח בקרה", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "מוצרים", icon: Package },
  { href: "/admin/inventory", label: "מלאי", icon: Boxes },
  { href: "/admin/customers", label: "לקוחות", icon: Users },
  { href: "/admin/orders", label: "הזמנות", icon: ShoppingBag },
  { href: "/admin/discounts", label: "החנות וקופונים", icon: Ticket },
  { href: "/admin/categories", label: "קטגוריות", icon: Tag },
  { href: "/admin/homepage", label: "דף הבית", icon: LayoutTemplate },
];

export function Sidebar() {
  const pathname = window.location.pathname || "/";

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside
      style={{
        width: "var(--sidebar-width)",
        minHeight: "100svh",
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          height: "var(--topbar-height)",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          borderBottom: "1px solid var(--border)",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            background: "linear-gradient(135deg, var(--primary), #a07840)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Gem size={16} color="#09090b" />
        </div>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--foreground)", lineHeight: 1.2 }}>חרוטלי</div>
          <div style={{ fontSize: "10px", color: "var(--muted-foreground)", lineHeight: 1 }}>ניהול חנות</div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: "2px" }}>
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: active ? 600 : 400,
                color: active ? "var(--primary)" : "var(--muted-foreground)",
                background: active ? "rgba(201,169,110,0.1)" : "transparent",
                border: active ? "1px solid rgba(201,169,110,0.2)" : "1px solid transparent",
                textDecoration: "none",
                transition: "all 0.15s",
                position: "relative",
              }}
            >
              <item.icon size={16} strokeWidth={active ? 2.5 : 2} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {active && <ChevronRight size={12} style={{ opacity: 0.6 }} />}
            </a>
          );
        })}
      </nav>

      <div
        style={{
          padding: "12px",
          borderTop: "1px solid var(--border)",
          fontSize: "11px",
          color: "var(--muted-foreground)",
          textAlign: "center",
        }}
      >
        v1.0.0
      </div>
    </aside>
  );
}

