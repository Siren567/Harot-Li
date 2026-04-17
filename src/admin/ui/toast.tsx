"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const icons: Record<ToastType, ReactNode> = {
    success: <CheckCircle size={16} color="var(--success)" />,
    error: <XCircle size={16} color="var(--destructive)" />,
    warning: <AlertCircle size={16} color="var(--warning)" />,
    info: <Info size={16} color="var(--info)" />,
  };

  const colors: Record<ToastType, string> = {
    success: "var(--success)",
    error: "var(--destructive)",
    warning: "var(--warning)",
    info: "var(--info)",
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          left: "24px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "var(--card)",
              border: `1px solid var(--border)`,
              borderRight: `3px solid ${colors[t.type]}`,
              borderRadius: "10px",
              padding: "12px 16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              minWidth: "280px",
              maxWidth: "360px",
              pointerEvents: "all",
              animation: "slideInLeft 0.2s ease",
            }}
          >
            {icons[t.type]}
            <span style={{ flex: 1, fontSize: "13px", color: "var(--foreground)", lineHeight: 1.4 }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted-foreground)",
                display: "flex",
                padding: "2px",
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-16px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx.toast;
}

