import { getApiBaseUrls, joinApiUrl } from "./apiBase";

type BootstrapResponse = { sections?: Array<{ key: string; body: any }> } | null;
type ProductsResponse = { products?: any[] };

type GlobalStudioDataCache = {
  bootstrap: Map<string, { createdAt: number; promise: Promise<BootstrapResponse> }>;
  products: Map<string, { createdAt: number; promise: Promise<ProductsResponse> }>;
};

const CLIENT_CACHE_TTL_MS = 15_000;

function getGlobalStudioDataCache(): GlobalStudioDataCache {
  const g = globalThis as typeof globalThis & { __harotliStudioDataCache?: GlobalStudioDataCache };
  if (!g.__harotliStudioDataCache) {
    g.__harotliStudioDataCache = {
      bootstrap: new Map<string, { createdAt: number; promise: Promise<BootstrapResponse> }>(),
      products: new Map<string, { createdAt: number; promise: Promise<ProductsResponse> }>(),
    };
  }
  return g.__harotliStudioDataCache!;
}

async function fetchJsonFirstOk(path: string): Promise<{ ok: boolean; data: any }> {
  const bases = getApiBaseUrls();
  for (let i = 0; i < bases.length; i += 1) {
    const url = joinApiUrl(bases[i], path);
    try {
      const res = await fetch(url, { credentials: "omit", cache: "default", mode: "cors" });
      if (res.ok) {
        const data = await res.json();
        return { ok: true, data };
      }
      if (i < bases.length - 1) continue;
    } catch {
      if (i < bases.length - 1) continue;
    }
  }
  return { ok: false, data: null };
}

/** Cache key stable across bases order attempts (same logical resource). */
function basesCacheKey(kind: "bootstrap" | "products") {
  return `${kind}:${getApiBaseUrls().join("|")}`;
}

export function loadBootstrapOnce(_apiBase?: string) {
  const cache = getGlobalStudioDataCache().bootstrap;
  const key = basesCacheKey("bootstrap");
  const existing = cache.get(key);
  if (existing && Date.now() - existing.createdAt < CLIENT_CACHE_TTL_MS) return existing.promise;
  const req = fetchJsonFirstOk("/api/content/bootstrap")
    .then((r) => (r.ok ? r.data : null))
    .catch(() => null);
  cache.set(key, { createdAt: Date.now(), promise: req });
  return req;
}

export function loadPublicProductsOnce(_apiBase?: string) {
  const cache = getGlobalStudioDataCache().products;
  const key = basesCacheKey("products");
  const existing = cache.get(key);
  if (existing && Date.now() - existing.createdAt < CLIENT_CACHE_TTL_MS) return existing.promise;
  const req = fetchJsonFirstOk("/api/public/products").then(async (r) => {
    if (!r.ok) throw new Error("public-products");
    return r.data as ProductsResponse;
  });
  cache.set(key, { createdAt: Date.now(), promise: req });
  return req;
}
