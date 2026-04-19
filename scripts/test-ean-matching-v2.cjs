const fs = require('fs')
const path = require('path')
const https = require('https')
const { URL } = require('url')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const NPC_API_KEY = process.env.NPC_API_KEY
const DELAY_MS = 2000
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function httpReq(method, urlStr, headers = {}, body = null, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const data = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
    const req = https.request({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method,
      headers: { ...headers, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
      timeout,
    }, res => {
      let d = ''
      res.on('data', c => { d += c })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    if (data) req.write(data)
    req.end()
  })
}

// ── METHOD 1: NPC (KZ National Catalog) — baseline ──
async function searchNPC(name, brand) {
  if (!NPC_API_KEY) return { method: 'npc', error: 'no key' }
  try {
    const query = `${brand || ''} ${name}`.trim().substring(0, 80)
    const r = await httpReq('POST', 'https://nationalcatalog.kz/gw/search/api/v1/search', {
      'X-API-KEY': NPC_API_KEY, 'Content-Type': 'application/json',
    }, { query, page: 1, size: 5 })
    if (r.status !== 200) return { method: 'npc', ean: null, status: r.status }
    const items = JSON.parse(r.body).items || []
    if (items.length === 0) return { method: 'npc', ean: null, status: 'not_found' }
    const best = items[0]
    const gtin = best.gtin || null
    const ntin = best.ntin || null
    const ean = (gtin && gtin.length >= 8) ? gtin : (ntin && ntin.length >= 8) ? ntin : null
    return { method: 'npc', ean, nameRu: best.nameRu || null, status: 'found', score: best.score || 0 }
  } catch (e) { return { method: 'npc', error: e.message } }
}

// ── METHOD 2: NPC brand-only search (more specific) ──
async function searchNPCBrandOnly(name, brand) {
  if (!NPC_API_KEY || !brand) return { method: 'npc-brand', ean: null, status: brand ? 'no_key' : 'no_brand' }
  try {
    const r = await httpReq('POST', 'https://nationalcatalog.kz/gw/search/api/v1/search', {
      'X-API-KEY': NPC_API_KEY, 'Content-Type': 'application/json',
    }, { query: brand.substring(0, 80), page: 1, size: 20 })
    if (r.status !== 200) return { method: 'npc-brand', ean: null, status: r.status }
    const items = JSON.parse(r.body).items || []
    const nameWords = name.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    for (const item of items) {
      const itemRu = (item.nameRu || '').toLowerCase()
      const match = nameWords.filter(w => itemRu.includes(w)).length
      if (match >= 2 && (item.gtin || item.ntin)) {
        const ean = item.gtin || item.ntin
        return { method: 'npc-brand', ean, nameRu: item.nameRu, status: 'found', wordMatch: match }
      }
    }
    return { method: 'npc-brand', ean: null, status: 'not_found' }
  } catch (e) { return { method: 'npc-brand', error: e.message } }
}

// ── METHOD 3: Open Food Facts (cgi/search.pl) ──
async function searchOFF(name, brand) {
  try {
    const query = `${brand || ''} ${name}`.trim().substring(0, 80)
    const r = await httpReq('GET', `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=5&fields=code,product_name,brands`, {
      'User-Agent': 'Korset/1.0', 'Accept': 'application/json',
    })
    if (r.status !== 200) return { method: 'off', ean: null, status: r.status }
    try {
      const j = JSON.parse(r.body)
      const products = j.products || []
      if (products.length > 0) {
        const p = products[0]
        const code = p.code || null
        if (code && code.length >= 8) {
          return { method: 'off', ean: code, productName: p.product_name, brands: p.brands, status: 'found' }
        }
      }
      return { method: 'off', ean: null, status: 'not_found', count: j.count || 0 }
    } catch {
      return { method: 'off', ean: null, status: 'rate_limited' }
    }
  } catch (e) { return { method: 'off', error: e.message } }
}

// ── METHOD 4: OFF brand-only search ──
async function searchOFFBrandOnly(name, brand) {
  if (!brand) return { method: 'off-brand', ean: null, status: 'no_brand' }
  try {
    const r = await httpReq('GET', `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(brand)}&json=1&page_size=20&fields=code,product_name,brands`, {
      'User-Agent': 'Korset/1.0', 'Accept': 'application/json',
    })
    if (r.status !== 200) return { method: 'off-brand', ean: null, status: r.status }
    try {
      const j = JSON.parse(r.body)
      const products = j.products || []
      const nameWords = name.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      for (const p of products) {
        const pn = (p.product_name || '').toLowerCase()
        const match = nameWords.filter(w => pn.includes(w)).length
        if (match >= 2 && p.code && p.code.length >= 8) {
          return { method: 'off-brand', ean: p.code, productName: p.product_name, brands: p.brands, status: 'found', wordMatch: match }
        }
      }
      return { method: 'off-brand', ean: null, status: 'not_found', count: j.count || 0 }
    } catch {
      return { method: 'off-brand', ean: null, status: 'rate_limited' }
    }
  } catch (e) { return { method: 'off-brand', error: e.message } }
}

// ── METHOD 5: OFF search by brand + category keywords ──
async function searchOFFBrandCategory(name, brand) {
  if (!brand) return { method: 'off-brand-cat', ean: null, status: 'no_brand' }
  const categoryMap = {
    'колбаса': 'saucisson', 'сосиски': 'sausages', 'кетчуп': 'ketchup',
    'майонез': 'mayonnaise', 'рис': 'rice', 'макарон': 'pasta',
    'мука': 'flour', 'конфеты': 'confectionery', 'шампунь': 'shampoo',
    'мороженое': 'ice cream', 'сыр': 'cheese', 'масло': 'butter',
    'чай': 'tea', 'кофе': 'coffee', 'сок': 'juice',
  }
  let categoryKeyword = ''
  for (const [ru, en] of Object.entries(categoryMap)) {
    if (name.toLowerCase().includes(ru)) { categoryKeyword = en; break }
  }
  if (!categoryKeyword) return { method: 'off-brand-cat', ean: null, status: 'no_category' }
  try {
    const query = `${brand} ${categoryKeyword}`
    const r = await httpReq('GET', `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=10&fields=code,product_name,brands`, {
      'User-Agent': 'Korset/1.0', 'Accept': 'application/json',
    })
    if (r.status !== 200) return { method: 'off-brand-cat', ean: null, status: r.status }
    try {
      const j = JSON.parse(r.body)
      const products = j.products || []
      if (products.length > 0 && products[0].code && products[0].code.length >= 8) {
        return { method: 'off-brand-cat', ean: products[0].code, productName: products[0].product_name, brands: products[0].brands, status: 'found', count: j.count }
      }
      return { method: 'off-brand-cat', ean: null, status: 'not_found', count: j.count || 0 }
    } catch {
      return { method: 'off-brand-cat', ean: null, status: 'rate_limited' }
    }
  } catch (e) { return { method: 'off-brand-cat', error: e.message } }
}

// ── METHOD 6: NPC with transliterated query ──
async function searchNPCTransliterated(name, brand) {
  if (!NPC_API_KEY) return { method: 'npc-translit', error: 'no key' }
  const translitMap = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya' }
  function translit(s) { return [...s].map(c => translitMap[c.toLowerCase()] || c).join('') }
  try {
    const query = translit(`${brand || ''} ${name}`.trim()).substring(0, 80)
    const r = await httpReq('POST', 'https://nationalcatalog.kz/gw/search/api/v1/search', {
      'X-API-KEY': NPC_API_KEY, 'Content-Type': 'application/json',
    }, { query, page: 1, size: 5 })
    if (r.status !== 200) return { method: 'npc-translit', ean: null, status: r.status }
    const items = JSON.parse(r.body).items || []
    if (items.length === 0) return { method: 'npc-translit', ean: null, status: 'not_found' }
    const best = items[0]
    const ean = best.gtin || best.ntin || null
    return { method: 'npc-translit', ean, nameRu: best.nameRu || null, status: 'found' }
  } catch (e) { return { method: 'npc-translit', error: e.message } }
}

// ── METHOD 7: OFF barcode lookup (if we have part of EAN from NPC) ──
async function searchOFFByCode(partialEan) {
  if (!partialEan || partialEan.length < 8) return { method: 'off-code', ean: null, status: 'no_code' }
  try {
    const r = await httpReq('GET', `https://world.openfoodfacts.org/api/v0/product/${partialEan}.json`, {
      'User-Agent': 'Korset/1.0', 'Accept': 'application/json',
    })
    if (r.status !== 200) return { method: 'off-code', ean: null, status: r.status }
    const j = JSON.parse(r.body)
    if (j.status === 1 && j.product) {
      return { method: 'off-code', ean: j.code, productName: j.product.product_name, status: 'found' }
    }
    return { method: 'off-code', ean: null, status: 'not_found' }
  } catch (e) { return { method: 'off-code', error: e.message } }
}

const TEST_PRODUCTS = [
  { ean: 'arbuz_325512', name: 'Чай холодный Fuse манго и ананас 1,5 л', brand: 'Fuse' },
  { ean: 'arbuz_330704', name: 'Мука Edeka ржаная тип 1150, 1 кг', brand: 'Edeka' },
  { ean: 'arbuz_252232', name: 'Колбаса СПК утренняя варёная в/у, кг', brand: 'СПК' },
  { ean: 'arbuz_196394', name: 'Кетчуп 3 Желания классический 450 г', brand: '3 Желания' },
  { ean: 'arbuz_295393', name: 'Сосиски Индилайт молочные, 440 г', brand: 'Индилайт' },
  { ean: 'arbuz_307191', name: 'Сосиски Arbuz Select говяжьи 390 г', brand: 'Arbuz Select' },
  { ean: 'arbuz_317523', name: 'Сосиски Папа может мясные с говядиной, 600 г', brand: 'Папа может' },
  { ean: 'arbuz_301706', name: 'Колбаса Ет Байрам Мусульманская Халал вареная 600 г', brand: 'Ет Байрам' },
  { ean: 'arbuz_328926', name: 'Молодой ячмень Bio planet органический порошок 100 г', brand: 'Bio planet' },
  { ean: 'arbuz_331390', name: 'Макаронное изделие Edeka Rigatoni 500 г', brand: 'Edeka' },
  { ean: 'arbuz_229754', name: 'Рис Makfa длиннозерный пропаренный в пакетиках для варки, 400 г', brand: 'Makfa' },
  { ean: 'arbuz_204499', name: 'Соус для пасты Barilla Арабьята 400 г', brand: 'Barilla' },
  { ean: 'arbuz_331395', name: 'Горчица Thomy Delikatess средне-острая, приправленная, в тюбике 200 мл', brand: 'Thomy' },
  { ean: 'arbuz_320949', name: 'Рис Arbuz Select x Damdala с овощами и курицей 300 г', brand: 'Arbuz Select x Damdala' },
  { ean: 'arbuz_328915', name: 'Желтый горошек Bio planet органический 500 г', brand: 'Bio planet' },
  { ean: 'arbuz_231675', name: 'Майонез Махеевъ с перепелиным яйцом 67%, 380 г', brand: 'Махеевъ' },
  { ean: 'arbuz_331030', name: 'Макароны фузилли Bioitalia из чечевицы 250 г', brand: 'Bioitalia' },
  { ean: 'arbuz_330276', name: 'Цельнозерновые фузилли Джейми Оливер 500 г', brand: 'Джейми Оливер' },
  { ean: 'arbuz_235141', name: 'Шпикачки Папа может сочные со свининой, кг', brand: 'Папа может' },
  { ean: 'arbuz_255781', name: 'Конфеты Победа charget без сахара в горьком шоколаде, кг', brand: 'Победа' },
]

const METHODS = [
  searchNPC,
  searchNPCBrandOnly,
  searchNPCTransliterated,
  searchOFF,
  searchOFFBrandOnly,
  searchOFFBrandCategory,
]

async function main() {
  console.log('══════════════════════════════════════════════════════')
  console.log('EAN MATCHING TEST v2 — 20 products × 6 methods')
  console.log('══════════════════════════════════════════════════════\n')

  const results = {}
  for (const m of METHODS) results[m.name] = { found: 0, notFound: 0, errors: 0, details: [] }

  for (let i = 0; i < TEST_PRODUCTS.length; i++) {
    const p = TEST_PRODUCTS[i]
    console.log(`\n── [${i + 1}/20] ${p.brand} — ${p.name.substring(0, 40)} ──`)

    for (const methodFn of METHODS) {
      const mn = methodFn.name
      process.stdout.write(`  ${mn.replace('search', '')}: `)
      try {
        const result = await methodFn(p.name, p.brand)
        if (result.error) {
          results[mn].errors++
          console.log(`ERR: ${result.error}`)
        } else if (result.ean && !result.ean.startsWith('0200')) {
          results[mn].found++
          console.log(`✓ EAN=${result.ean}${result.nameRu ? ' (' + result.nameRu.substring(0, 25) + ')' : ''}`)
        } else {
          results[mn].notFound++
          console.log(`not found${result.status ? ' (' + result.status + ')' : ''}`)
        }
        results[mn].details.push({ product: p.ean, ...result })
      } catch (e) {
        results[mn].errors++
        console.log(`EXCEPTION: ${e.message}`)
      }
      await sleep(DELAY_MS)
    }
  }

  console.log('\n\n══════════════════════════════════════════════════════')
  console.log('SUMMARY — EAN found per method (out of 20 products)')
  console.log('══════════════════════════════════════════════════════')

  const summary = Object.entries(results)
    .map(([name, r]) => ({ method: name.replace('search', ''), found: r.found, notFound: r.notFound, errors: r.errors, rate: Math.round(r.found / 20 * 100) }))
    .sort((a, b) => b.found - a.found)

  console.log('\n| Method | Found | Rate | Errors |')
  console.log('|--------|-------|------|--------|')
  for (const s of summary) {
    console.log(`| ${s.method} | ${s.found}/20 | ${s.rate}% | ${s.errors} |`)
  }

  const outDir = path.join(__dirname, '..', 'data', 'ean-matching-test')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, `test-v2-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify({ testedAt: new Date().toISOString(), products: TEST_PRODUCTS, results, summary }, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
