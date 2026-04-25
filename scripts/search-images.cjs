require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PRODUCTS = [
  { ean: 'kaspi_100222548', name: 'Milka шоколадная плитка молочный печенье 300г', search: 'Milka шоколад печенье 300г' },
  { ean: 'kaspi_102991689', name: 'Ritter Sport шоколадная плитка молочный клубника', search: 'Ritter Sport клубника шоколад' },
  { ean: 'kaspi_101152947', name: 'Ritter Sport Мята шоколадная плитка темный 100г', search: 'Ritter Sport мята темный шоколад' },
  { ean: '4690329009899', name: 'ШОКОЛАД OZERA WHITE EXTRA ALMOLD 90ГР', search: 'Озера шоколад белый миндаль' },
  { ean: '4000417222008', name: 'ШОКОЛАД RITTER SPORT ЛЕСНОЙ ОРЕХ 100ГР', search: 'Ritter Sport лесной орех 100г' },
  { ean: 'kaspi_102219552', name: 'Победа 72% какао Stevia шоколад горький', search: 'Победа шоколад стевия 72%' },
  { ean: 'kaspi_101152586', name: 'Ritter Sport Кокос шоколадная плитка молочный 100', search: 'Ritter Sport кокос молочный' },
  { ean: '4607025392408', name: 'Кефир Веселый молочник 1000гр', search: 'Веселый молочник кефир 1000г' },
  { ean: '850027880341', name: 'Mr. Beast Feastables Cranch Bars молочный 60г', search: 'Feastables Mr Beast шоколад' },
  { ean: '0796554251820', name: 'Alma Chocolates Dzen белый матча 90г', search: 'Alma Chocolates Dzen матча' },
  { ean: '4810067104308', name: 'Спартак Шоколад взрывной микс 95г', search: 'Спартак шоколад взрывной микс' },
  { ean: '4810067104193', name: 'Спартак горький-элитный 99% 95г', search: 'Спартак шоколад 99%' },
  { ean: '0796554251875', name: 'Alma Chocolates Nomads Sweets молочный тарын', search: 'Alma Chocolates Nomads Sweets' },
  { ean: '3800020453414', name: 'KITKAT CHUNKY молочный 64г', search: 'KitKat Chunky молочный 64г' },
  { ean: '4631151088423', name: 'LIBERTAD молочный жареный фундук 80г', search: 'Libertad шоколад фундук' },
  { ean: '4660013941064', name: 'ПОБЕДА ПЛИТКА ТЕМНАЯ 90ГР', search: 'Победа шоколад темная плитка 90г' },
  { ean: '796554251851', name: 'ALMA CHOCOLATES NOMADS SWEETS темный курт', search: 'Alma Chocolates Nomad курт' },
  { ean: 'kaspi_147393373', name: 'Ritter Sport Ванильный рогалик', search: 'Ritter Sport ванильный рогалик' },
  { ean: '0726529216301', name: 'Alma Chocolates Dzen белый матча манго', search: 'Alma Chocolates Dzen манго' },
  { ean: '3800020491577', name: 'KitKat молочный и темный 45г', search: 'KitKat молочный темный вафля' },
  { ean: '0796554251981', name: 'Alma Chocolates Dzen белый матча малина', search: 'Alma Chocolates Dzen малина' },
  { ean: '4000415744106', name: 'SCHOGETTEN Its Time Almond Crunch 100г', search: 'Schogetten Almond Crunch шоколад' },
  { ean: '4680046980090', name: 'natures own factory гречишный чай малина 250мл', search: 'natures own factory гречишный чай' },
  { ean: 'kaspi_130641741', name: 'NA MEDU молочный классический 70г', search: 'На меду шоколад классический' },
  { ean: 'kaspi_130641722', name: 'NA MEDU темный овсяный 70г', search: 'На меду шоколад овсяный' },
  { ean: '4630300710420', name: 'Конфеты А4 Тренди-стик 53г', search: 'А4 Тренди-стик конфеты' },
  { ean: 'kaspi_144858954', name: 'Milka Lotus Biscoff 90г', search: 'Milka Lotus Biscoff шоколад' },
  { ean: '0726529216318', name: 'Alma Chocolates Dzen белый матча чиа', search: 'Alma Chocolates Dzen чиа' },
  { ean: 'kaspi_156486376', name: 'Ritter Sport вафля и какао-мусс', search: 'Ritter Sport вафля какао мусс' },
  { ean: '4680013873776', name: 'ПАСТИЛА СИБИРСКИЙ КЕДР БРУСНИЧНАЯ 100Г', search: 'Сибирский кедр пастила брусника' },
  { ean: '4640047112326', name: 'NA MEDU Гурмэ Молочный 46% Латте 70г', search: 'На меду гурмэ латте шоколад' },
  { ean: '0796554251998', name: 'Alma Chocolates Dzen белый матча кокос', search: 'Alma Chocolates Dzen кокос' },
  { ean: '4631160077487', name: 'Kids Libertad Овсяный шоколад без сахара', search: 'Libertad Kids овсяный шоколад' },
  { ean: '4810067080947', name: 'Шоколад Спартак молочный 500гр', search: 'Спартак шоколад молочный 500г' },
  { ean: 'kaspi_159519333', name: 'Сибирский кедр шоколад манго кокос 100г', search: 'Сибирский кедр шоколад манго' },
  { ean: '4631143053996', name: 'natures own factory молочный шоколад гречишный чай', search: 'natures own factory шоколад чай' },
  { ean: 'kaspi_130746930', name: 'NA MEDU 46% молочный 45г', search: 'На меду шоколад 46% 45г' },
  { ean: 'arbuz_340755', name: 'Тортилья Tandoor оливки орегано 390г', search: 'Tandoor тортилья оливки орегано' },
  { ean: 'arbuz_340753', name: 'Тортилья Tandoor цельнозерновая 390г', search: 'Tandoor тортилья цельнозерновая' },
  { ean: 'arbuz_340751', name: 'Тортилья Tandoor протеиновая 390г', search: 'Tandoor тортилья протеиновая' },
  { ean: 'arbuz_340754', name: 'Тортилья Tandoor кукурузная 390г', search: 'Tandoor тортилья кукурузная' },
  { ean: 'kaspi_139323177', name: 'Победа Пористый 72% без сахара', search: 'Победа пористый 72% стевия' },
  { ean: 'kaspi_130690423', name: 'Gagarinsky На меду горький апельсин', search: 'Gagarinsky На меду апельсин' },
  { ean: 'kaspi_132738833', name: 'Bucheron Горький с апельсином', search: 'Bucheron шоколад апельсин' },
  { ean: 'kaspi_130648258', name: 'NA MEDU классический 37% белый', search: 'На меду белый шоколад классический' },
  { ean: 'kaspi_152662456', name: 'Ritter Sport Яркая коллекция Mini', search: 'Ritter Sport Mini яркая коллекция' },
];

