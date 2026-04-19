-- Phase A: CHECK constraints for data integrity.
-- Idempotent: drops existing constraint of same name before adding.

DO $$ BEGIN
  ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS product_base_price_nonneg;
  ALTER TABLE "Product" ADD CONSTRAINT product_base_price_nonneg CHECK ("basePrice" >= 0);

  ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS product_sale_price_nonneg;
  ALTER TABLE "Product" ADD CONSTRAINT product_sale_price_nonneg CHECK ("salePrice" IS NULL OR "salePrice" >= 0);

  ALTER TABLE "ProductVariant" DROP CONSTRAINT IF EXISTS variant_stock_nonneg;
  ALTER TABLE "ProductVariant" ADD CONSTRAINT variant_stock_nonneg CHECK (stock >= 0);

  ALTER TABLE "ProductVariant" DROP CONSTRAINT IF EXISTS variant_low_threshold_nonneg;
  ALTER TABLE "ProductVariant" ADD CONSTRAINT variant_low_threshold_nonneg CHECK ("lowThreshold" >= 0);

  ALTER TABLE "ProductVariant" DROP CONSTRAINT IF EXISTS variant_price_override_nonneg;
  ALTER TABLE "ProductVariant" ADD CONSTRAINT variant_price_override_nonneg CHECK ("priceOverride" IS NULL OR "priceOverride" >= 0);

  ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS order_item_qty_positive;
  ALTER TABLE "OrderItem" ADD CONSTRAINT order_item_qty_positive CHECK (qty > 0);

  ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS order_item_unit_price_nonneg;
  ALTER TABLE "OrderItem" ADD CONSTRAINT order_item_unit_price_nonneg CHECK ("unitPrice" >= 0);
END $$;
