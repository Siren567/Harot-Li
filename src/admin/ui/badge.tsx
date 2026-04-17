import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "error" | "warning" | "info" | "muted";
  size?: "sm" | "md";
}

const variantStyles: Record<string, { bg: string; color: string; border: string }> = {
  default: { bg: "rgba(201,169,110,0.15)", color: "var(--primary)", border: "rgba(201,169,110,0.3)" },
  success: { bg: "rgba(34,197,94,0.12)", color: "var(--success)", border: "rgba(34,197,94,0.25)" },
  error: { bg: "rgba(239,68,68,0.12)", color: "var(--destructive)", border: "rgba(239,68,68,0.25)" },
  warning: { bg: "rgba(245,158,11,0.12)", color: "var(--warning)", border: "rgba(245,158,11,0.25)" },
  info: { bg: "rgba(59,130,246,0.12)", color: "var(--info)", border: "rgba(59,130,246,0.25)" },
  muted: { bg: "var(--input)", color: "var(--muted-foreground)", border: "var(--border)" },
};

export function Badge({ children, variant = "default", size = "sm" }: BadgeProps) {
  const s = variantStyles[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        borderRadius: "6px",
        padding: size === "sm" ? "2px 8px" : "4px 10px",
        fontSize: size === "sm" ? "11px" : "12px",
        fontWeight: 500,
        whiteSpace: "nowrap",
        lineHeight: 1.6,
      }}
    >
      {children}
    </span>
  );
}

