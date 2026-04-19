/** Normalize API order payload: Prisma returns `orderItems` rows; legacy JSON lives in `items`. */
export function getOrderLineItems(order: { orderItems?: unknown; items?: unknown }): Record<string, unknown>[] {
  const rel = order?.orderItems;
  if (Array.isArray(rel) && rel.length > 0) return rel as Record<string, unknown>[];
  const raw = order?.items;
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  return [];
}

export function firstOrderLineProductName(order: { orderItems?: unknown; items?: unknown }): string {
  const lines = getOrderLineItems(order);
  const line = lines[0];
  if (!line) return "מוצר";
  const n = line.nameSnapshot ?? line.name ?? line.title;
  return String(n ?? "").trim() || "מוצר";
}
