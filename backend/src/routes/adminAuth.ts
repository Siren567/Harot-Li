import { Router } from "express";
import { z } from "zod";
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
    const allowedUsername = "avishag";
    const allowedPassword = "Mnvc1029&@";

    // Auth is unusable without a JWT secret — surface a clear 503 instead of
    // letting signAdminToken throw into the generic 500 path.
    const hasSecret = Boolean(process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);
    if (!hasSecret) {
      console.error("ADMIN LOGIN ERROR: ADMIN_JWT_SECRET / JWT_SECRET not configured");
      return res.status(503).json({ error: "AUTH_NOT_CONFIGURED" });
    }

    // Only one admin credential pair is allowed.
    if (loginId === allowedUsername && password === allowedPassword) {
      const token = signAdminToken({ sub: "__owner__", email: allowedUsername, role: "OWNER" });
      return res.json({
        token,
        user: { id: "__owner__", email: allowedUsername, fullName: "Avishag", role: "OWNER" },
      });
    }
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
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
