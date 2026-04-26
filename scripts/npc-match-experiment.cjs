const fs = require('fs')
const path = require('path')
const https = require('https')
const { URL } = require('url')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const { classifyBarcode } = require('./validate-ean.cjs')

const NPC_API_KEY = process.env.NPC_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const DELAY_MS = 350

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function httpPost(urlStr, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const url = new URL(urlStr)
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-API-KEY': NPC_API_KEY,
      },
    }
    const req = https.request(options, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) })
        } catch (_) {
          resolve({ status: res.statusCode, body: body.substring(0, 500) })
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(data)
    req.end()
  })
}

async function npcSearch(query, size = 20) {
  const r = await httpPost('https://nationalcatalog.kz/gw/search/api/v1/search', { query, page: 1, size })
  if (r.status !== 200) return { error: `HTTP ${r.status}`, items: [] }
  return { total: r.body.pageInfo?.totalSize || 0, items: r.body.items || [] }
}

function extractEans(item) {
  const eans = []
  if (item.gtin && item.gtin !== '-' && item.gtin.length >= 8) {
    const bc = classifyBarcode(item.gtin)
    if (bc.valid) eans.push({ ean: item.gtin, type: 'gtin', country: bc.country })
  }
  if (item.ntin && item.ntin !== '-') {
    eans.push({ ean: item.ntin, type: 'ntin', country: null })
  }
  return eans
}

function extractBrand(item) {
  const attrs = item.attributes || []
  const brandAttr = attrs.find(a => a.code === 'brand' && a.value)
  if (brandAttr) return (brandAttr.valueRu || brandAttr.value || '').trim()
  return ''
}

function scoreMatch(item, productName, productBrand) {
  let score = 0
  const nameRu = (item.nameRu || '').toLowerCase()
  const pName = productName.toLowerCase()
  const pBrand = (productBrand || '').toLowerCase().trim()

  if (pBrand && nameRu.includes(pBrand)) score += 10
  if (pBrand && pName.includes(pBrand)) score += 5

  const brandAttr = (item.attributes || []).find(a => a.code === 'brand' && a.value)
  if (brandAttr && pBrand) {
    const bv = (brandAttr.valueRu || brandAttr.value || '').toLowerCase().trim()
    if (bv && (bv.includes(pBrand) || pBrand.includes(bv))) score += 15
  }

  const nameWords = pName.split(/\s+/).filter(w => w.length > 2)
  for (const w of nameWords) {
    if (nameRu.includes(w)) score += 3
  }

  if (item.gtin && item.gtin !== '-') score += 5
  if (item.categoryNameRuL1?.includes('пищев') || item.categoryNameRuL1?.includes('азыт')) score += 3

  return score
}

function buildSearchQueries(product) {
  const name = product.name || ''
  const brand = product.brand || ''
  const queries = []

  // Method 1: brand + full name (current approach)
  queries.push({ method: 'brand+name', query: `${brand} ${name}`.trim().substring(0, 80) })

  // Method 2: brand + first 3 significant words from name
  const words = name.split(/\s+/).filter(w => w.length > 2 && !/^\d/.test(w))
  const shortName = words.slice(0, 3).join(' ')
  queries.push({ method: 'brand+3words', query: `${brand} ${shortName}`.trim().substring(0, 80) })

  // Method 3: brand + weight/size keywords only
  const weightWords = name.split(/\s+/).filter(w => /^\d+[,.]?\d*\s*(г|кг|мл|л|шт)/.test(w))
  if (weightWords.length > 0) {
    const coreWords = words.filter(w => !/^\d+[,.]?\d*\s*(г|кг|мл|л|шт)/.test(w)).slice(0, 2)
    queries.push({ method: 'brand+core+weight', query: `${brand} ${coreWords.join(' ')} ${weightWords[0]}`.trim().substring(0, 80) })
  }

  // Method 4: brand only (broad search, pick best matches from many results)
  if (brand) {
    queries.push({ method: 'brand-only', query: brand.substring(0, 80) })
  }

  // Method 5: name without brand
  if (words.length > 1) {
    queries.push({ method: 'name-no-brand', query: shortName.substring(0, 80) })
  }

  // Method 6: brand + product type (last significant word)
  if (brand && words.length > 0) {
    const typeWord = words[words.length - 1]
    queries.push({ method: 'brand+type', query: `${brand} ${typeWord}`.trim().substring(0, 80) })
  }

  // Deduplicate queries
  const seen = new Set()
  return queries.filter(q => {
    if (seen.has(q.query)) return false
    seen.add(q.query)
    return q.query.length >= 3
  })
}

