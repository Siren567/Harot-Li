"use client";

import { useEffect, useState } from "react";
import App from "./App";
import { AdminApp } from "./admin/AdminApp";
import StudioPage from "./components/StudioPage";

function isAdminRoute() {
  return (window.location.pathname || "").startsWith("/admin");
}

function isStudioRoute() {
  return (window.location.pathname || "").startsWith("/studio");
}

export default function Router() {
  const [admin, setAdmin] = useState(isAdminRoute());
  const [studio, setStudio] = useState(isStudioRoute());

  useEffect(() => {
    const onNav = () => {
      setAdmin(isAdminRoute());
      setStudio(isStudioRoute());
    };
    window.addEventListener("popstate", onNav);
    return () => window.removeEventListener("popstate", onNav);
  }, []);

  if (admin) return <AdminApp />;
  if (studio) return <StudioPage onBackToLanding={() => window.location.assign("/")} />;
  return <App />;
}

