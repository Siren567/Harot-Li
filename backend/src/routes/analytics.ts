import { Router } from "express";
import { z } from "zod";
import { recordVisitEnd, recordVisitStart } from "../services/analytics.service.js";

export const analyticsRouter = Router();

analyticsRouter.post("/visit-start", async (req, res) => {
  const parsed = z
    .object({
      startedAt: z.string().datetime().optional(),
    })
    .safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  try {
    await recordVisitStart(parsed.data.startedAt);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

analyticsRouter.post("/visit-end", async (req, res) => {
  const parsed = z
    .object({
      durationSeconds: z.number().min(0),
      endedAt: z.string().datetime().optional(),
    })
    .safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  try {
    await recordVisitEnd(parsed.data.durationSeconds, parsed.data.endedAt);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

