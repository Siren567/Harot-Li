import { prisma } from "../db/prisma.js";

async function resetTestData() {
  console.log("[resetTestData] starting...");

  try {
    const couponRedemptionResult = await prisma.couponRedemption.deleteMany();
    console.log(`[resetTestData] CouponRedemption deleted: ${couponRedemptionResult.count}`);

    const orderItemResult = await prisma.orderItem.deleteMany();
    console.log(`[resetTestData] OrderItem deleted: ${orderItemResult.count}`);

    const orderResult = await prisma.order.deleteMany();
    console.log(`[resetTestData] Order deleted: ${orderResult.count}`);

    const customerResult = await prisma.customer.deleteMany();
    console.log(`[resetTestData] Customer deleted: ${customerResult.count}`);

    const inventoryLogResult = await prisma.inventoryLog.deleteMany();
    console.log(`[resetTestData] InventoryLog deleted: ${inventoryLogResult.count}`);

    console.log("[resetTestData] done.");
  } catch (error: any) {
    console.error("[resetTestData] failed:", error?.message ?? error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void resetTestData();
