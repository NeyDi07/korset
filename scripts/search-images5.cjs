require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function tryFetchImage(name, urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        method: 'HEAD'
      });
      if (res.ok) {
        const ct = res.headers.get('content-type');
        if (ct && (ct.includes('image') || ct.includes('octet-stream'))) {
          return url;
        }
      }
    } catch {}
  }
  return null;
}

async function searchOFFCategory(brand, subcategory) {
  try {
    const q = encodeURIComponent(`${brand} ${subcategory}`);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&tagtype_0=categories&tag_contains_0=contains&tag_0=chocolates&json=1&page_size=10`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Korset/1.0' } });
    const data = await res.json();
    return (data.products || []).filter(p => p.image_url);
  } catch { return []; }
}

async function main() {
  const results = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'image-search-results.json'), 'utf8'));
  const existing = new Map(results.map(r => [r.ean, r]));

  let newFound = 0;

  // Brand-specific OFF searches with broader terms
  const searches = [
    // Ritter Sport variants
    { ean: 'kaspi_101152947', query: 'Ritter Sport minze' },
    { ean: 'kaspi_101152586', query: 'Ritter Sport kokos' },
    { ean: 'kaspi_147393373', query: 'Ritter Sport vanille' },
    { ean: 'kaspi_156486376', query: 'Ritter Sport waffel' },
    { ean: 'kaspi_152662456', query: 'Ritter Sport mini' },
    { ean: '4000417222008', query: 'Ritter Sport haselnuss' },  // has existing OFF image but double check
    
    // Milka
    { ean: 'kaspi_100222548', query: 'Milka keks' },
    { ean: 'kaspi_144858954', query: 'Milka Biscoff' },
    
    // Победа
    { ean: 'kaspi_102219552', query: 'Pobeda stevia' },
    { ean: 'kaspi_139323177', query: 'Pobeda porous' },
    { ean: '4660013941064', query: 'Pobeda dark chocolate' },
    
    // Спартак
    { ean: '4810067104308', query: 'Spartak chocolate mix' },
    { ean: '4810067104193', query: 'Spartak 99 chocolate' },
    { ean: '4810067080947', query: 'Spartak milk chocolate' },
    
    // Alma Chocolates
    { ean: '0796554251820', query: 'Alma Chocolates dzen matcha' },
    { ean: '0796554251875', query: 'Alma Chocolates nomad' },
    { ean: '0796554251981', query: 'Alma Chocolates dzen raspberry' },
    { ean: '0796554251998', query: 'Alma Chocolates dzen coconut' },
    { ean: '0726529216301', query: 'Alma Chocolates dzen mango' },
    { ean: '0726529216318', query: 'Alma Chocolates dzen chia' },
    { ean: '796554251851', query: 'Alma Chocolates nomad kurt' },
    
    // KitKat
    { ean: '3800020453414', query: 'KitKat chunky' },
    { ean: '3800020491577', query: 'KitKat dark' },
    
    // Others
    { ean: '4607025392408', query: 'Veselyj molochnik kefir' },
    { ean: '4631151088423', query: 'Libertad chocolate hazelnut' },
    { ean: '4000415744106', query: 'Schogetten almond' },
    { ean: '4631160077487', query: 'Libertad kids oat' },
    { ean: '4630300710420', query: 'A4 trendy candy' },
    { ean: '4680046980090', query: 'natures own factory tea' },
    { ean: '4631143053996', query: 'natures own factory buckwheat' },
    
    // Сибирский кедр
    { ean: '4680013873776', query: 'Sibirskiy kedr pastila' },
    { ean: 'kaspi_159519333', query: 'Sibirskiy kedr chocolate mango' },
    
    // NA MEDU / На меду
    { ean: 'kaspi_130641741', query: 'Na medu milk chocolate' },
    { ean: 'kaspi_130641722', query: 'Na medu dark oat' },
    { ean: 'kaspi_130746930', query: 'Na medu 46' },
    { ean: 'kaspi_130648258', query: 'Na medu white chocolate' },
    { ean: '4640047112326', query: 'Na medu latte' },
    
    // Bucheron / Gagarinsky
    { ean: 'kaspi_132738833', query: 'Bucheron orange chocolate' },
    { ean: 'kaspi_130690423', query: 'Gagarinsky chocolate orange' },
    
    // Tandoor
    { ean: 'arbuz_340755', query: 'Tandoor tortilla olive' },
    { ean: 'arbuz_340753', query: 'Tandoor whole wheat tortilla' },
    { ean: 'arbuz_340751', query: 'Tandoor protein tortilla' },
    { ean: 'arbuz_340754', query: 'Tandoor corn tortilla' },
  ];

  for (const s of searches) {
    if (existing.get(s.ean)?.url) continue;

    try {
      const q = encodeURIComponent(s.query);
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&json=1&page_size=5`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Korset/1.0' } });
      const data = await res.json();
      
      let found = false;
      if (data.products) {
        for (const p of data.products) {
          if (p.image_url) {
            console.log(`[OFF] ${s.ean}: ${p.product_name?.substring(0,30)} → ${p.image_url.substring(0, 70)}`);
            existing.set(s.ean, { ean: s.ean, source: 'openfoodfacts', url: p.image_url });
            newFound++;
            found = true;
            break;
          }
        }
      }
      if (!found) console.log(`[MISS] ${s.ean} (${s.query})`);
    } catch (e) {
      console.log(`[ERR] ${s.ean}`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nNew found: ${newFound}`);
  const totalFound = [...existing.values()].filter(r => r.url).length;
  console.log(`Total found: ${totalFound}`);

  fs.writeFileSync(
    path.join(__dirname, '..', 'data', 'image-search-results.json'),
    JSON.stringify([...existing.values()], null, 2)
  );
}

main();