async function main() {
  if (!NPC_API_KEY) { console.error('NPC_API_KEY not set'); process.exit(1) }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('SUPABASE_URL/SERVICE_ROLE_KEY not set'); process.exit(1) }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  // Get products with fake EANs AND real brands
  const { data: fakeEans, error } = await sb
    .from('global_products')
    .select('id, ean, name, name_kz, brand, source_primary')
    .eq('is_active', true)
    .or('ean.like.korzinavdom_%,ean.like.arbuz_%,ean.like.kaspi_%')
    .neq('brand', '')
    .not('brand', 'ilike', '%?%')
    .limit(30)

  if (error) { console.error('DB error:', error); process.exit(1) }
  const toTest = (fakeEans || []).filter(p => p.brand && p.brand.length > 1)
  console.log(`Testing ${toTest.length} products with multiple search methods\n`)

  const methodStats = {}
  const results = []

  for (let i = 0; i < toTest.length; i++) {
    const p = toTest[i]
    console.log(`\n[${i + 1}/${toTest.length}] ${p.brand} — ${p.name?.substring(0, 40)}`)

    const queries = buildSearchQueries(p)
    const productResult = { id: p.id, brand: p.brand, name: p.name, methods: {} }

    for (const { method, query } of queries) {
      if (!methodStats[method]) {
        methodStats[method] = { queries: 0, totalItems: 0, eansFound: 0, highScoreMatches: 0, uniqueEans: new Set() }
      }

      try {
        const r = await npcSearch(query, 20)
        if (r.error) {
          console.log(`  ${method}: ERROR ${r.error}`)
          productResult.methods[method] = { error: r.error }
          await sleep(DELAY_MS)
          continue
        }

        methodStats[method].queries++
        methodStats[method].totalItems += (r.items?.length || 0)

        // Score all items and collect EANs
        const scored = (r.items || [])
          .map(item => ({ item, score: scoreMatch(item, p.name, p.brand) }))
          .sort((a, b) => b.score - a.score)

        // Collect ALL EANs from items with score >= 10
        const allEans = []
        const goodMatches = scored.filter(s => s.score >= 10)
        for (const m of goodMatches) {
          const eans = extractEans(m.item)
          for (const e of eans) {
            if (!allEans.find(a => a.ean === e.ean)) {
              allEans.push({ ...e, score: m.score, npcName: m.item.nameRu })
            }
          }
        }

        const gtinCount = allEans.filter(e => e.type === 'gtin').length
        const bestScore = scored[0]?.score || 0

        methodStats[method].eansFound += allEans.length
        methodStats[method].highScoreMatches += goodMatches.length
        for (const e of allEans) methodStats[method].uniqueEans.add(e.ean)

        productResult.methods[method] = {
          query,
          totalResults: r.total,
          returnedItems: r.items?.length || 0,
          bestScore,
          goodMatches: goodMatches.length,
          totalEans: allEans.length,
          gtins: gtinCount,
          eans: allEans.slice(0, 5).map(e => `${e.ean}(${e.type},s${e.score})`),
        }

        console.log(`  ${method}: total=${r.total} best=${bestScore} good≥10=${goodMatches.length} eans=${allEans.length}(gtin:${gtinCount}) q="${query.substring(0, 40)}"`)

        await sleep(DELAY_MS)
      } catch (e) {
        console.log(`  ${method}: ERR ${e.message}`)
        productResult.methods[method] = { error: e.message }
      }
    }

    results.push(productResult)
  }

  // Summary
  console.log('\n\n========== METHOD COMPARISON ==========\n')
  const summaryRows = []
  for (const [method, stats] of Object.entries(methodStats)) {
    const avgItems = stats.queries > 0 ? (stats.totalItems / stats.queries).toFixed(1) : 0
    const avgEans = stats.queries > 0 ? (stats.eansFound / stats.queries).toFixed(1) : 0
    const avgGood = stats.queries > 0 ? (stats.highScoreMatches / stats.queries).toFixed(1) : 0
    summaryRows.push({
      method,
      queries: stats.queries,
      avgResults: avgItems,
      avgGoodMatches: avgGood,
      avgEansPerQuery: avgEans,
      uniqueEans: stats.uniqueEans.size,
    })
    console.log(`${method.padEnd(20)} queries=${stats.queries} avgResults=${avgItems} avgGoodMatches=${avgGood} avgEans=${avgEans} uniqueEans=${stats.uniqueEans.size}`)
  }

  // Best method determination: most unique EANs per query * quality (good matches)
  console.log('\n========== RANKING ==========')
  const ranked = summaryRows.map(r => ({
    ...r,
    efficiency: parseFloat(r.avgEansPerQuery) * parseFloat(r.avgGoodMatches),
  })).sort((a, b) => b.efficiency - a.efficiency)

  ranked.forEach((r, i) => {
    console.log(`#${i + 1} ${r.method.padEnd(20)} efficiency=${r.efficiency.toFixed(2)} (eans/query=${r.avgEansPerQuery} × goodMatches=${r.avgGoodMatches})`)
  })

  console.log(`\n🏆 BEST METHOD: ${ranked[0].method} (efficiency ${ranked[0].efficiency.toFixed(2)})`)

  // Save full results
  const outFile = path.join(__dirname, '..', 'data', `npc-experiment-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  if (!fs.existsSync(path.dirname(outFile))) fs.mkdirSync(path.dirname(outFile), { recursive: true })
  const saveData = { testedAt: new Date().toISOString(), summary: ranked, methodStats: summaryRows, results }
  fs.writeFileSync(outFile, JSON.stringify(saveData, null, 2))
  console.log(`\nSaved: ${outFile}`)
}

main().catch(e => { console.error(e); process.exit(1) })
