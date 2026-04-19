function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function getApiBaseUrls() {
  const configured = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (configured?.trim()) return [trimTrailingSlash(configured.trim())];

  const host = window.location.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) return ["http://localhost:4000"];

  // Try common production proxy paths in order.
  return ["/_/backend", "/backend", ""];
}

export function getApiBaseUrl() {
  return getApiBaseUrls()[0];
}

