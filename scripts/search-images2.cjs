require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const MISSING = [
  { ean: 'kaspi_100222548', name: 'Milka шоколадная плитка молочный печенье 300г', brand: 'Milka' },
  { ean: 'kaspi_102991689', name: 'Ritter Sport шоколад молочный клубника', brand: 'Ritter Sport' },
  { ean: 'kaspi_101152947', name: 'Ritter Sport Мята темный 100г', brand: 'Ritter Sport' },
  { ean: 'kaspi_102219552', name: 'Победа 72% какао Stevia горький', brand: 'Победа' },
  { ean: 'kaspi_101152586', name: 'Ritter Sport Кокос молочный 100г', brand: 'Ritter Sport' },
  { ean: '4607025392408', name: 'Кефир Веселый молочник 1000гр', brand: 'Веселый молочник' },
  { ean: '0796554251820', name: 'Alma Chocolates Dzen белый матча 90г', brand: 'Alma Chocolates' },
  { ean: '4810067104308', name: 'Спартак Шоколад взрывной микс 95г', brand: 'Спартак' },
  { ean: '4810067104193', name: 'Спартак горький-элитный 99% 95г', brand: 'Спартак' },
  { ean: '0796554251875', name: 'Alma Chocolates Nomads Sweets тарын', brand: 'Alma Chocolates' },
  { ean: '3800020453414', name: 'KITKAT CHUNKY молочный 64г', brand: 'KitKat' },
  { ean: '4631151088423', name: 'LIBERTAD молочный жареный фундук 80г', brand: 'Libertad' },
  { ean: '796554251851', name: 'ALMA CHOCOLATES NOMADS SWEETS темный курт', brand: 'Alma Chocolates' },
  { ean: 'kaspi_147393373', name: 'Ritter Sport Ванильный рогалик', brand: 'Ritter Sport' },
  { ean: '0726529216301', name: 'Alma Chocolates Dzen белый матча манго', brand: 'Alma Chocolates' },
  { ean: '3800020491577', name: 'KitKat молочный и темный 45г', brand: 'KitKat' },
  { ean: '0796554251981', name: 'Alma Chocolates Dzen белый матча малина', brand: 'Alma Chocolates' },
  { ean: '4000415744106', name: 'SCHOGETTEN Its Time Almond Crunch 100г', brand: 'Schogetten' },
  { ean: '4680046980090', name: 'natures own factory гречишный чай малина 250мл', brand: 'Natures Own Factory' },
  { ean: 'kaspi_130641741', name: 'NA MEDU молочный классический 70г', brand: 'NA MEDU' },
  { ean: 'kaspi_130641722', name: 'NA MEDU темный овсяный 70г', brand: 'NA MEDU' },
  { ean: '4630300710420', name: 'Конфеты А4 Тренди-стик 53г', brand: 'А4' },
  { ean: 'kaspi_144858954', name: 'Milka Lotus Biscoff 90г', brand: 'Milka' },
  { ean: '0726529216318', name: 'Alma Chocolates Dzen белый матча чиа', brand: 'Alma Chocolates' },
  { ean: 'kaspi_156486376', name: 'Ritter Sport вафля и какао-мусс', brand: 'Ritter Sport' },
  { ean: '4680013873776', name: 'ПАСТИЛА СИБИРСКИЙ КЕДР БРУСНИЧНАЯ 100Г', brand: 'Сибирский кедр' },
  { ean: '4640047112326', name: 'NA MEDU Гурмэ Молочный 46% Латте 70г', brand: 'NA MEDU' },
  { ean: '0796554251998', name: 'Alma Chocolates Dzen белый матча кокос', brand: 'Alma Chocolates' },
  { ean: '4631160077487', name: 'Kids Libertad Овсяный шоколад без сахара', brand: 'Libertad' },
  { ean: '4810067080947', name: 'Шоколад Спартак молочный 500гр', brand: 'Спартак' },
  { ean: 'kaspi_159519333', name: 'Сибирский кедр шоколад манго кокос 100г', brand: 'Сибирский кедр' },
  { ean: 'kaspi_130746930', name: 'NA MEDU 46% молочный 45г', brand: 'NA MEDU' },
  { ean: 'arbuz_340755', name: 'Тортилья Tandoor оливки орегано 390г', brand: 'Tandoor' },
  { ean: 'arbuz_340753', name: 'Тортилья Tandoor цельнозерновая 390г', brand: 'Tandoor' },
  { ean: 'arbuz_340751', name: 'Тортилья Tandoor протеиновая 390г', brand: 'Tandoor' },
  { ean: 'arbuz_340754', name: 'Тортилья Tandoor кукурузная 390г', brand: 'Tandoor' },
  { ean: 'kaspi_139323177', name: 'Победа Пористый 72% без сахара', brand: 'Победа' },
  { ean: 'kaspi_130690423', name: 'Gagarinsky На меду горький апельсин', brand: 'Gagarinsky' },
  { ean: 'kaspi_132738833', name: 'Bucheron Горький с апельсином', brand: 'Bucheron' },
  { ean: 'kaspi_130648258', name: 'NA MEDU классический 37% белый', brand: 'NA MEDU' },
  { ean: 'kaspi_152662456', name: 'Ritter Sport Яркая коллекция Mini', brand: 'Ritter Sport' },
];

