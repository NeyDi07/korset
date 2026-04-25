require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const BATCH = 1000;
  let r2 = 0, from = 0;
  while (true) {
    const { data } = await c.from('global_products').select('id').like('image_url', '%cdn.korset.app%').eq('is_active', true).range(from, from + BATCH - 1);
    if (!data || data.length === 0) break;
    r2 += data.length; from += BATCH;
  }
  
  let noR2 = 0; from = 0;
  while (true) {
    const { data } = await c.from('global_products').select('id, image_url, source_primary').eq('is_active', true).not('image_url', 'like', '%cdn.korset.app%').neq('image_url', '').range(from, from + BATCH - 1);
    if (!data || data.length === 0) break;
    noR2 += data.length; from += BATCH;
  }
  
  let noImg = 0; from = 0;
  while (true) {
    const { data } = await c.from('global_products').select('id').eq('is_active', true).or('image_url.is.null,image_url.eq.').range(from, from + BATCH - 1);
    if (!data || data.length === 0) break;
    noImg += data.length; from += BATCH;
  }
  
  console.log(JSON.stringify({ r2_cdn: r2, non_r2: noR2, no_image: noImg, total: r2 + noR2 + noImg }, null, 2));
})();
