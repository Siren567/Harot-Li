import { Router } from "express";
import { listTopSellers, replaceTopSellers } from "../services/topSellers.service.js";

export const topSellersRouter = Router();

topSellersRouter.get("/", async (_req, res) => {
  try {
    const items = await listTopSellers();
    res.json({ items });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

topSellersRouter.put("/", async (req, res) => {
  try {
    const items = await replaceTopSellers(req.body);
    res.json({ items });
  } catch (e: any) {
    if (e?.code === "VALIDATION") return res.status(400).json({ error: "VALIDATION", details: e.details });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