async function searchKaspiShop(name) {
  try {
    const q = encodeURIComponent(name.substring(0, 60));
    const url = `https://kaspi.kz/shop/search/?q=${q}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0',
        'Accept': 'text/html',
        'Accept-Language': 'ru-RU,ru;q=0.9',
      }
    });
    const html = await res.text();
    // Kaspi uses data in script tags or JSON. Try to find product image URLs
    const imgUrls = [];
    const re = /https:\/\/media\.kaspi\.kz\/[^\s"'<>)]+\.jpg/g;
    let m;
    while ((m = re.exec(html)) !== null) imgUrls.push(m[0]);
    
    const re2 = /https:\/\/resources\.cdn-kaspi\.kz\/img\/m\/p\/[^\s"'<>)]+/g;
    while ((m = re2.exec(html)) !== null) imgUrls.push(m[0]);

    if (imgUrls.length > 0) return { source: 'kaspi', url: imgUrls[0], all: imgUrls.slice(0, 3) };
    return null;
  } catch (e) {
    return null;
  }
}

async function searchDDGImages(query) {
  try {
    const q = encodeURIComponent(query + ' продукт упаковка');
    const url = `https://duckduckgo.com/?q=${q}&iax=images&ia=images`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    // Try to find vqd token for image API
    const vqdMatch = html.match(/vqd='([^']+)'/);
    if (!vqdMatch) return null;
    
    const imgUrl = `https://duckduckgo.com/i.js?l=wt-en&o=json&q=${q}&vqd=${vqdMatch[1]}&f=,,,&p=1`;
    const imgRes = await fetch(imgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const imgData = await imgRes.json();
    if (imgData.results?.length > 0) {
      return { source: 'ddg', url: imgData.results[0].image };
    }
    return null;
  } catch { return null; }
}

// Try Arbuz API for arbuz_ products
async function searchArbuz(name) {
  try {
    require('dotenv').config({ path: '.env.local' });
    const tokenRes = await fetch('https://arbuz.kz/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumer: process.env.ARBUZ_CONSUMER, key: process.env.ARBUZ_KEY })
    });
    const { token } = await tokenRes.json();
    
    const q = encodeURIComponent(name.substring(0, 40));
    const url = `https://arbuz.kz/api/shop/search/products?where[name][c]=${q}&limit=5`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.data?.[0]?.attributes?.image_url) {
      return { source: 'arbuz', url: data.data[0].attributes.image_url };
    }
    return null;
  } catch { return null; }
}

async function main() {
  const results = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'image-search-results.json'), 'utf8'));
  const existing = new Map(results.map(r => [r.ean, r]));

  let found = 0;
  
  for (const p of MISSING) {
    if (existing.get(p.ean)?.url) continue; // already found
    
    let result = null;

    // Try Arbuz for arbuz_ products
    if (p.ean.startsWith('arbuz_')) {
      result = await searchArbuz(p.name);
      if (result) console.log(`[ARBUZ] ${p.ean}: ${result.url.substring(0, 80)}`);
    }

    // Try Kaspi
    if (!result) {
      result = await searchKaspiShop(p.brand + ' ' + p.name.split(' ').slice(0, 3).join(' '));
      if (result) console.log(`[KASPI] ${p.ean}: ${result.url.substring(0, 80)}`);
    }

    // Try DDG
    if (!result) {
      result = await searchDDGImages(p.brand + ' ' + p.name.split(' ').slice(1, 4).join(' '));
      if (result) console.log(`[DDG] ${p.ean}: ${result.url.substring(0, 80)}`);
    }

    if (result) {
      found++;
      existing.set(p.ean, { ean: p.ean, ...result });
    } else {
      console.log(`[MISS] ${p.ean}: ${p.name.substring(0, 40)}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nNew found: ${found}`);
  
  const allResults = [...existing.values()];
  const totalFound = allResults.filter(r => r.url).length;
  console.log(`Total found: ${totalFound}/${MISSING.length + 5}`);
  
  fs.writeFileSync(
    path.join(__dirname, '..', 'data', 'image-search-results.json'),
    JSON.stringify(allResults, null, 2)
  );
}

main();
