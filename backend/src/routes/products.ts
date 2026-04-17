import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "../services/products.service.js";

export const productsRouter = Router();

productsRouter.get("/", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const activeRaw = typeof req.query.active === "string" ? req.query.active : undefined;
    const active =
      activeRaw === undefined ? undefined : activeRaw === "true" ? true : activeRaw === "false" ? false : undefined;
    const products = await listProducts({ q, active });
    res.json({ products });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

productsRouter.post("/", async (req, res) => {
  try {
    const product = await createProduct(req.body);
    res.status(201).json({ product });
  } catch (e: any) {
    if (e?.code === "VALIDATION") return res.status(400).json({ error: "VALIDATION", details: e.details });
    if (e?.code === "23505" || e?.message?.includes("duplicate")) return res.status(409).json({ error: "SLUG_EXISTS" });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

productsRouter.patch("/:id", async (req, res) => {
  try {
    const product = await updateProduct(req.params.id, req.body);
    res.json({ product });
  } catch (e: any) {
    if (e?.code === "VALIDATION") return res.status(400).json({ error: "VALIDATION", details: e.details });
    if (e?.code === "PGRST116") return res.status(404).json({ error: "NOT_FOUND" });
    if (e?.code === "23505" || e?.message?.includes("duplicate")) return res.status(409).json({ error: "SLUG_EXISTS" });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

productsRouter.delete("/:id", async (req, res) => {
  try {
    await deleteProduct(req.params.id);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

