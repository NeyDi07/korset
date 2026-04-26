require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { classifyBarcode } = require('./validate-ean.cjs')
const https = require('https')
const { URL } = require('url')

const NPC_API_KEY = process.env.NPC_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function httpPost(urlStr, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const url = new URL(urlStr)
    const options = {
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'X-API-KEY': NPC_API_KEY },
    }
    const req = https.request(options, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(body) }) } catch (_) { resolve({ status: res.statusCode, body: body.substring(0, 200) }) } })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(data); req.end()
  })
}

async function npcSearch(query, size = 10) {
  const r = await httpPost('https://nationalcatalog.kz/gw/search/api/v1/search', { query, page: 1, size })
  if (r.status !== 200) return { total: 0, items: [] }
  return { total: r.body.pageInfo?.totalSize || 0, items: r.body.items || [] }
}

function extractEan(item) {
  if (item.gtin && item.gtin !== '-' && item.gtin.length >= 8) {
    const bc = classifyBarcode(item.gtin)
    if (bc.valid) return { ean: item.gtin, type: 'gtin', country: bc.country }
  }
  if (item.ntin && item.ntin !== '-') return { ean: item.ntin, type: 'ntin', country: null }
  return null
}

function extractBrandAttr(item) {
  const a = (item.attributes || []).find(a => a.code === 'brand' && a.value)
  return a ? (a.valueRu || a.value || '').trim() : ''
}

