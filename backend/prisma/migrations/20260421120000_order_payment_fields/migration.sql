-- PayPlus integration prep: add payment fields to Order.
-- paymentStatus is a plain string (pending|paid|failed|cancelled) so the provider
-- lifecycle can evolve independently of the fulfillment OrderStatus enum.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentUrl" TEXT;
