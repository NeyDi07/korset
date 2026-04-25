require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const MISSING = [
  'kaspi_100222548', 'kaspi_102991689', 'kaspi_101152947', 'kaspi_102219552', 'kaspi_101152586',
  '4607025392408', '0796554251820', '4810067104308', '4810067104193', '0796554251875',
  '3800020453414', '4631151088423', '796554251851', 'kaspi_147393373', '0726529216301',
  '3800020491577', '0796554251981', '4000415744106', '4680046980090', 'kaspi_130641741',
  'kaspi_130641722', '4630300710420', 'kaspi_144858954', '0726529216318', 'kaspi_156486376',
  '4680013873776', '4640047112326', '0796554251998', '4631160077487', '4810067080947',
  'kaspi_159519333', 'kaspi_130746930', 'arbuz_340755', 'arbuz_340753', 'arbuz_340751', 'arbuz_340754',
  'kaspi_139323177', 'kaspi_130690423', 'kaspi_132738833', 'kaspi_130648258', 'kaspi_152662456',
];

const SEARCH_QUERIES = {
  'kaspi_100222548': 'Milka печенье',
  'kaspi_102991689': 'Ritter Sport клубника',
  'kaspi_101152947': 'Ritter Sport мята',
  'kaspi_102219552': 'Победа стевия',
  'kaspi_101152586': 'Ritter Sport кокос',
  '4607025392408': 'Веселый молочник кефир',
  '0796554251820': 'Alma Dzen матча',
  '4810067104308': 'Спартак взрывной микс',
  '4810067104193': 'Спартак 99',
  '0796554251875': 'Alma Nomad',
  '3800020453414': 'KitKat Chunky',
  '4631151088423': 'Libertad фундук',
  '796554251851': 'Alma Nomad курт',
  'kaspi_147393373': 'Ritter Sport рогалик',
  '0726529216301': 'Alma Dzen манго',
  '3800020491577': 'KitKat темный',
  '0796554251981': 'Alma Dzen малина',
  '4000415744106': 'Schogetten Almond',
  '4680046980090': 'natures own чай',
  'kaspi_130641741': 'На меду классический',
  'kaspi_130641722': 'На меду овсяный',
  '4630300710420': 'А4 Тренди',
  'kaspi_144858954': 'Milka Biscoff',
  '0726529216318': 'Alma Dzen чиа',
  'kaspi_156486376': 'Ritter Sport вафля',
  '4680013873776': 'Сибирский кедр пастила',
  '4640047112326': 'На меду латте',
  '0796554251998': 'Alma Dzen кокос',
  '4631160077487': 'Libertad Kids',
  '4810067080947': 'Спартак 500г',
  'kaspi_159519333': 'Сибирский кедр шоколад',
  'kaspi_130746930': 'На меду 45г',
  'arbuz_340755': 'Tandoor оливки',
  'arbuz_340753': 'Tandoor цельнозерновая',
  'arbuz_340751': 'Tandoor протеиновая',
  'arbuz_340754': 'Tandoor кукурузная',
  'kaspi_139323177': 'Победа пористый',
  'kaspi_130690423': 'Gagarinsky шоколад',
  'kaspi_132738833': 'Bucheron апельсин',
  'kaspi_130648258': 'На меду белый',
  'kaspi_152662456': 'Ritter Sport Mini',
};

async function searchKorzinavdom(query) {
  try {
    const q = encodeURIComponent(query);
    const url = `https://api.korzinavdom.kz/client/showcases?searchString=${q}&size=5`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.content?.length > 0) {
      const p = data.content[0];
      if (p.imageUrl) {
        const imgUrl = p.imageUrl.startsWith('http') ? p.imageUrl : `https://data.korzinavdom.kz${p.imageUrl}`;
        return { source: 'korzinavdom', url: imgUrl };
      }
    }
    return null;
  } catch { return null; }
}

async function searchOFFByBarcode(ean) {
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

async function searchKaspiAPI(name) {
  try {
    const q = encodeURIComponent(name);
    const url = `https://kaspi.kz/yml/products?q=${q}&uiLocale=ru`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const data = await res.json();
    if (data.offers?.length > 0 && data.offers[0].picture) {
      return { source: 'kaspi_yml', url: data.offers[0].picture };
    }
  } catch {}
  return null;
}

async function main() {
  const results = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'image-search-results.json'), 'utf8'));
  const existing = new Map(results.map(r => [r.ean, r]));

  let newFound = 0;

  for (const ean of MISSING) {
    if (existing.get(ean)?.url) continue;

    let result = null;
    const query = SEARCH_QUERIES[ean] || '';

    // 1. Korzinavdom
    if (!result && query) {
      result = await searchKorzinavdom(query);
      if (result) console.log(`[KORZ] ${ean}: ${result.url.substring(0, 80)}`);
    }

    // 2. Kaspi YML
    if (!result && query) {
      result = await searchKaspiAPI(query);
      if (result) console.log(`[KASPI-YML] ${ean}: ${result.url.substring(0, 80)}`);
    }

    if (result) {
      newFound++;
      existing.set(ean, { ean, ...result });
    } else {
      console.log(`[MISS] ${ean}`);
    }

    await new Promise(r => setTimeout(r, 400));
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
