"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ChevronDown, LogOut, User } from "lucide-react";
import { useToast } from "../ui/toast";
import { clearAdminAuth } from "../state/auth";

export function Topbar() {
  const toast = useToast();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
            setProfileOpen((v) => !v);
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

