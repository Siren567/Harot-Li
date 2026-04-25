"use client";

import { useEffect, useRef, useState } from "react";
import App from "./App";
import { AdminApp } from "./admin/AdminApp";
import StudioPage from "./components/StudioPage";
import PayPlusReturnPage from "./components/PayPlusReturnPage";
import AccessibilityWidget from "./components/AccessibilityWidget";
import LegalBundlePage from "./components/LegalBundlePage";

type Route =
  | { kind: "admin" }
  | { kind: "studio" }
  | { kind: "payplus-success" }
  | { kind: "payplus-failure" }
  | { kind: "payplus-cancel" }
  | { kind: "legal" }
  | { kind: "app" };

function resolveRoute(): Route {
  const p = window.location.pathname || "";
  if (p.startsWith("/admin")) return { kind: "admin" };
  if (p.startsWith("/checkout/payplus/success")) return { kind: "payplus-success" };
  if (p.startsWith("/checkout/payplus/failure")) return { kind: "payplus-failure" };
  if (p.startsWith("/checkout/payplus/cancel")) return { kind: "payplus-cancel" };
  if (p.startsWith("/studio")) return { kind: "studio" };
  if (p === "/legal" || p.startsWith("/legal/")) return { kind: "legal" };
  return { kind: "app" };
}

export default function Router() {
  const [route, setRoute] = useState<Route>(() => resolveRoute());
  const skipMetaPixelFirstPageView = useRef(true);

  useEffect(() => {
    const onNav = () => setRoute(resolveRoute());
    window.addEventListener("popstate", onNav);
    return () => window.removeEventListener("popstate", onNav);
  }, []);

  /** Avoid double PageView on first paint (already fired from index.html). */
  useEffect(() => {
    if (typeof window.fbq !== "function") return;
    if (skipMetaPixelFirstPageView.current) {
      skipMetaPixelFirstPageView.current = false;
      return;
    }
    window.fbq("track", "PageView");
  }, [route]);

  switch (route.kind) {
    case "admin":
      return <AdminApp />;
    case "studio":
      return (
        <>
          <StudioPage onBackToLanding={() => window.location.assign("/")} />
          <AccessibilityWidget />
        </>
      );
    case "payplus-success":
      return (
        <>
          <PayPlusReturnPage kind="success" />
          <AccessibilityWidget />
        </>
      );
    case "payplus-failure":
      return (
        <>
          <PayPlusReturnPage kind="failure" />
          <AccessibilityWidget />
        </>
      );
    case "payplus-cancel":
      return (
        <>
          <PayPlusReturnPage kind="cancel" />
          <AccessibilityWidget />
        </>
      );
    case "legal":
      return (
        <>
          <LegalBundlePage />
          <AccessibilityWidget />
        </>
      );
    default:
      return (
        <>
          <App />
          <AccessibilityWidget />
        </>
      );
  }
}
