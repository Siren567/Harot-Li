import { getApiBaseUrls } from "../../lib/apiBase";
import { clearAdminAuth, getAdminToken } from "../state/auth";

type ApiError = {
  status: number;
  error?: string;
  message?: string;
  details?: any;
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const isAdminLogin = normalizedPath === "/api/admin/auth/login";
  const allBases = getApiBaseUrls();
  const bases = isAdminLogin ? allBases.slice(0, 1) : allBases;
  let lastNetworkError: any = null;
  let lastHttpError: ApiError | null = null;

  for (let i = 0; i < bases.length; i += 1) {
    const base = bases[i];
    const url = `${base}${normalizedPath}`;
    const controller = new AbortController();
    const timeoutMs = 20000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      const token = getAdminToken();
      res = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers ?? {}),
        },
        credentials: "include",
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastNetworkError = err;
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    const text = await res.text();
    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      // Try next base URL on proxy-path misses or redirects.
      if (!isAdminLogin && (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308 || res.status === 404 || res.status === 405) && i < bases.length - 1) {
        continue;
      }
      if (res.status === 401) clearAdminAuth();
      lastHttpError = {
        status: res.status,
        ...(typeof data === "object" && data ? data : {}),
      };
      break;
    }

    return data as T;
  }

  if (lastHttpError) throw lastHttpError;
  if (lastNetworkError?.name === "AbortError") {
    throw { status: 0, error: "FETCH_TIMEOUT", message: "Request timed out" };
  }
  throw { status: 0, error: "FETCH_ERROR", message: lastNetworkError?.message || "Network request failed" };
}

