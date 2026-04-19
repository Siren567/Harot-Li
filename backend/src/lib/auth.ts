import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";

const SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || "";
const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12h

if (!SECRET) {
  // eslint-disable-next-line no-console
  console.warn("[auth] ADMIN_JWT_SECRET not set — admin auth will reject all tokens.");
}

export type AdminPayload = { sub: string; email: string; role: string };

export function signAdminToken(payload: AdminPayload): string {
  if (!SECRET) throw new Error("ADMIN_JWT_SECRET missing");
  return jwt.sign(payload, SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyAdminToken(token: string): AdminPayload | null {
  if (!SECRET) return null;
  try {
    const decoded = jwt.verify(token, SECRET) as AdminPayload;
    if (!decoded?.sub || !decoded?.email) return null;
    return decoded;
  } catch {
    return null;
  }
}

function readToken(req: Request): string | null {
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const headerToken = req.headers["x-admin-token"];
  if (typeof headerToken === "string" && headerToken.trim()) return headerToken.trim();
  return null;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });
  const payload = verifyAdminToken(token);
  if (!payload) return res.status(401).json({ error: "UNAUTHORIZED" });
  if (payload.sub === "__root__" && payload.email === "root") {
    (req as any).admin = { id: "__root__", email: "root", role: "OWNER" };
    return next();
  }
  const user = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) return res.status(401).json({ error: "UNAUTHORIZED" });
  (req as any).admin = { id: user.id, email: user.email, role: user.role };
  next();
}
