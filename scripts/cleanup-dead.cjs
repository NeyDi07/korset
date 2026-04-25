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

  // Deduplicate by id
  const seen = new Set();
  const unique = all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

  const toDelete = new Set();

  // 1. Unsplash
  unique.filter(p => p.image_url && p.image_url.includes('unsplash.com')).forEach(p => toDelete.add(p.id));

  // 2. Local paths
  unique.filter(p => p.image_url && p.image_url.startsWith('/products/')).forEach(p => toDelete.add(p.id));

  // 3. No image + no ingredients (garbage)
  unique.filter(p => (!p.image_url || p.image_url.trim() === '') && (!p.ingredients_raw || p.ingredients_raw.trim() === '')).forEach(p => toDelete.add(p.id));

  // 4. Non-food products
  const nonFood = ['Наушники', 'Водка', 'Адвент календарь', 'Книга'];
  unique.filter(p => nonFood.some(k => (p.name || '').includes(k))).forEach(p => toDelete.add(p.id));

  console.log(`Products to deactivate: ${toDelete.size}`);

  // Show what we're deleting
  const deleting = unique.filter(p => toDelete.has(p.id));
  const reasons = {};
  deleting.forEach(p => {
    let reason = '';
    if (p.image_url && p.image_url.includes('unsplash.com')) reason = 'unsplash';
    else if (p.image_url && p.image_url.startsWith('/products/')) reason = 'local_path';
    else if (!p.image_url || p.image_url.trim() === '') reason = 'no_img_no_ing';
    else reason = 'non_food';
    reasons[reason] = (reasons[reason] || 0) + 1;
    console.log(`  [${reason}] ${p.ean} | ${(p.name||'').substring(0,50)}`);
  });
  console.log('\nBy reason:', JSON.stringify(reasons));

  // Confirm before deleting
  if (process.argv.includes('--yes')) {
    const ids = [...toDelete];
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const { error } = await c.from('global_products').update({ is_active: false }).in('id', batch);
      if (error) console.error('Error:', error.message);
      else console.log(`Deactivated batch ${i}-${i + batch.length - 1}`);
    }
    console.log(`Done. Deactivated ${toDelete.size} products.`);
  } else {
    console.log('\nRun with --yes to actually deactivate.');
  }
})();
