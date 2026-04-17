import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env.js";

export function getSupabaseAdminClient(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin client misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getSupabaseAnonClient(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase anon client misconfigured: missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

