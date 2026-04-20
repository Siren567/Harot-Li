import { z } from "zod";
import { prisma } from "../db/prisma.js";

export type TopSellerRow = {
  id: string;
  product_id: string;
  sort_order: number;
  badge_text: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  products: {
    id: string;
    title: string;
    slug: string;
    image_url: string | null;
    price: number;
    is_active: boolean;
  } | null;
};

const TopSellersReplaceSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        sort_order: z.number().int().min(0).max(9999),
        badge_text: z.string().max(40).optional().nullable(),
        is_active: z.boolean().optional(),
      })
    )
    .max(30),
});

export async function listTopSellers(): Promise<TopSellerRow[]> {
  const rows = await prisma.homeFeaturedProduct.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      product: {
        select: { id: true, title: true, slug: true, imageUrl: true, basePrice: true, isActive: true },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    product_id: row.productId,
    sort_order: row.sortOrder,
    badge_text: row.badgeText ?? null,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    products: row.product
      ? {
          id: row.product.id,
          title: row.product.title,
          slug: row.product.slug,
          image_url: row.product.imageUrl ?? null,
          price: row.product.basePrice,
          is_active: row.product.isActive,
        }
      : null,
  }));
}

export async function replaceTopSellers(input: unknown): Promise<TopSellerRow[]> {
  const parsed = TopSellersReplaceSchema.safeParse(input);
  if (!parsed.success) throw { code: "VALIDATION", details: parsed.error.flatten() };
  const payload = parsed.data.items;
  await prisma.$transaction(async (tx) => {
    const current = await tx.homeFeaturedProduct.findMany({
      select: { id: true, productId: true },
    });
    const currentByProduct = new Map(current.map((x) => [x.productId, x]));
    const nextProductIds = new Set(payload.map((x) => x.product_id));

    const toDeleteIds = current.filter((x) => !nextProductIds.has(x.productId)).map((x) => x.id);
    if (toDeleteIds.length > 0) {
      await tx.homeFeaturedProduct.deleteMany({ where: { id: { in: toDeleteIds } } });
    }

    for (const item of payload) {
      const exists = currentByProduct.get(item.product_id);
      if (exists) {
        await tx.homeFeaturedProduct.update({
          where: { id: exists.id },
          data: {
            sortOrder: item.sort_order,
            badgeText: item.badge_text ?? null,
            isActive: item.is_active ?? true,
          },
        });
      } else {
        await tx.homeFeaturedProduct.create({
          data: {
            productId: item.product_id,
            sortOrder: item.sort_order,
            badgeText: item.badge_text ?? null,
            isActive: item.is_active ?? true,
          },
        });
      }
    }
  });

  return listTopSellers();
}

