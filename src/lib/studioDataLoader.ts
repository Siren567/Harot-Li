type BootstrapResponse = { sections?: Array<{ key: string; body: any }> } | null;
type ProductsResponse = { products?: any[] };

type GlobalStudioDataCache = {
  bootstrap: Map<string, Promise<BootstrapResponse>>;
  products: Map<string, Promise<ProductsResponse>>;
};

function getGlobalStudioDataCache(): GlobalStudioDataCache {
  const g = globalThis as typeof globalThis & { __harotliStudioDataCache?: GlobalStudioDataCache };
  if (!g.__harotliStudioDataCache) {
    g.__harotliStudioDataCache = {
      bootstrap: new Map<string, Promise<BootstrapResponse>>(),
      products: new Map<string, Promise<ProductsResponse>>(),
    };
  }
  return g.__harotliStudioDataCache;
}

export function loadBootstrapOnce(apiBase: string) {
  const cache = getGlobalStudioDataCache().bootstrap;
  const key = `${apiBase || ""}/api/content/bootstrap`;
  const existing = cache.get(key);
  if (existing) return existing;
  const req = fetch(key, { credentials: "include" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  cache.set(key, req);
  return req;
}

export function loadPublicProductsOnce(apiBase: string) {
  const cache = getGlobalStudioDataCache().products;
  const key = `${apiBase || ""}/api/public/products`;
  const existing = cache.get(key);
  if (existing) return existing;
  const req = fetch(key, { credentials: "include" }).then(async (res) => {
    if (!res.ok) throw new Error("public-products");
    return (await res.json()) as ProductsResponse;
  });
  cache.set(key, req);
  return req;
}

