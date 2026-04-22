import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

function getPrismaDatasourceUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const isSupabasePooler = url.hostname.includes("pooler.supabase.com");
    const isTransactionPooler = url.port === "6543";
    if (isSupabasePooler && isTransactionPooler) {
      // Serverless runtimes (like Vercel) should keep Prisma connection fan-out
      // low and disable prepared statements when using Supavisor transaction mode.
      if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
      if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
      if (!url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
      return url.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

export const prisma: PrismaClient =
  globalThis.__prismaClient ??
  (() => {
    const datasourceUrl = getPrismaDatasourceUrl();
    return new PrismaClient({
      datasources: datasourceUrl
        ? {
            db: {
              url: datasourceUrl,
            },
          }
        : undefined,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  })();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaClient = prisma;
}