// First try OpenFoodFacts for products with real EANs
async function searchOFF(ean) {
  try {
    const cleanEan = ean.replace(/^(arbuz_|kaspi_|korzinavdom_)/, '');
    if (!/^\d{8,13}$/.test(cleanEan)) return null;
    const url = `https://world.openfoodfacts.org/api/v0/product/${cleanEan}.json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Korset/1.0' } });
    const data = await res.json();
    if (data.status === 1 && data.product?.image_url) {
      return { source: 'openfoodfacts', url: data.product.image_url };
    }
  } catch {}
  return null;
}

// Try searching OFF by name
async function searchOFFByName(name) {
  try {
    const q = encodeURIComponent(name.substring(0, 40));
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&json=1&page_size=5`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Korset/1.0' } });
    const data = await res.json();
    if (data.products?.length > 0) {
      for (const p of data.products) {
        if (p.image_url) return { source: 'openfoodfacts', url: p.image_url };
      }
    }
  } catch {}
  return null;
}

// Try Kaspi shop search for Kaspi-sourced products
async function searchKaspi(name) {
  try {
    const q = encodeURIComponent(name.substring(0, 50));
    const url = `https://kaspi.kz/shop/search/?q=${q}`;
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const imgMatch = html.match(/https:\/\/resources\.cdn-kaspi\.kz\/img\/m\/p\/[^\s"'<>]+/);
    if (imgMatch) return { source: 'kaspi', url: imgMatch[0] };
  } catch {}
  return null;
}

async function main() {
  const results = [];
  let found = 0;
  
  for (const p of PRODUCTS) {
    let result = null;
    
    // Try OFF by EAN first
    if (/^\d{8,13}$/.test(p.ean)) {
      result = await searchOFF(p.ean);
      if (result) console.log(`[OFF-EAN] ${p.ean}: ${result.url.substring(0, 80)}`);
    }
    
    // Try OFF by name
    if (!result) {
      result = await searchOFFByName(p.name);
      if (result) console.log(`[OFF-NAME] ${p.ean}: ${result.url.substring(0, 80)}`);
    }
    
    if (result) {
      found++;
      results.push({ ean: p.ean, ...result });
    } else {
      console.log(`[MISS] ${p.ean}: ${p.name.substring(0, 40)}`);
      results.push({ ean: p.ean, source: null, url: null });
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log(`\nFound: ${found}/${PRODUCTS.length}`);
  
  const outPath = path.join(__dirname, '..', 'data', 'image-search-results.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Saved to ${outPath}`);
}

main();
