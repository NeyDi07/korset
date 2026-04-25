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

  const noImg = all.filter(p => !p.image_url || p.image_url.trim() === '');
  const deadUrl = all.filter(p => p.image_url && p.image_url.trim() !== '' && !p.image_url.includes('cdn.korset.app'));
  
  console.log(`Total: ${all.length}, No image: ${noImg.length}, Dead URL: ${deadUrl.length}\n`);
  
  if (noImg.length > 0) {
    console.log('=== NO IMAGE ===');
    noImg.forEach(p => {
      const hasIng = p.ingredients_raw && p.ingredients_raw.trim() !== '';
      console.log(`${p.ean} | ${p.source_primary} | ing=${hasIng ? 'Y' : 'N'} | ${(p.name||'').substring(0,55)}`);
    });
  }
})();