function scoreMatch(item, productName, productBrand) {
  let score = 0
  const nameRu = (item.nameRu || '').toLowerCase()
  const pName = productName.toLowerCase()
  const pBrand = (productBrand || '').toLowerCase().trim()
  if (pBrand && nameRu.includes(pBrand)) score += 10
  if (pBrand && pName.includes(pBrand)) score += 5
  const brandAttr = extractBrandAttr(item)
  if (brandAttr && pBrand) {
    const bv = brandAttr.toLowerCase()
    if (bv && (bv.includes(pBrand) || pBrand.includes(bv))) score += 15
  }
  const nameWords = pName.split(/\s+/).filter(w => w.length > 2)
  for (const w of nameWords) { if (nameRu.includes(w)) score += 3 }
  if (item.gtin && item.gtin !== '-') score += 5
  if (item.categoryNameRuL1?.includes('пищев') || item.categoryNameRuL1?.includes('азыт')) score += 3
  return score
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function collectEans(items, productName, productBrand, minScore = 10) {
  const gtins = [], ntins = [], seen = new Set()
  for (const item of items) {
    const score = scoreMatch(item, productName, productBrand)
    if (score < minScore) continue
    const eanInfo = extractEan(item)
    if (eanInfo && !seen.has(eanInfo.ean)) {
      seen.add(eanInfo.ean)
      if (eanInfo.type === 'gtin') gtins.push({ ean: eanInfo.ean, score })
      else ntins.push({ ean: eanInfo.ean, score })
    }
  }
  gtins.sort((a, b) => b.score - a.score)
  ntins.sort((a, b) => b.score - a.score)
  return { gtins, ntins, primaryGtin: gtins[0]?.ean || null }
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const PAGE_SIZE = 999
  let allProducts = [], page = 0
  while (true) {
    const { data: chunk } = await sb.from('global_products')
      .select('id, ean, name, brand, source_primary, alternate_eans')
      .eq('is_active', true).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (!chunk || chunk.length === 0) break
    allProducts = allProducts.concat(chunk); page++
    if (chunk.length < PAGE_SIZE) break
  }

  const needsEan = allProducts.filter(p => {
    if (!p.ean) return true
    if (p.ean.startsWith('arbuz_') || p.ean.startsWith('kaspi_') || p.ean.startsWith('korzinavdom_')) return true
    return !classifyBarcode(p.ean).valid
  }).filter(p => p.brand && p.brand.length > 1 && p.brand !== '?')

  const sample = needsEan.slice(0, 20)
  console.log(`\n=== TESTING ON ${sample.length} PRODUCTS ===\n`)

  const methods = {
    A: { name: '3 queries seq (brand+name, core+weight, brand-only), size=20, 400ms delay', queries: 'full', size: 20, parallel: false, delay: 400 },
    B: { name: '1 query only (brand+name), size=10, 0 delay', queries: 'single', size: 10, parallel: false, delay: 0 },
    C: { name: '1 query (brand+name), size=20, 0 delay', queries: 'single', size: 20, parallel: false, delay: 0 },
    D: { name: '2 queries parallel (brand+name + brand-only), size=10, 0 delay', queries: 'dual', size: 10, parallel: true, delay: 0 },
    E: { name: '1 query (brand+name), size=5, 0 delay — MINIMAL', queries: 'single', size: 5, parallel: false, delay: 0 },
  }

  for (const [code, method] of Object.entries(methods)) {
    console.log(`\n--- Method ${code}: ${method.name} ---`)
    let totalPrimary = 0, totalGtins = 0, totalNtins = 0, totalTime = 0, noMatch = 0

    for (let i = 0; i < sample.length; i++) {
      const p = sample[i]
      const t0 = Date.now()

      let queries = []
      const name = p.name || ''
      const brand = p.brand || ''
      const q1 = `${brand} ${name}`.trim().substring(0, 80)
      if (q1.length >= 3) queries.push({ query: q1, label: 'full' })

      if (method.queries === 'full' || method.queries === 'dual') {
        if (brand && brand.length >= 2 && brand !== q1) {
          queries.push({ query: brand.substring(0, 80), label: 'brand-only' })
        }
      }

      if (method.queries === 'full') {
        const words = name.split(/\s+/).filter(w => w.length > 2)
        const weightMatch = name.match(/(\d+[,.]?\d*\s*(г|кг|мл|л|шт))/i)
        const coreWords = words.filter(w => !/^\d+[,.]?\d*\s*(г|кг|мл|л|шт)/.test(w) && w !== brand).slice(0, 2)
        if (coreWords.length > 0 && weightMatch) {
          const q2 = `${brand} ${coreWords.join(' ')} ${weightMatch[1]}`.trim().substring(0, 80)
          if (q2 !== q1 && q2.length >= 3) queries.push({ query: q2, label: 'core+weight' })
        }
      }

      queries = queries.filter((q, idx, arr) => arr.findIndex(x => x.query === q.query) === idx)

      let allItems = []
      if (method.parallel) {
        const results = await Promise.all(queries.map(q => npcSearch(q.query, method.size)))
        for (const r of results) allItems = allItems.concat(r.items || [])
      } else {
        for (const q of queries) {
          const r = await npcSearch(q.query, method.size)
          allItems = allItems.concat(r.items || [])
          if (method.delay > 0) await sleep(method.delay)
        }
      }

      const elapsed = Date.now() - t0
      totalTime += elapsed

      const { gtins, ntins, primaryGtin } = collectEans(allItems, p.name, p.brand)
      totalGtins += gtins.length
      totalNtins += ntins.length
      if (primaryGtin) totalPrimary++
      else noMatch++

      const tag = primaryGtin ? `✓ primary:${primaryGtin} gtins:${gtins.length} ntins:${ntins.length}` : `✗ no primary (gtins:${gtins.length})`
      console.log(`  [${i + 1}] ${brand.substring(0, 15)}: ${tag} (${elapsed}ms, ${queries.length}q)`)
    }

    console.log(`\n  RESULTS Method ${code}:`)
    console.log(`    Primary GTINs: ${totalPrimary}/${sample.length} (${(totalPrimary / sample.length * 100).toFixed(0)}%)`)
    console.log(`    No match: ${noMatch}`)
    console.log(`    Total GTINs: ${totalGtins}, NTINs: ${totalNtins}`)
    console.log(`    Avg time/product: ${(totalTime / sample.length).toFixed(0)}ms`)
    console.log(`    Total time: ${(totalTime / 1000).toFixed(1)}s`)
    console.log(`    Speed estimate for 5000 products: ${(totalTime / sample.length * 5000 / 1000 / 60).toFixed(0)} min`)
  }

  console.log('\n=== DONE ===')
}

main().catch(e => { console.error(e); process.exit(1) })
