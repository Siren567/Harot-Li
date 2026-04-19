function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function getApiBaseUrls() {
  const configured = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (configured?.trim()) return [trimTrailingSlash(configured.trim())];

  // Vite dev / preview with proxy: same-origin `/api` → backend (avoids CORS and calls a dead :4000 when the
  // server isn’t running separately). Production builds set import.meta.env.DEV to false.
  if (import.meta.env.DEV) {
    return [""];
  }

  const host = window.location.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) return ["http://localhost:4000"];

  const canonicalBackend = "https://www.harot-li.store/_/backend";
  const onCanonical = host === "www.harot-li.store";

  // Production should use one stable backend route to avoid method/path drift.
  if (onCanonical) return ["/_/backend"];
  return [canonicalBackend];
}

export function getApiBaseUrl() {
  return getApiBaseUrls()[0];
}

