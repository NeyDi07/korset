require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SEARCH_MAP = {
  '4607025392408': 'Веселый молочник кефир',
  '0796554251820': 'Alma Dzen',
  '4810067104308': 'Спартак шоколад',
  '4810067104193': 'Спартак горький элитный',
  '0796554251875': 'Alma Nomad',
  '3800020453414': 'KitKat Chunky',
  '4631151088423': 'Libertad шоколад',
  '796554251851': 'Alma Nomad',
  '0726529216301': 'Alma Dzen',
  '3800020491577': 'KitKat',
  '0796554251981': 'Alma Dzen',
  '4000415744106': 'Schogetten',
  '4680046980090': 'natures own factory',
  '4630300710420': 'А4 конфеты',
  '0726529216318': 'Alma Dzen',
  '4680013873776': 'Сибирский кедр пастила',
  '4640047112326': 'На меду гурмэ',
  '0796554251998': 'Alma Dzen кокос',
  '4631160077487': 'Libertad kids',
  '4810067080947': 'Спартак шоколад 500',
  '4631143053996': 'natures own factory шоколад',
};

async function searchKorzinavdom(query, page = 0) {
  try {
    const q = encodeURIComponent(query);
    const url = `https://api.korzinavdom.kz/client/showcases?searchString=${q}&size=20&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.content || [];
  } catch { return []; }
}

async function main() {
  const results = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'image-search-results.json'), 'utf8'));
  const existing = new Map(results.map(r => [r.ean, r]));

  let newFound = 0;

  for (const [ean, query] of Object.entries(SEARCH_MAP)) {
    if (existing.get(ean)?.url) continue;

    const products = await searchKorzinavdom(query);
    
    for (const p of products) {
      if (!p.imageUrl) continue;
      const imgUrl = p.imageUrl.startsWith('http') ? p.imageUrl : `https://data.korzinavdom.kz${p.imageUrl}`;
      console.log(`[KORZ] ${ean} → ${p.name?.substring(0,50)}: ${imgUrl.substring(0, 80)}`);
      existing.set(ean, { ean, source: 'korzinavdom', url: imgUrl });
      newFound++;
      break;
    }

    if (!existing.get(ean)?.url) {
      console.log(`[MISS] ${ean} (${query})`);
    }

    await new Promise(r => setTimeout(r, 400));
  }

  // Also try OFF name search for brands that Korzinavdom doesn't have
  const offSearches = {
    'kaspi_100222548': 'Milka chocolate cookie',
    'kaspi_102991689': 'Ritter Sport strawberry',
    'kaspi_101152947': 'Ritter Sport mint',
    'kaspi_101152586': 'Ritter Sport coconut',
    'kaspi_102219552': 'Pobeda stevia chocolate',
    'kaspi_147393373': 'Ritter Sport vanilla',
    'kaspi_144858954': 'Milka Lotus Biscoff',
    'kaspi_156486376': 'Ritter Sport wafer',
    'kaspi_130641741': 'Na Medu chocolate classic',
    'kaspi_130641722': 'Na Medu dark oat',
    'kaspi_130746930': 'Na Medu 46',
    'kaspi_159519333': 'Sibirskiy kedr chocolate mango',
    'kaspi_139323177': 'Pobeda porous 72',
    'kaspi_130690423': 'Gagarinsky chocolate orange',
    'kaspi_132738833': 'Bucheron chocolate orange',
    'kaspi_130648258': 'Na Medu white chocolate',
    'kaspi_152662456': 'Ritter Sport mini mix',
  };

  for (const [ean, query] of Object.entries(offSearches)) {
    if (existing.get(ean)?.url) continue;

    try {
      const q = encodeURIComponent(query);
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&json=1&page_size=3`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Korset/1.0' } });
      const data = await res.json();
      if (data.products?.length > 0 && data.products[0].image_url) {
        console.log(`[OFF-NAME] ${ean}: ${data.products[0].image_url.substring(0, 80)}`);
        existing.set(ean, { ean, source: 'openfoodfacts', url: data.products[0].image_url });
        newFound++;
      } else {
        console.log(`[MISS] ${ean} (${query})`);
      }
    } catch { console.log(`[ERR] ${ean}`); }

    await new Promise(r => setTimeout(r, 300));
  }

  // Arbuz tortillas — try korzinavdom
  const arbuzTortillas = {
    'arbuz_340755': 'тортилья оливки',
    'arbuz_340753': 'тортилья цельнозерновая',
    'arbuz_340751': 'тортилья протеиновая',
    'arbuz_340754': 'тортилья кукурузная',
  };

  for (const [ean, query] of Object.entries(arbuzTortillas)) {
    if (existing.get(ean)?.url) continue;
    const products = await searchKorzinavdom(query);
    for (const p of products) {
      if (!p.imageUrl) continue;
      if (p.name && (p.name.toLowerCase().includes('тортилл') || p.name.toLowerCase().includes('лепёшк') || p.name.toLowerCase().includes('tandoor'))) {
        const imgUrl = p.imageUrl.startsWith('http') ? p.imageUrl : `https://data.korzinavdom.kz${p.imageUrl}`;
        console.log(`[KORZ] ${ean} → ${p.name?.substring(0,40)}: ${imgUrl.substring(0, 80)}`);
        existing.set(ean, { ean, source: 'korzinavdom', url: imgUrl });
        newFound++;
        break;
      }
    }
    if (!existing.get(ean)?.url) console.log(`[MISS] ${ean} (${query})`);
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\nNew found this round: ${newFound}`);
  const totalFound = [...existing.values()].filter(r => r.url).length;
  console.log(`Total found: ${totalFound}`);

  fs.writeFileSync(
    path.join(__dirname, '..', 'data', 'image-search-results.json'),
    JSON.stringify([...existing.values()], null, 2)
  );
}

main();
