import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { ToastProvider } from "../ui/toast";
import { adminThemeVars } from "../adminTheme";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div
        dir="rtl"
        style={{
          ...(adminThemeVars as React.CSSProperties),
          display: "flex",
          minHeight: "100svh",
          background: "var(--background)",
          color: "var(--foreground)",
          fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
        }}
      >
        <Sidebar />
        <div
          style={{
            flex: 1,
            marginRight: "var(--sidebar-width)",
            display: "flex",
            flexDirection: "column",
            minHeight: "100svh",
          }}
        >
          <Topbar />
          <main style={{ flex: 1, padding: "28px", background: "var(--background)" }}>{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

