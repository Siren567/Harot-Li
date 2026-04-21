"use client";

import { useEffect, useState } from "react";
import App from "./App";
import { AdminApp } from "./admin/AdminApp";
import StudioPage from "./components/StudioPage";
import PayPlusReturnPage from "./components/PayPlusReturnPage";

type Route =
  | { kind: "admin" }
  | { kind: "studio" }
  | { kind: "payplus-success" }
  | { kind: "payplus-failure" }
  | { kind: "payplus-cancel" }
  | { kind: "app" };

function resolveRoute(): Route {
  const p = window.location.pathname || "";
  if (p.startsWith("/admin")) return { kind: "admin" };
  if (p.startsWith("/checkout/payplus/success")) return { kind: "payplus-success" };
  if (p.startsWith("/checkout/payplus/failure")) return { kind: "payplus-failure" };
  if (p.startsWith("/checkout/payplus/cancel")) return { kind: "payplus-cancel" };
  if (p.startsWith("/studio")) return { kind: "studio" };
  return { kind: "app" };
}

export default function Router() {
  const [route, setRoute] = useState<Route>(() => resolveRoute());

  useEffect(() => {
    const onNav = () => setRoute(resolveRoute());
    window.addEventListener("popstate", onNav);
    return () => window.removeEventListener("popstate", onNav);
  }, []);

  switch (route.kind) {
    case "admin":
      return <AdminApp />;
    case "studio":
      return <StudioPage onBackToLanding={() => window.location.assign("/")} />;
    case "payplus-success":
      return <PayPlusReturnPage kind="success" />;
    case "payplus-failure":
      return <PayPlusReturnPage kind="failure" />;
    case "payplus-cancel":
      return <PayPlusReturnPage kind="cancel" />;
    default:
      return <App />;
  }
}
