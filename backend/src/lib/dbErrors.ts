import type { Response } from "express";

/** Prisma / driver codes that usually mean the DB is unreachable or auth to DB failed. */
const DB_CONNECTION_CODES = new Set(["P1001", "P1000", "P1017"]);

export function isDatabaseConnectionError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  const code = String(e?.code ?? "");
  if (DB_CONNECTION_CODES.has(code)) return true;
  const msg = String(e?.message ?? "").toLowerCase();
  if (msg.includes("can't reach database server")) return true;
  if (msg.includes("server has closed the connection")) return true;
  if (msg.includes("connection terminated unexpectedly")) return true;
  if (msg.includes("econnrefused")) return true;
  if (msg.includes("etimedout") && (msg.includes("connect") || msg.includes("5432"))) return true;
  return false;
}

export function respondDatabaseUnavailable(res: Response, err: unknown): void {
  const message = String((err as { message?: string })?.message ?? "").slice(0, 400);
  res.status(503).json({
    error: "DATABASE_UNAVAILABLE",
    ...(message ? { message } : {}),
  });
}
