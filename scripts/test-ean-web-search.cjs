const fs = require('fs')
const path = require('path')
const https = require('https')
const { URL } = require('url')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const DELAY_MS = 2500
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function httpGet(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method: 'GET',
      headers: { 'Accept': 'text/html,application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept-Language': 'ru-RU,ru;q=0.9', ...headers },
      timeout: 20000,
    }, res => {
      let d = ''
      res.on('data', c => { d += c })
      res.on('end', () => resolve({ status: res.statusCode, body: d, url: url.href }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

function extractEANs(text) {
  const eans = new Map()
  const re = /\b(\d{13})\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const code = m[1]
    if (code.startsWith('000') || code.startsWith('999')) continue
    const checkDigit = validateEAN13(code)
    if (checkDigit) eans.set(code, (eans.get(code) || 0) + 1)
  }
  const re2 = /\b(\d{8})\b/g
  while ((m = re2.exec(text)) !== null) {
    if (m[1].startsWith('000') || m[1].startsWith('9999')) continue
    eans.set(m[1], (eans.get(m[1]) || 0) + 1)
  }
  return eans
}

function validateEAN13(code) {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10 === parseInt(code[12])
}

// ── SOURCE 1: DuckDuckGo HTML search ──
async function searchDuckDuckGo(query) {
  try {
    const q = `${query} штрихкод EAN barcode`
    const r = await httpGet(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`)
    if (r.status !== 200) return { source: 'duckduckgo', eans: new Map(), status: r.status }
    const eans = extractEANs(r.body)
    return { source: 'duckduckgo', eans, status: 'ok' }
  } catch (e) { return { source: 'duckduckgo', eans: new Map(), error: e.message } }
}

// ── SOURCE 2: Yandex search ──
async function searchYandex(query) {
  try {
    const q = `${query} штрихкод EAN`
    const r = await httpGet(`https://yandex.ru/search/?text=${encodeURIComponent(q)}&lr=163`)
    if (r.status !== 200) return { source: 'yandex', eans: new Map(), status: r.status }
    const eans = extractEANs(r.body)
    return { source: 'yandex', eans, status: 'ok' }
  } catch (e) { return { source: 'yandex', eans: new Map(), error: e.message } }
}

// ── SOURCE 3: Google search ──
async function searchGoogle(query) {
  try {
    const q = `${query} штрихкод EAN barcode GTIN`
    const r = await httpGet(`https://www.google.com/search?q=${encodeURIComponent(q)}&hl=ru&num=10`)
    if (r.status !== 200) return { source: 'google', eans: new Map(), status: r.status }
    const eans = extractEANs(r.body)
    return { source: 'google', eans, status: 'ok' }
  } catch (e) { return { source: 'google', eans: new Map(), error: e.message } }
}

// ── SOURCE 4: Bing search ──
async function searchBing(query) {
  try {
    const q = `${query} штрихкод EAN barcode`
    const r = await httpGet(`https://www.bing.com/search?q=${encodeURIComponent(q)}&cc=kz`)
    if (r.status !== 200) return { source: 'bing', eans: new Map(), status: r.status }
    const eans = extractEANs(r.body)
    return { source: 'bing', eans, status: 'ok' }
  } catch (e) { return { source: 'bing', eans: new Map(), error: e.message } }
}

// ── SOURCE 5: Ozon product search (scrape) ──
async function searchOzon(query) {
  try {
    const r = await httpGet(`https://www.ozon.ru/search/?text=${encodeURIComponent(query)}&from_global=true`)
    if (r.status !== 200) return { source: 'ozon', eans: new Map(), status: r.status }
    const eans = extractEANs(r.body)
    const gtinRe = /"barcode"\s*:\s*"?(\d{8,14})"?/g
    let m
    while ((m = gtinRe.exec(r.body)) !== null) {
      const code = m[1]
      if (code.length === 13) eans.set(code, (eans.get(code) || 0) + 10)
    }
    return { source: 'ozon', eans, status: 'ok' }
  } catch (e) { return { source: 'ozon', eans: new Map(), error: e.message } }
}

// ── SOURCE 6: Wildberries search (scrape) ──
async function searchWildberries(query) {
  try {
    const r = await httpGet(`https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(query)}`, {
      'Accept': 'text/html',
      'Referer': 'https://www.wildberries.ru/',
    })
    if (r.status !== 200) return { source: 'wildberries', eans: new Map(), status: r.status }
    const eans = extractEANs(r.body)
    const bcRe = /"barcode"\s*:\s*"?(\d{8,14})"?/g
    let m
    while ((m = bcRe.exec(r.body)) !== null) {
      const code = m[1]
      if (code.length === 13) eans.set(code, (eans.get(code) || 0) + 10)
    }
    return { source: 'wildberries', eans, status: 'ok' }
  } catch (e) { return { source: 'wildberries', eans: new Map(), error: e.message } }
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
  { ean: 'arbuz_229754', name: 'Рис Makfa длиннозерный пропаренный в пакетиках для варки, 400 г', brand: 'Makfa' },
  { ean: 'arbuz_204499', name: 'Соус для пасты Barilla Арабьята 400 г', brand: 'Barilla' },
  { ean: 'arbuz_231675', name: 'Майонез Махеевъ с перепелиным яйцом 67%, 380 г', brand: 'Махеевъ' },
  { ean: 'arbuz_331030', name: 'Макароны фузилли Bioitalia из чечевицы 250 г', brand: 'Bioitalia' },
  { ean: 'arbuz_330276', name: 'Цельнозерновые фузилли Джейми Оливер 500 г', brand: 'Джейми Оливер' },
  { ean: 'arbuz_255781', name: 'Конфеты Победа charget без сахара в горьком шоколаде, кг', brand: 'Победа' },
  { ean: 'arbuz_328915', name: 'Желтый горошек Bio planet органический 500 г', brand: 'Bio planet' },
  { ean: 'arbuz_331390', name: 'Макаронное изделие Edeka Rigatoni 500 г', brand: 'Edeka' },
  { ean: 'arbuz_331395', name: 'Горчица Thomy Delikatess средне-острая, приправленная, 200 мл', brand: 'Thomy' },
  { ean: 'arbuz_328926', name: 'Молодой ячмень Bio planet органический порошок 100 г', brand: 'Bio planet' },
  { ean: 'arbuz_235141', name: 'Шпикачки Папа может сочные со свининой, кг', brand: 'Папа может' },
  { ean: 'arbuz_320949', name: 'Рис Arbuz Select x Damdala с овощами и курицей 300 г', brand: 'Arbuz Select x Damdala' },
]

const SOURCES = [searchDuckDuckGo, searchBing, searchYandex, searchGoogle, searchOzon, searchWildberries]

async function main() {
  console.log('══════════════════════════════════════════════════════')
  console.log('EAN WEB SEARCH TEST — 20 products × 6 search engines')
  console.log('Cross-validate: EAN found on 2+ sites = verified')
  console.log('══════════════════════════════════════════════════════\n')

  const allResults = []

  for (let i = 0; i < TEST_PRODUCTS.length; i++) {
    const p = TEST_PRODUCTS[i]
    const query = `${p.brand} ${p.name}`.trim().replace(/,?\s*\d+[\.,]?\d*\s*(г|кг|л|мл|мкг|шт)\b/gi, '').trim()
    console.log(`── [${i + 1}/20] ${query.substring(0, 50)} ──`)

    const combinedEANs = new Map()
    const sourceResults = {}

    for (const srcFn of SOURCES) {
      const srcName = srcFn.name.replace('search', '')
      process.stdout.write(`  ${srcName}: `)
      try {
        const result = await srcFn(query)
        if (result.error) {
          console.log(`ERR: ${result.error}`)
          sourceResults[srcName] = { error: result.error }
        } else if (result.eans.size === 0) {
          console.log(`no EANs (${result.status})`)
          sourceResults[srcName] = { status: result.status, eans: [] }
        } else {
          const topEANs = [...result.eans.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
          console.log(`found ${result.eans.size} EANs: ${topEANs.map(([e, c]) => e + '×' + c).join(', ')}`)
          sourceResults[srcName] = { status: 'ok', eans: topEANs.map(([e, c]) => ({ ean: e, count: c })) }
          for (const [ean, count] of result.eans) {
            if (!combinedEANs.has(ean)) combinedEANs.set(ean, { sources: [], totalCount: 0 })
            const existing = combinedEANs.get(ean)
            existing.sources.push(srcName)
            existing.totalCount += count
          }
        }
      } catch (e) {
        console.log(`EXCEPTION: ${e.message}`)
        sourceResults[srcName] = { error: e.message }
      }
      await sleep(DELAY_MS)
    }

    const rankedEANs = [...combinedEANs.entries()]
      .map(([ean, data]) => ({ ean, sourceCount: data.sources.length, sources: data.sources, totalCount: data.totalCount }))
      .sort((a, b) => b.sourceCount - a.sourceCount || b.totalCount - a.totalCount)

    const verified = rankedEANs.find(e => e.sourceCount >= 2)
    const bestGuess = rankedEANs[0]

    if (verified) {
      console.log(`  ✅ VERIFIED: EAN=${verified.ean} (${verified.sourceCount} sources: ${verified.sources.join('+')})`)
    } else if (bestGuess) {
      console.log(`  ⚠️ BEST GUESS: EAN=${bestGuess.ean} (1 source: ${bestGuess.sources.join('+')}, score=${bestGuess.totalCount})`)
    } else {
      console.log(`  ❌ NO EAN FOUND`)
    }

    allResults.push({ product: p, query, verified: verified || null, bestGuess: bestGuess || null, rankedEANs, sourceResults })
  }

  const verifiedCount = allResults.filter(r => r.verified).length
  const anyEANCount = allResults.filter(r => r.verified || r.bestGuess).length
  console.log('\n══════════════════════════════════════════════════════')
  console.log('SUMMARY')
  console.log('══════════════════════════════════════════════════════')
  console.log(`Verified (2+ sources): ${verifiedCount}/20 (${Math.round(verifiedCount / 20 * 100)}%)`)
  console.log(`Any EAN found:         ${anyEANCount}/20 (${Math.round(anyEANCount / 20 * 100)}%)`)

  const sourceStats = {}
  for (const r of allResults) {
    for (const [src, data] of Object.entries(r.sourceResults)) {
      if (!sourceStats[src]) sourceStats[src] = { found: 0, empty: 0, errors: 0 }
      if (data.error) sourceStats[src].errors++
      else if (data.eans && data.eans.length > 0) sourceStats[src].found++
      else sourceStats[src].empty++
    }
  }
  console.log('\nPer-source stats:')
  console.log('| Source | Found EAN | Empty | Errors |')
  console.log('|--------|-----------|-------|--------|')
  for (const [src, s] of Object.entries(sourceStats).sort((a, b) => b[1].found - a[1].found)) {
    console.log(`| ${src} | ${s.found} | ${s.empty} | ${s.errors} |`)
  }

  const outDir = path.join(__dirname, '..', 'data', 'ean-matching-test')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, `web-search-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify({ testedAt: new Date().toISOString(), verifiedCount, anyEANCount, sourceStats, results: allResults }, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
