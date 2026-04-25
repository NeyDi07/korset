require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET || 'korset-images';
const CDN = process.env.R2_PUBLIC_URL || 'https://cdn.korset.app';

async function uploadToR2(key, body, contentType) {
  await R2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  return `${CDN}/${key}`;
}

function inferExt(url, ct) {
  if (ct?.includes('png')) return 'png';
  if (ct?.includes('webp')) return 'webp';
  if (url?.endsWith('.png')) return 'png';
  if (url?.endsWith('.webp')) return 'webp';
  return 'jpg';
}

async function main() {
  const results = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'image-search-results.json'), 'utf8'));
  const withUrl = results.filter(r => r.url);
  
  console.log(`Products with image URLs: ${withUrl.length}`);

  let ok = 0, fail = 0;

  for (const r of withUrl) {
    try {
      console.log(`Downloading ${r.ean}...`);
      const res = await fetch(r.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (!res.ok) { console.log(`  Download failed: ${res.status}`); fail++; continue; }
      
      const ct = res.headers.get('content-type') || '';
      const buf = Buffer.from(await res.arrayBuffer());
      
      if (buf.length < 500) { console.log(`  Too small: ${buf.length}B`); fail++; continue; }
      
      const ext = inferExt(r.url, ct);
      const r2Key = `products/${r.ean}/main.${ext}`;
      const publicUrl = await uploadToR2(r2Key, buf, ct || 'image/jpeg');
      
      // Update DB
      const { error } = await c.from('global_products')
        .update({ 
          image_url: publicUrl, 
          r2_key: r2Key, 
          image_source: 'openfoodfacts',
          original_image_url: r.url 
        })
        .eq('ean', r.ean)
        .eq('is_active', true);
      
      if (error) { console.log(`  DB error: ${error.message}`); fail++; }
      else { console.log(`  OK: ${publicUrl} (${(buf.length/1024).toFixed(1)}KB)`); ok++; }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
      fail++;
    }
    
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone: ${ok} uploaded, ${fail} failed`);
}

main();
