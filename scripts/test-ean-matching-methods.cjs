const fs = require('fs')
const path = require('path')
const https = require('https')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { URL } = require('url')

const DELAY_MS = 1000
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function httpReq(method, urlStr, headers = {}, body = null, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const data = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
    const req = https.request({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search,
      method,
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

function httpGet(urlStr, headers = {}) {
  return httpReq('GET', urlStr, { 'Accept': 'text/html,application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...headers })
}

// ── METHOD 1: EAN-Search.org ──
async function searchEanSearchOrg(name, brand) {
  const token = process.env.EANSEARCH_TOKEN
  if (!token) return { method: 'ean-search.org', error: 'no token' }
  try {
    const query = `${brand || ''} ${name}`.trim().substring(0, 80)
    const r = await httpReq('GET', `https://api.ean-search.org/api?token=${token}&search=${encodeURIComponent(query)}&op=searchbyname`, { Accept: 'application/json' })
    if (r.status !== 200) return { method: 'ean-search.org', status: r.status, ean: null }
    const data = JSON.parse(r.body)
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0]
      return { method: 'ean-search.org', ean: item.ean || item.gtin || null, name: item.name || item.productName || null, status: 'found' }
    }
    return { method: 'ean-search.org', ean: null, status: 'not_found' }
  } catch (e) { return { method: 'ean-search.org', error: e.message } }
}

// ── METHOD 2: UPCitemdb.com ──
async function searchUPCitemdb(name, brand) {
  try {
    const query = `${brand || ''} ${name}`.trim().substring(0, 80)
    const r = await httpReq('GET', `https://api.upcitemdb.com/prod/trgsearch?q=${encodeURIComponent(query)}`, { Accept: 'application/json' })
    if (r.status !== 200) return { method: 'upcitemdb', status: r.status, ean: null }
    const data = JSON.parse(r.body)
    const items = data.items || []
    if (items.length > 0) {
      const item = items[0]
      return { method: 'upcitemdb', ean: item.ean || item.upc || null, title: item.title || null, status: 'found' }
    }
    return { method: 'upcitemdb', ean: null, status: 'not_found' }
  } catch (e) { return { method: 'upcitemdb', error: e.message } }
}

// ── METHOD 3: Barcodelookup.com (scraping) ──
async function searchBarcodelookup(name, brand) {
  try {
    const query = `${brand || ''} ${name}`.trim().substring(0, 80)
    const r = await httpGet(`https://www.barcodelookup.com/${encodeURIComponent(query)}`)
    if (r.status !== 200) return { method: 'barcodelookup', status: r.status, ean: null }
    const eanMatch = r.body.match(/"barcode"\s*:\s*"(\d{8,14})"/)
    const eanMatch2 = r.body.match(/data-barcode="(\d{8,14})"/)
    const eanMatch3 = r.body.match(/(\d{13})\s*<\s*\/\s*span>/)
    const ean = eanMatch?.[1] || eanMatch2?.[1] || eanMatch3?.[1] || null
    if (ean) return { method: 'barcodelookup', ean, status: 'found' }
    return { method: 'barcodelookup', ean: null, status: 'not_found' }
  } catch (e) { return { method: 'barcodelookup', error: e.message } }
}

// ── METHOD 4: Google Shopping (via scraping) ──
async function searchGoogleShopping(name, brand) {
  try {
    const query = `${brand || ''} ${name} barcode EAN`.trim().substring(0, 100)
    const r = await httpGet(`https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=shop&hl=ru`)
    if (r.status !== 200) return { method: 'google-shopping', status: r.status, ean: null }
    const gtinMatch = r.body.match(/"gtin"\s*:\s*"(\d{8,14})"/)
    const eanMatch = r.body.match(/"ean"\s*:\s*"(\d{8,14})"/)
    const ean = gtinMatch?.[1] || eanMatch?.[1] || null
    if (ean) return { method: 'google-shopping', ean, status: 'found' }
    return { method: 'google-shopping', ean: null, status: 'not_found' }
  } catch (e) { return { method: 'google-shopping', error: e.message } }
}

// ── METHOD 5: Yandex Market ──
async function searchYandexMarket(name, brand) {
  try {
    const query = `${brand || ''} ${name}`.trim().substring(0, 80)
    const r = await httpGet(`https://market.yandex.ru/search?text=${encodeURIComponent(query)}`)
    if (r.status !== 200) return { method: 'yandex-market', status: r.status, ean: null }
    const eanMatch = r.body.match(/"ean"\s*:\s*"(\d{8,14})"/)
    const gtinMatch = r.body.match(/"gtin"\s*:\s*"(\d{8,14})"/)
    const barcodeMatch = r.body.match(/"barcode"\s*:\s*"(\d{8,14})"/)
    const ean = eanMatch?.[1] || gtinMatch?.[1] || barcodeMatch?.[1] || null
    if (ean) return { method: 'yandex-market', ean, status: 'found' }
    return { method: 'yandex-market', ean: null, status: 'not_found' }
  } catch (e) { return { method: 'yandex-market', error: e.message } }
}

// ── METHOD 6: Wildberries ──
async function searchWildberries(name, brand) {
  try {
    const query = `${brand || ''} ${name}`.trim().substring(0, 80)
    const r = await httpReq('GET', `https://search.wb.ru/search/v2/search?curr=KZT&dest=-1257786&locale=ru&query=${encodeURIComponent(query)}&resultset=catalog&sort=popular`, {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    })
    if (r.status !== 200) return { method: 'wildberries', status: r.status, ean: null }
    const data = JSON.parse(r.body)
    const products = data?.data?.products || []
    if (products.length > 0) {
      const item = products[0]
      return { method: 'wildberries', ean: item.barcode || item.ean || null, name: item.name || null, status: 'found' }
    }
    return { method: 'wildberries', ean: null, status: 'not_found' }
  } catch (e) { return { method: 'wildberries', error: e.message } }
}

// ── METHOD 7: Magnum.kz ──
async function searchMagnumKz(name, brand) {
  try {
    const query = `${brand || ''} ${name}`.trim().substring(0, 80)
    const r = await httpReq('GET', `https://magnum.kz/api/v1/search?query=${encodeURIComponent(query)}&limit=5`, {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    })
    if (r.status !== 200) {
      const r2 = await httpGet(`https://magnum.kz/search?query=${encodeURIComponent(query)}`)
      if (r2.status !== 200) return { method: 'magnum.kz', status: r2.status, ean: null }
      const eanMatch = r2.body.match(/"barcode"\s*:\s*"?(\d{8,14})"?/g)
      const gtinMatch = r2.body.match(/"gtin"\s*:\s*"?(\d{8,14})"?/)
      const ean = eanMatch?.[0]?.match(/(\d{8,14})/)?.[1] || gtinMatch?.[1] || null
      if (ean) return { method: 'magnum.kz', ean, status: 'found' }
      return { method: 'magnum.kz', ean: null, status: 'not_found' }
    }
    const data = JSON.parse(r.body)
    const items = data?.items || data?.products || data?.results || []
    if (items.length > 0) {
      const item = items[0]
      return { method: 'magnum.kz', ean: item.barcode || item.ean || item.gtin || null, name: item.name || null, status: 'found' }
    }
    return { method: 'magnum.kz', ean: null, status: 'not_found' }
  } catch (e) { return { method: 'magnum.kz', error: e.message } }
}

// ── METHOD 8: Gtin.lsi.nu ──
async function searchGtinLsi(name, brand) {
  try {
    const query = `${brand || ''} ${name}`.trim().substring(0, 80)
    const r = await httpGet(`https://gtin.lsi.nu/search?q=${encodeURIComponent(query)}`)
    if (r.status !== 200) return { method: 'gtin.lsi.nu', status: r.status, ean: null }
    const gtinMatch = r.body.match(/(\d{13})/g)
    if (gtinMatch && gtinMatch.length > 0) {
      return { method: 'gtin.lsi.nu', ean: gtinMatch[0], status: 'found', count: gtinMatch.length }
    }
    return { method: 'gtin.lsi.nu', ean: null, status: 'not_found' }
  } catch (e) { return { method: 'gtin.lsi.nu', error: e.message } }
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
  searchEanSearchOrg,
  searchUPCitemdb,
  searchBarcodelookup,
  searchGoogleShopping,
  searchYandexMarket,
  searchWildberries,
  searchMagnumKz,
  searchGtinLsi,
]

async function main() {
  console.log('══════════════════════════════════════════════════════')
  console.log('EAN MATCHING METHODS TEST — 20 products × 8 methods')
  console.log('══════════════════════════════════════════════════════\n')

  const results = {}
  for (const m of METHODS) {
    results[m.name] = { found: 0, notFound: 0, errors: 0, details: [] }
  }

  for (let i = 0; i < TEST_PRODUCTS.length; i++) {
    const p = TEST_PRODUCTS[i]
    console.log(`\n── [${i + 1}/20] ${p.brand} — ${p.name.substring(0, 40)} ──`)

    for (const methodFn of METHODS) {
      const methodName = methodFn.name
      process.stdout.write(`  ${methodName.replace('search', '')}: `)
      try {
        const result = await methodFn(p.name, p.brand)
        if (result.error) {
          results[methodName].errors++
          console.log(`ERROR: ${result.error}`)
        } else if (result.ean) {
          results[methodName].found++
          console.log(`✓ EAN=${result.ean}${result.name ? ' (' + result.name.substring(0, 30) + ')' : ''}`)
        } else {
          results[methodName].notFound++
          console.log(`not found${result.status ? ' (' + result.status + ')' : ''}`)
        }
        results[methodName].details.push({ product: p.ean, ...result })
      } catch (e) {
        results[methodName].errors++
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
  const outFile = path.join(outDir, `test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(outFile, JSON.stringify({ testedAt: new Date().toISOString(), products: TEST_PRODUCTS, results, summary }, null, 2))
  console.log(`\nSaved: ${outFile}`)
}

main().catch(e => { console.error(e); process.exit(1) })
