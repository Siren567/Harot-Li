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

export function loadBootstrapOnce(apiBase: string) {
  const cache = getGlobalStudioDataCache().bootstrap;
  const key = `${apiBase || ""}/api/content/bootstrap`;
  const existing = cache.get(key);
  if (existing && Date.now() - existing.createdAt < CLIENT_CACHE_TTL_MS) return existing.promise;
  const req = fetch(key, { credentials: "include", cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  cache.set(key, { createdAt: Date.now(), promise: req });
  return req;
}

export function loadPublicProductsOnce(apiBase: string) {
  const cache = getGlobalStudioDataCache().products;
  const key = `${apiBase || ""}/api/public/products`;
  const existing = cache.get(key);
  if (existing && Date.now() - existing.createdAt < CLIENT_CACHE_TTL_MS) return existing.promise;
  const req = fetch(key, { credentials: "include", cache: "no-store" }).then(async (res) => {
    if (!res.ok) throw new Error("public-products");
    return (await res.json()) as ProductsResponse;
  });
  cache.set(key, { createdAt: Date.now(), promise: req });
  return req;
}

