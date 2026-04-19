import { Router } from "express";
import { z } from "zod";
import {
  getContentBootstrap,
  getLegalPage,
  upsertContentSection,
  upsertLegalPage,
  upsertSiteSetting,
} from "../services/content.service.js";

export const contentRouter = Router();

contentRouter.get("/bootstrap", async (_req, res) => {
  try {
    const data = await getContentBootstrap();
    res.json(data);
  } catch (err: any) {
    console.error("[content/bootstrap] FAILED message=", String(err?.message ?? err));
    // Never block frontend boot — return empty defaults.
    res.json({ sections: [], settings: [], legalPages: [], topSellers: [] });
  }
});

contentRouter.put("/sections/:key", async (req, res) => {
  try {
    const key = req.params.key;
    const payload = {
      key,
      title: req.body?.title ?? null,
      body: req.body?.body ?? {},
      is_active: req.body?.is_active ?? true,
      sort_order: req.body?.sort_order ?? 0,
    };
    const section = await upsertContentSection(payload);
    res.json({ section });
  } catch (e: any) {
    if (e?.code === "VALIDATION") return res.status(400).json({ error: "VALIDATION", details: e.details });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

contentRouter.put("/settings/:key", async (req, res) => {
  try {
    const key = req.params.key;
    const setting = await upsertSiteSetting({ key, value: req.body?.value ?? {} });
    res.json({ setting });
  } catch (e: any) {
    if (e?.code === "VALIDATION") return res.status(400).json({ error: "VALIDATION", details: e.details });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

contentRouter.get("/legal/:slug", async (req, res) => {
  const slug = req.params.slug;
  try {
    const page = await getLegalPage(slug);
    if (!page) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ page });
  } catch {
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

contentRouter.put("/legal/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const bodySchema = z.object({
      title: z.string().min(1),
      body: z.any(),
      is_active: z.boolean().optional(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

    const page = await upsertLegalPage({
      slug,
      title: parsed.data.title,
      body: parsed.data.body,
      is_active: parsed.data.is_active ?? true,
    });
    return res.json({ page });
  } catch (e: any) {
    if (e?.code === "VALIDATION") return res.status(400).json({ error: "VALIDATION", details: e.details });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

