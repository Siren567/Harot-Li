"use client";

import { useEffect, useState } from "react";
import App from "./App";
import { AdminApp } from "./admin/AdminApp";

function isAdminRoute() {
  return (window.location.pathname || "").startsWith("/admin");
}

export default function Router() {
  const [admin, setAdmin] = useState(isAdminRoute());

  useEffect(() => {
    const onNav = () => setAdmin(isAdminRoute());
    window.addEventListener("popstate", onNav);
    return () => window.removeEventListener("popstate", onNav);
  }, []);

  return admin ? <AdminApp /> : <App />;
}

