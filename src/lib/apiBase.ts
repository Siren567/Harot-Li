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
  // Apex + www must prefer same-origin /_/backend so /api/* is not a cross-origin hop
  // (harot-li.store was pointing only at www and broke studio/product loads from CORS / routing).
  const onHarotSite = host === "www.harot-li.store" || host === "harot-li.store";

  // Try same-origin /api first (some hosts proxy it), then /_/backend, then absolute www fallback.
  if (onHarotSite) return ["", "/_/backend", canonicalBackend];
  return [canonicalBackend];
}

/** Join API path (always starts with /) to optional origin/prefix base. */
export function joinApiUrl(base: string, path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const b = (base || "").replace(/\/$/, "");
  if (!b) return p;
  return `${b}${p}`;
}

/** Prefer a non-empty base for same-tab `fetch(\`\${apiBase}/api/...\`)` (checkout, coupons). Loaders still try every URL from {@link getApiBaseUrls}. */
export function getApiBaseUrl() {
  const bases = getApiBaseUrls();
  const firstNonEmpty = bases.find((b) => String(b || "").length > 0);
  return firstNonEmpty ?? bases[0] ?? "";
}

