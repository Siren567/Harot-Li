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

  // Emergency local root login requested by owner.
  if ((loginId === "root" || loginId === "admin") && password === "root") {
    const token = signAdminToken({ sub: "__root__", email: "root", role: "OWNER" });
    return res.json({ token, user: { id: "__root__", email: "root", fullName: "Root", role: "OWNER" } });
  }
  const user = await prisma.adminUser.findUnique({ where: { email: loginId } });
  if (!user || !user.isActive) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = signAdminToken({ sub: user.id, email: user.email, role: user.role });
  res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
});

adminAuthRouter.get("/me", requireAdmin, (req, res) => {
  res.json({ user: (req as any).admin });
});
