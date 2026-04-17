import { getSupabaseAdminClient } from "../supabase/client.js";

type DailyAnalytics = {
  visits: number;
  sessionSeconds: number;
  sessionCount: number;
};

type AnalyticsMap = Record<string, DailyAnalytics>;

const ANALYTICS_KEY = "analytics_daily";

function dayKeyFromDate(value?: string | Date) {
  const d = value ? new Date(value) : new Date();
  return d.toISOString().slice(0, 10);
}

async function loadAnalyticsMap(): Promise<AnalyticsMap> {
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb
    .from("site_settings")
    .select("value")
    .eq("key", ANALYTICS_KEY)
    .maybeSingle();
  if (error) throw error;
  const v = data?.value;
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as AnalyticsMap;
}

async function saveAnalyticsMap(map: AnalyticsMap) {
  const sb = getSupabaseAdminClient();
  const { error } = await sb
    .from("site_settings")
    .upsert({ key: ANALYTICS_KEY, value: map }, { onConflict: "key" });
  if (error) throw error;
}

export async function recordVisitStart(startedAt?: string) {
  const map = await loadAnalyticsMap();
  const key = dayKeyFromDate(startedAt);
  const prev = map[key] ?? { visits: 0, sessionSeconds: 0, sessionCount: 0 };
  map[key] = {
    ...prev,
    visits: prev.visits + 1,
  };
  await saveAnalyticsMap(map);
}

export async function recordVisitEnd(durationSeconds: number, endedAt?: string) {
  const safeDuration = Number.isFinite(durationSeconds) ? Math.max(0, Math.round(durationSeconds)) : 0;
  const map = await loadAnalyticsMap();
  const key = dayKeyFromDate(endedAt);
  const prev = map[key] ?? { visits: 0, sessionSeconds: 0, sessionCount: 0 };
  map[key] = {
    ...prev,
    sessionSeconds: prev.sessionSeconds + safeDuration,
    sessionCount: prev.sessionCount + 1,
  };
  await saveAnalyticsMap(map);
}

export async function getAnalyticsForRange(days: number) {
  const map = await loadAnalyticsMap();
  const now = new Date();
  const rows: Array<{ date: string; visits: number; sessionSeconds: number; sessionCount: number }> = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = map[key] ?? { visits: 0, sessionSeconds: 0, sessionCount: 0 };
    rows.push({ date: key, ...row });
  }
  return rows;
}

