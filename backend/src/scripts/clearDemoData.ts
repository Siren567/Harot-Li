import { getSupabaseAdminClient } from "../supabase/client.js";

async function run() {
  const sb = getSupabaseAdminClient();

  // Delete child/related tables first
  const { error: topErr } = await sb.from("top_sellers").delete().not("id", "is", null);
  if (topErr) throw topErr;

  const { error: productsErr } = await sb.from("products").delete().not("id", "is", null);
  if (productsErr) throw productsErr;

  const { error: sectionsErr } = await sb.from("content_sections").delete().not("id", "is", null);
  if (sectionsErr) throw sectionsErr;

  const { error: legalErr } = await sb.from("legal_pages").delete().not("id", "is", null);
  if (legalErr) throw legalErr;

  // Keep site_settings rows but reset known demo-ish setting payloads
  const { error: settingsErr } = await sb
    .from("site_settings")
    .upsert([{ key: "announcement", value: { isVisible: false, text: "", link: "" } }], { onConflict: "key" });
  if (settingsErr) throw settingsErr;

  console.log("Demo storefront data cleared successfully");
}

run().catch((error) => {
  console.error("Failed to clear demo data:", error);
  process.exit(1);
});

