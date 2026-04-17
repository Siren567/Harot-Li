import { createProduct } from "../services/products.service.js";
import { getSupabaseAdminClient } from "../supabase/client.js";

async function existsBySlug(slug: string) {
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb.from("products").select("id").eq("slug", slug).limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function main() {
  const desiredSlug = "demo-product-1";
  const already = await existsBySlug(desiredSlug);
  if (already) {
    console.log(`Product already exists: slug=${desiredSlug}`);
    return;
  }

  const product = await createProduct({
    title: "מוצר דמו ראשון",
    slug: desiredSlug,
    price: 14900,
    image_url: "https://images.pexels.com/photos/10983791/pexels-photo-10983791.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop",
    is_active: true,
    available_colors: ["זהב", "כסף", "שחור מט", "רוז גולד"],
    pendant_types: ["לב", "עיגול", "ריבוע", "מלבן ארוך"],
    allow_customer_image_upload: true,
    gallery_images: [],
    main_category_id: null,
    subcategory_ids: [],
  });

  console.log("Seeded product:", { id: product.id, title: product.title, slug: product.slug });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

