import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { couponsRouter } from "./routes/coupons.js";
import { ordersRouter } from "./routes/orders.js";
import { categoriesRouter } from "./routes/categories.js";
import { contentRouter } from "./routes/content.js";
import { productsRouter } from "./routes/products.js";
import { topSellersRouter } from "./routes/topSellers.js";
import { analyticsRouter } from "./routes/analytics.js";
import { publicRouter } from "./routes/public.js";
import { paymentsRouter } from "./routes/payments.js";
import { adminAuthRouter } from "./routes/adminAuth.js";
import { variantsRouter } from "./routes/variants.js";
import { payplusRouter } from "./routes/payplus.js";

const app = express();

// Capture the raw request body for webhook routes so signature verification
// sees the exact bytes the provider signed. Other routes are unaffected.
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      const url = typeof req.url === "string" ? req.url : "";
      if ((url.includes("/api/payments/") || url.includes("/api/payplus/")) && url.includes("/webhook")) {
        req.rawBody = buf.toString("utf8");
      }
    },
  })
);

app.use(
  cors({
    origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",").map((s) => s.trim()) : true,
    credentials: true
  })
);

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/api/hello", (_req, res) => {
  res.json({ message: "Hello from backend" });
});

app.use("/api/coupons", couponsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/content", contentRouter);
app.use("/api/products", productsRouter);
app.use("/api/top-sellers", topSellersRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/public", publicRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/payplus", payplusRouter);
app.use("/api/admin/auth", adminAuthRouter);
app.use("/api/variants", variantsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT}`);
});

