import { getApiBaseUrl } from "../../lib/apiBase";

type ApiError = {
  status: number;
  error?: string;
  message?: string;
  details?: any;
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeoutMs = 20000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      credentials: "include",
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw { status: 0, error: "FETCH_TIMEOUT", message: "Request timed out" };
    }
    throw { status: 0, error: "FETCH_ERROR", message: err?.message || "Network request failed" };
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      ...(typeof data === "object" && data ? data : {}),
    };
    throw err;
  }

  return data as T;
}

