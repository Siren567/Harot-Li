function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function getApiBaseUrls() {
  const configured = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (configured?.trim()) return [trimTrailingSlash(configured.trim())];

  const host = window.location.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) return ["http://localhost:4000"];

  const canonical = "https://www.harot-li.store";
  const onCanonical = host === "www.harot-li.store";

  // Try canonical backend first to avoid redirect/method issues on non-www.
  if (onCanonical) return ["/_/backend", "/backend", "", `${canonical}/_/backend`];
  return [`${canonical}/_/backend`, "/_/backend", "/backend", ""];
}

export function getApiBaseUrl() {
  return getApiBaseUrls()[0];
}

