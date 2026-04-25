require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  let all = [];
  let from = 0;
  while (from < 10000) {
    const { data } = await c.from('global_products')
      .select('id, ean, name, ingredients_raw, source_primary, image_url')
      .eq('is_active', true)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    from += 1000;
  }

  const seen = new Set();
  const unique = all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

  const dead = unique.filter(p => p.image_url && p.image_url.includes('cdn-kaspi.kz'));
  const noImg = unique.filter(p => !p.image_url || p.image_url.trim() === '');

  console.log(`=== KASPI DEAD URL (${dead.length}) ===`);
  dead.forEach(p => console.log(`${p.ean}|${p.source_primary}|${(p.name||'').substring(0,50)}`));

  console.log(`\n=== NO IMAGE (${noImg.length}) ===`);
  noImg.forEach(p => {
    const hasIng = p.ingredients_raw && p.ingredients_raw.trim() !== '';
    console.log(`${p.ean}|${p.source_primary}|ing=${hasIng?'Y':'N'}|${(p.name||'').substring(0,55)}`);
  });
})();
