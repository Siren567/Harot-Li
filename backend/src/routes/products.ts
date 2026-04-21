import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "../services/products.service.js";
import { requireAdmin } from "../lib/auth.js";
import { invalidatePublicProductsCache } from "./public.js";
import { isDatabaseConnectionError, respondDatabaseUnavailable } from "../lib/dbErrors.js";

export const productsRouter = Router();

productsRouter.get("/", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const activeRaw = typeof req.query.active === "string" ? req.query.active : undefined;
    const active =
      activeRaw === undefined ? undefined : activeRaw === "true" ? true : activeRaw === "false" ? false : undefined;
    const products = await listProducts({ q, active });
    res.json({ products });
  } catch (e) {
    if (isDatabaseConnectionError(e)) return respondDatabaseUnavailable(res, e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

productsRouter.post("/", requireAdmin, async (req, res) => {
  try {
    const product = await createProduct(req.body);
    invalidatePublicProductsCache();
    res.status(201).json({ product });
  } catch (e: any) {
    if (e?.code === "VALIDATION") return res.status(400).json({ error: "VALIDATION", details: e.details });
    if (e?.code === "23505" || e?.message?.includes("duplicate")) return res.status(409).json({ error: "SLUG_EXISTS" });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

productsRouter.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const product = await updateProduct(req.params.id, req.body);
    invalidatePublicProductsCache();
    res.json({ product });
  } catch (e: any) {
    if (e?.code === "VALIDATION") return res.status(400).json({ error: "VALIDATION", details: e.details });
    if (e?.code === "PGRST116") return res.status(404).json({ error: "NOT_FOUND" });
    if (e?.code === "23505" || e?.message?.includes("duplicate")) return res.status(409).json({ error: "SLUG_EXISTS" });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

productsRouter.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await deleteProduct(req.params.id);
    invalidatePublicProductsCache();
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

