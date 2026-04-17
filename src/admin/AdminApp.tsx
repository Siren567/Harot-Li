"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "./layout/AdminLayout";
import { LoginPage } from "./pages/LoginPage";
import { isAdminAuthed } from "./state/auth";
import { DashboardPage } from "./pages/DashboardPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { adminThemeVars } from "./adminTheme";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductEditorPage } from "./pages/ProductEditorPage";
import { InventoryPage } from "./pages/InventoryPage";
import { CustomersPage } from "./pages/CustomersPage";
import { CouponsPage } from "./pages/CouponsPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { ContentPage } from "./pages/ContentPage";

type Route =
  | "/admin/login"
  | "/admin"
  | "/admin/orders"
  | "/admin/customers"
  | "/admin/products"
  | "/admin/inventory"
  | "/admin/discounts"
  | "/admin/homepage"
  | string;

function getRoute(): Route {
  return (window.location.pathname || "/admin") as Route;
}

export function AdminApp() {
  const [route, setRoute] = useState<Route>(() => getRoute());

  useEffect(() => {
    const onNav = () => setRoute(getRoute());
    window.addEventListener("popstate", onNav);
    return () => window.removeEventListener("popstate", onNav);
  }, []);

  const authed = isAdminAuthed();

  const content = useMemo(() => {
    if (route === "/admin/login") return null;
    if (route === "/admin" || route === "/admin/") return <DashboardPage />;
    if (route.startsWith("/admin/orders")) return <OrdersPage />;
    if (route.startsWith("/admin/customers")) return <CustomersPage />;
    if (route.startsWith("/admin/products")) return <ProductEditorPage />;
    if (route.startsWith("/admin/inventory")) return <InventoryPage />;
    if (route.startsWith("/admin/categories")) return <CategoriesPage />;
    if (route.startsWith("/admin/discounts")) return <CouponsPage />;
    if (route.startsWith("/admin/homepage")) return <ContentPage />;
    return <PlaceholderPage title="לא נמצא" subtitle="העמוד שביקשת לא קיים." />;
  }, [authed, route]);

  if (route === "/admin/login") {
    return (
      <div style={{ ...(adminThemeVars as React.CSSProperties), minHeight: "100svh" }}>
        <LoginPage />
      </div>
    );
  }

  if (!authed) {
    window.location.assign("/admin/login");
    return null;
  }

  return <AdminLayout>{content}</AdminLayout>;
}

