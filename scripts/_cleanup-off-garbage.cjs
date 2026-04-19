const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://tcvuffoxwavqdexrzwjj.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdnVmZm94d2F2cWRleHJ6d2pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5NjUwNCwiZXhwIjoyMDg4ODcyNTA0fQ.zZHv0-UxZiJoroV2hzSByhnu3NfbjAhim10LQtgmDjs";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BATCH = 200;

async function main() {
  console.log("=== OFF Garbage Cleanup ===\n");

  // 1. Count garbage global_products
  const { count: garbageCount, error: countErr } = await supabase
    .from("global_products")
    .select("id", { count: "exact", head: true })
    .eq("source_primary", "openfoodfacts")
    .or("name.is.null,name.eq.,brand.is.null,brand.eq.,image_url.is.null");

  if (countErr) {
    console.error("Count error:", countErr);
    return;
  }
  console.log(`Garbage global_products (OFF, no name/brand/image): ${garbageCount}`);

  if (garbageCount === 0) {
    console.log("Nothing to delete. Done.");
    return;
  }

  // 2. Fetch IDs in batches (supabase-js doesn't support delete+return for large sets well)
  let allIds = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("global_products")
      .select("id")
      .eq("source_primary", "openfoodfacts")
      .or("name.is.null,name.eq.,brand.is.null,brand.eq.,image_url.is.null")
      .range(offset, offset + BATCH - 1);

    if (error) {
      console.error("Fetch IDs error:", error);
      return;
    }
    if (!data || data.length === 0) break;
    allIds.push(...data.map((r) => r.id));
    offset += BATCH;
    if (data.length < BATCH) break;
  }

  console.log(`Fetched ${allIds.length} garbage IDs\n`);

  // 3. Delete orphaned store_products in batches
  let spDeleted = 0;
  for (let i = 0; i < allIds.length; i += BATCH) {
    const batch = allIds.slice(i, i + BATCH);
    const { count, error: spErr } = await supabase
      .from("store_products")
      .delete({ count: "exact" })
      .in("global_product_id", batch);
    if (spErr) {
      console.error("store_products delete error:", spErr);
    } else {
      spDeleted += count || 0;
    }
  }
  console.log(`Deleted store_products: ${spDeleted}`);

  // 4. Delete garbage global_products in batches
  let gpDeleted = 0;
  for (let i = 0; i < allIds.length; i += BATCH) {
    const batch = allIds.slice(i, i + BATCH);
    const { count, error: gpErr } = await supabase
      .from("global_products")
      .delete({ count: "exact" })
      .in("id", batch);
    if (gpErr) {
      console.error("global_products delete error:", gpErr);
    } else {
      gpDeleted += count || 0;
    }
  }
  console.log(`Deleted global_products: ${gpDeleted}`);

  // 5. Final totals
  const { count: gpTotal } = await supabase
    .from("global_products")
    .select("id", { count: "exact", head: true });

  const { count: spTotal } = await supabase
    .from("store_products")
    .select("id", { count: "exact", head: true });

  console.log("\n=== Summary ===");
  console.log(`global_products  deleted: ${gpDeleted}  |  remaining: ${gpTotal}`);
  console.log(`store_products   deleted: ${spDeleted}  |  remaining: ${spTotal}`);
}

main().catch(console.error);
