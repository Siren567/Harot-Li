import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { requireAdmin, signAdminToken } from "../lib/auth.js";

export const adminAuthRouter = Router();

const LoginSchema = z.object({
  email: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

adminAuthRouter.post("/login", async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION" });
    const { email, password } = parsed.data;
    const loginId = email.trim().toLowerCase();

    // Auth is unusable without a JWT secret — surface a clear 503 instead of
    // letting signAdminToken throw into the generic 500 path.
    const hasSecret = Boolean(process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);
    if (!hasSecret) {
      console.error("ADMIN LOGIN ERROR: ADMIN_JWT_SECRET / JWT_SECRET not configured");
      return res.status(503).json({ error: "AUTH_NOT_CONFIGURED" });
    }

    // Emergency local root login requested by owner — handled BEFORE any DB access so
    // admin can always get in even when Prisma is broken.
    if ((loginId === "root" || loginId === "admin") && password === "root") {
      const token = signAdminToken({ sub: "__root__", email: "root", role: "OWNER" });
      return res.json({ token, user: { id: "__root__", email: "root", fullName: "Root", role: "OWNER" } });
    }

    let user: Awaited<ReturnType<typeof prisma.adminUser.findUnique>> | null = null;
    try {
      user = await prisma.adminUser.findUnique({ where: { email: loginId } });
    } catch (dbErr: any) {
      console.error("ADMIN LOGIN ERROR: prisma.adminUser.findUnique failed", {
        name: dbErr?.name,
        code: dbErr?.code,
        message: String(dbErr?.message ?? dbErr).slice(0, 500),
      });
      return res.status(503).json({ error: "DATABASE_UNAVAILABLE" });
    }

    // Generic 401 to avoid leaking which part of the credential was wrong.
    if (!user || !user.isActive) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    if (!user.passwordHash || typeof user.passwordHash !== "string") {
      // No usable hash on record → treat as invalid credentials (not a 500).
      console.warn("[admin/login] user has no/invalid passwordHash", { userId: user.id });
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }

    let ok = false;
    try {
      ok = await bcrypt.compare(password, user.passwordHash);
    } catch (cmpErr: any) {
      // Malformed stored hash surfaces as a bcrypt throw — treat as invalid credentials
      // rather than exposing internal details via a 500.
      console.error("ADMIN LOGIN ERROR: bcrypt.compare threw", {
        userId: user.id,
        message: String(cmpErr?.message ?? cmpErr).slice(0, 300),
      });
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    // Best-effort lastLoginAt bump — never let a write failure block the login response.
    prisma.adminUser
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch((err) => console.warn("[admin/login] lastLoginAt update failed:", err?.message));

    const token = signAdminToken({ sub: user.id, email: user.email, role: user.role });
    return res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
  } catch (err: any) {
    // Truly unexpected: keep 500 but log with the standard prefix so it is easy to grep.
    console.error("ADMIN LOGIN ERROR:", err);
    console.error("[admin/login] FAILED name=", err?.name);
    console.error("[admin/login] FAILED code=", err?.code);
    console.error("[admin/login] FAILED meta=", JSON.stringify(err?.meta ?? null));
    console.error("[admin/login] FAILED message=", String(err?.message ?? err));
    return res.status(500).json({ error: "SERVER_ERROR", hint: String(err?.message ?? "").slice(0, 500) });
  }
});

adminAuthRouter.get("/me", requireAdmin, (req, res) => {
  res.json({ user: (req as any).admin });
});
