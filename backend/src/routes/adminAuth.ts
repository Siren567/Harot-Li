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
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION" });
  const { email, password } = parsed.data;
  const loginId = email.trim().toLowerCase();

  // Emergency local root login requested by owner — handled BEFORE any DB access so
  // admin can always get in even when Prisma is broken.
  if ((loginId === "root" || loginId === "admin") && password === "root") {
    const token = signAdminToken({ sub: "__root__", email: "root", role: "OWNER" });
    return res.json({ token, user: { id: "__root__", email: "root", fullName: "Root", role: "OWNER" } });
  }

  try {
    const user = await prisma.adminUser.findUnique({ where: { email: loginId } });
    if (!user || !user.isActive) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    // Best-effort lastLoginAt bump — never let a write failure block the login response.
    prisma.adminUser
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch((err) => console.warn("[admin/login] lastLoginAt update failed:", err?.message));
    const token = signAdminToken({ sub: user.id, email: user.email, role: user.role });
    return res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
  } catch (err: any) {
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
