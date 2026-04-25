require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const SLEEP = 1500;

async function searchOFF(ean, query) {
  // Try by barcode first
  const cleanEan = ean.replace(/^(arbuz_|kaspi_|korzinavdom_)/, '');
  if (/^\d{8,13}$/.test(cleanEan)) {
    try {
      const url = `https://world.openfoodfacts.org/api/v0/product/${cleanEan}.json`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Korset/1.0' } });
      const data = await res.json();
      if (data.status === 1 && data.product?.image_url) {
        return { source: 'off-ean', url: data.product.image_url, name: data.product.product_name };
      }
    } catch {}
    await new Promise(r => setTimeout(r, SLEEP));
  }
  
  // Try by name
  if (query) {
    try {
      const q = encodeURIComponent(query);
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&json=1&page_size=3`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Korset/1.0' } });
      const data = await res.json();
      if (data.products) {
        for (const p of data.products) {
          if (p.image_url) return { source: 'off-name', url: p.image_url, name: p.product_name };
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, SLEEP));
  }
  
  return null;
}

const PRODUCTS = [
  { ean: 'kaspi_101152586', query: 'Ritter Sport kokos' },
  { ean: 'kaspi_147393373', query: 'Ritter Sport vanille' },
  { ean: 'kaspi_156486376', query: 'Ritter Sport waffel kakao' },
  { ean: 'kaspi_152662456', query: 'Ritter Sport mini mix' },
  { ean: 'kaspi_100222548', query: 'Milka keks schokolade' },
  { ean: 'kaspi_144858954', query: 'Milka Biscoff' },
  { ean: 'kaspi_102219552', query: 'Pobeda stevia chocolate' },
  { ean: '4810067104308', query: 'Spartak chocolate explosion' },
  { ean: '4810067104193', query: 'Spartak 99 percent' },
  { ean: '4810067080947', query: 'Spartak milk 500g' },
  { ean: '0796554251875', query: 'Alma Chocolates nomad' },
  { ean: '0796554251998', query: 'Alma Chocolates coconut' },
  { ean: '0726529216301', query: 'Alma Chocolates mango matcha' },
  { ean: '0726529216318', query: 'Alma Chocolates chia matcha' },
  { ean: '796554251851', query: 'Alma Chocolates nomad kurt' },
  { ean: '3800020453414', query: 'KitKat chunky' },
  { ean: '3800020491577', query: 'KitKat dark' },
  { ean: '4607025392408', query: 'Veselyj molochnik' },
  { ean: '4000415744106', query: 'Schogetten almond crunch' },
  { ean: '4680046980090', query: 'natures own factory' },
  { ean: '4680013873776', query: 'Sibirskiy kedr pastila' },
  { ean: 'kaspi_159519333', query: 'Sibirskiy kedr mango' },
  { ean: '4631143053996', query: 'natures own factory chocolate buckwheat' },
  { ean: 'kaspi_130641741', query: 'Na medu chocolate' },
  { ean: 'kaspi_130641722', query: 'Na medu dark oat' },
  { ean: 'kaspi_130746930', query: 'Na medu 46' },
  { ean: 'kaspi_130648258', query: 'Na medu white' },
  { ean: '4640047112326', query: 'Na medu latte' },
  { ean: 'kaspi_132738833', query: 'Bucheron chocolate orange' },
  { ean: 'kaspi_130690423', query: 'Gagarinsky chocolate' },
  { ean: 'kaspi_139323177', query: 'Pobeda porous' },
  { ean: '4630300710420', query: 'A4 trendy stick candy' },
];

async function main() {
  const resultsFile = path.join(__dirname, '..', 'data', 'image-search-results.json');
  const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  const existing = new Map(results.map(r => [r.ean, r]));

  let newFound = 0;

  for (const p of PRODUCTS) {
    if (existing.get(p.ean)?.url) { console.log(`[SKIP] ${p.ean} already has image`); continue; }

    const result = await searchOFF(p.ean, p.query);
    if (result) {
      console.log(`[FOUND] ${p.ean}: ${result.name?.substring(0,30)} → ${result.url.substring(0, 70)}`);
      existing.set(p.ean, { ean: p.ean, source: result.source, url: result.url });
      newFound++;
    } else {
      console.log(`[MISS] ${p.ean} (${p.query})`);
    }
  }

  console.log(`\nNew found: ${newFound}`);
  const totalFound = [...existing.values()].filter(r => r.url).length;
  console.log(`Total found: ${totalFound}`);

  fs.writeFileSync(resultsFile, JSON.stringify([...existing.values()], null, 2));
}

main();
