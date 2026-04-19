const fs = require('fs')
const path = require('path')
const https = require('https')
const { URL } = require('url')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const NPC_API_KEY = process.env.NPC_API_KEY
const DELAY_MS = 2000
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function httpReq(method, urlStr, headers = {}, body = null, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const data = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
    const req = https.request({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method,
      headers: { 'Accept': 'text/html,application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...headers, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
      timeout,
    }, res => {
      let d = ''
      res.on('data', c => { d += c })
      res.on('end', () => resolve({ status: res.statusCode, body: d }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    if (data) req.write(data)
    req.end()
  })
}

function validateEAN13(code) {
  if (!/^\d{13}$/.test(code)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10 === parseInt(code[12])
}

function extractEANsFromHTML(text) {
  const eans = new Map()
  const re = /\b(\d{13})\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const code = m[1]
    if (!validateEAN13(code)) continue
    if (code.startsWith('000') || code.startsWith('590') || code.startsWith('864')) continue
    eans.set(code, (eans.get(code) || 0) + 1)
  }
  return eans
}

// ── METHOD A: NPC name search ──
async function npcSearch(query) {
  if (!NPC_API_KEY) return []
  try {
    const r = await httpReq('POST', 'https://nationalcatalog.kz/gw/search/api/v1/search', {
      'X-API-KEY': NPC_API_KEY, 'Content-Type': 'application/json',
    }, { query: query.substring(0, 80), page: 1, size: 5 })
    if (r.status !== 200) return []
    const items = JSON.parse(r.body).items || []
    return items.filter(i => i.gtin && i.gtin.length >= 8).map(i => ({
      ean: i.gtin, nameRu: i.nameRu, ntin: i.ntin, source: 'npc'
    }))
  } catch { return [] }
}

// ── METHOD B: DuckDuckGo search ──
async function ddgSearch(query) {
  try {
    const q = `${query} штрихкод EAN barcode`
    const r = await httpReq('GET', `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`)
    if (r.status !== 200) return []
    const eans = extractEANsFromHTML(r.body)
    return [...eans.entries()].map(([ean, count]) => ({ ean, count, source: 'ddg' }))
  } catch { return [] }
}

// ── METHOD C: OFF search (cgi/search.pl) ──
async function offSearch(query) {
  try {
    const r = await httpReq('GET', `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=5&fields=code,product_name,brands`, {
      'User-Agent': 'Korset/1.0', 'Accept': 'application/json',
    })
    if (r.status !== 200) return []
    try {
      const j = JSON.parse(r.body)
      return (j.products || []).filter(p => p.code && p.code.length >= 8).map(p => ({
        ean: p.code, productName: p.product_name, brands: p.brands, source: 'off'
      }))
    } catch { return [] }
  } catch { return [] }
}

// ── METHOD D: Arbuz detail API → NTIN from NPC ──
async function arbuzDetailPlusNPC(arbuzId, name, brand) {
  return [] // Arbuz API doesn't return barcodes, skip
}

const TEST_PRODUCTS = [
  { name: 'Чай холодный Fuse манго и ананас 1,5 л', brand: 'Fuse' },
  { name: 'Мука Edeka ржаная тип 1150, 1 кг', brand: 'Edeka' },
  { name: 'Колбаса СПК утренняя варёная в/у, кг', brand: 'СПК' },
  { name: 'Кетчуп 3 Желания классический 450 г', brand: '3 Желания' },
  { name: 'Сосиски Индилайт молочные, 440 г', brand: 'Индилайт' },
  { name: 'Сосиски Arbuz Select говяжьи 390 г', brand: 'Arbuz Select' },
  { name: 'Сосиски Папа может мясные с говядиной, 600 г', brand: 'Папа может' },
  { name: 'Колбаса Ет Байрам Мусульманская Халал вареная 600 г', brand: 'Ет Байрам' },
  { name: 'Рис Makfa длиннозерный пропаренный, 400 г', brand: 'Makfa' },
  { name: 'Соус для пасты Barilla Арабьята 400 г', brand: 'Barilla' },
  { name: 'Майонез Махеевъ с перепелиным яйцом 67%, 380 г', brand: 'Махеевъ' },
  { name: 'Макароны фузилли Bioitalia из чечевицы 250 г', brand: 'Bioitalia' },
  { name: 'Цельнозерновые фузилли Джейми Оливер 500 г', brand: 'Джейми Оливер' },
  { name: 'Конфеты Победа charget без сахара в горьком шоколаде', brand: 'Победа' },
  { name: 'Желтый горошек Bio planet органический 500 г', brand: 'Bio planet' },
  { name: 'Макаронное изделие Edeka Rigatoni 500 г', brand: 'Edeka' },
  { name: 'Горчица Thomy Delikatess средне-острая, 200 мл', brand: 'Thomy' },
  { name: 'Молодой ячмень Bio planet органический порошок 100 г', brand: 'Bio planet' },
  { name: 'Шпикачки Папа может сочные со свининой, кг', brand: 'Папа может' },
  { name: 'Рис Arbuz Select x Damdala с овощами и курицей 300 г', brand: 'Arbuz Select x Damdala' },
]

async function main() {
  console.log('══════════════════════════════════════════════════════')
  console.log('CROSS-VALIDATED EAN MATCHING — NPC + DDG + OFF')
  console.log('EAN found on 2+ sources = VERIFIED')
  console.log('══════════════════════════════════════════════════════\n')

  const results = []

  for (let i = 0; i < TEST_PRODUCTS.length; i++) {
    const p = TEST_PRODUCTS[i]
    const query = `${p.brand} ${p.name}`.replace(/,?\s*\d+[\.,]?\d*\s*(г|кг|л|мл|шт)\b/gi, '').trim()
    console.log(`── [${i + 1}/20] ${query.substring(0, 55)} ──`)

    const allEANs = new Map()

    // NPC
    process.stdout.write('  NPC: ')
    const npcResults = await npcSearch(query)
    if (npcResults.length > 0) {
      console.log(`✓ ${npcResults.length} items, EANs: ${npcResults.map(r => r.ean).join(', ')}`)
      for (const r of npcResults) {
        if (!allEANs.has(r.ean)) allEANs.set(r.ean, { sources: [], names: [] })
        allEANs.get(r.ean).sources.push('npc')
        if (r.nameRu) allEANs.get(r.ean).names.push(r.nameRu.substring(0, 40))
      }
    } else {
      console.log('not found')
    }
    await sleep(DELAY_MS)

    // DDG
    process.stdout.write('  DDG: ')
    const ddgResults = await ddgSearch(query)
    if (ddgResults.length > 0) {
      console.log(`✓ ${ddgResults.length} EANs: ${ddgResults.slice(0, 3).map(r => r.ean + '×' + r.count).join(', ')}`)
      for (const r of ddgResults) {
        if (!allEANs.has(r.ean)) allEANs.set(r.ean, { sources: [], names: [] })
        allEANs.get(r.ean).sources.push('ddg')
      }
    } else {
      console.log('not found')
    }
    await sleep(DELAY_MS)

    // OFF
    process.stdout.write('  OFF: ')
    const offResults = await offSearch(query)
    if (offResults.length > 0) {
      console.log(`✓ ${offResults.length} items, EANs: ${offResults.map(r => r.ean).join(', ')}`)
      for (const r of offResults) {
        if (!allEANs.has(r.ean)) allEANs.set(r.ean, { sources: [], names: [] })
        allEANs.get(r.ean).sources.push('off')
        if (r.productName) allEANs.get(r.ean).names.push(r.productName.substring(0, 40))
      }
    } else {
      console.log('not found')
    }
    await sleep(DELAY_MS)

    // Cross-validate
    const ranked = [...allEANs.entries()]
      .map(([ean, data]) => ({ ean, sourceCount: data.sources.length, sources: data.sources.sort().join('+'), names: data.names }))
      .sort((a, b) => b.sourceCount - a.sourceCount)

    const verified = ranked.find(e => e.sourceCount >= 2)
    const best = ranked[0]

    if (verified) {
      console.log(`  ✅ VERIFIED: ${verified.ean} (${verified.sources}) ${verified.names[0] || ''}`)
    } else if (best && best.sourceCount === 1 && best.sources === 'npc') {
      console.log(`  🔵 NPC only: ${best.ean} ${best.names[0] || ''}`)
    } else if (best && best.sourceCount === 1 && best.sources === 'ddg') {
      console.log(`  🟡 DDG only: ${best.ean}`)
    } else if (best && best.sourceCount === 1 && best.sources === 'off') {
      console.log(`  🟢 OFF only: ${best.ean} ${best.names[0] || ''}`)
    } else {
      console.log(`  ❌ NO EAN`)
    }

    results.push({ product: p, query, verified: verified || null, best: best || null, ranked })
  }

  const verifiedCount = results.filter(r => r.verified).length
  const npcOnly = results.filter(r => !r.verified && r.best && r.best.sources === 'npc').length
  const ddgOnly = results.filter(r => !r.verified && r.best && r.best.sources === 'ddg').length
  const offOnly = results.filter(r => !r.verified && r.best && r.best.sources === 'off').length
  const none = results.filter(r => !r.best).length

  console.log('\n══════════════════════════════════════════════════════')
  console.log('FINAL RESULTS')
  console.log('══════════════════════════════════════════════════════')
  console.log(`✅ Verified (2+ sources): ${verifiedCount}/20 (${Math.round(verifiedCount / 20 * 100)}%)`)
  console.log(`🔵 NPC only:             ${npcOnly}/20`)
  console.log(`🟡 DDG only:             ${ddgOnly}/20`)
  console.log(`🟢 OFF only:             ${offOnly}/20`)
  console.log(`❌ No EAN at all:        ${none}/20`)
  console.log(`Any EAN:                 ${20 - none}/20 (${Math.round((20 - none) / 20 * 100)}%)`)

  const outDir = path.join(__dirname, '..', 'data', 'ean-matching-test')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, `cross-validated-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify({ testedAt: new Date().toISOString(), stats: { verifiedCount, npcOnly, ddgOnly, offOnly, none }, results }, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
