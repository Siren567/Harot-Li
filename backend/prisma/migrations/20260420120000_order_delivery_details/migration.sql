-- Snapshot: shipping method, address, checkout + design notes from studio checkout.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryDetails" JSONB;
