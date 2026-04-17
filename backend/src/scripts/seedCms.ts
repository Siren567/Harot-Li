import { getSupabaseAdminClient } from "../supabase/client.js";

async function run() {
  const sb = getSupabaseAdminClient();
  // Intentionally no demo content/products. Keep only baseline setting row.
  const { error: settingsError } = await sb
    .from("site_settings")
    .upsert([{ key: "announcement", value: { isVisible: false, text: "", link: "#" } }], { onConflict: "key" });
  if (settingsError) throw settingsError;
  console.log("CMS seed completed (no demo data inserted)");
}

run().catch((error) => {
  console.error("CMS seed failed:", error);
  process.exit(1);
});

