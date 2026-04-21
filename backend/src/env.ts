import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 4000))
    .pipe(z.number().int().min(1).max(65535)),
  CORS_ORIGIN: z.string().optional(),
  DATABASE_URL: z.string().min(1).optional(),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  GROW_MAKE_CREATE_PAYMENT_LINK_URL: z.string().url().optional(),
  GROW_MAKE_APPROVE_TRANSACTION_URL: z.string().url().optional(),
  GROW_NOTIFY_TOKEN: z.string().min(1).optional(),
  PUBLIC_APP_BASE_URL: z.string().url().optional(),

  // PayPlus integration.
  PAYPLUS_API_KEY: z.string().min(1).optional(),
  PAYPLUS_SECRET_KEY: z.string().min(1).optional(),
  PAYPLUS_PAYMENT_PAGE_UID: z.string().min(1).optional(),
  PAYPLUS_API_BASE: z.string().url().optional(),
  PAYPLUS_WEBHOOK_SECRET: z.string().min(1).optional(),
  PAYPLUS_VERIFY_WEBHOOK: z.string().optional(),
  PUBLIC_SITE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);

