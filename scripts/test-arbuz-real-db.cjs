const fs = require('fs')
const path = require('path')
const https = require('https')
const { URL } = require('url')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const CONSUMER_NAME = 'arbuz-kz.web.mobile'
const CONSUMER_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
const API_BASE = 'https://arbuz.kz/api/v1'
const TOKEN_TTL = 10 * 60 * 1000
const DELAY_MS = 350
const OUT_DIR = path.join(__dirname, '..', 'data', 'arbuz-methods')

let _token = { value: null, expires: 0 }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function httpReq(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Accept-Language': 'ru-RU,ru',
        ...headers,
      },
      timeout: 20000,
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

async function getToken() {
  if (_token.value && Date.now() < _token.expires) return _token.value
  const r = await httpReq('POST', API_BASE + '/auth/token', {}, {
    consumer: CONSUMER_NAME, key: CONSUMER_KEY,
  })
  if (r.status !== 200) throw new Error(`Auth failed: ${r.status}`)
  const json = JSON.parse(r.body)
  _token = { value: json.data.token, expires: Date.now() + TOKEN_TTL }
  return _token.value
}

async function searchArbuz(query, limit = 50) {
  const token = await getToken()
  const qs = `where[name][c]=${encodeURIComponent(query)}&limit=${limit}`
  const r = await httpReq('GET', API_BASE + '/shop/search/products?' + qs, { Authorization: 'Bearer ' + token })
  if (r.status !== 200) return []
  try {
    const json = JSON.parse(r.body)
    return Array.isArray(json.data) ? json.data : []
  } catch { return [] }
}

function stripHtml(html) {
  if (!html) return null
  return html
    .replace(/<br\s*\/?>/gi, ', ').replace(/<\/p>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&plusmn;/g, '±').replace(/&mdash;/g, '—').replace(/&deg;/g, '°')
    .replace(/,(\s*,)+/g, ',').replace(/^\s*,\s*/, '').trim() || null
}

function normalize(str) {
  return (str || '').toLowerCase()
    .replace(/[éèêë]/g, 'e').replace(/[áàâä]/g, 'a')
    .replace(/[íìîï]/g, 'i').replace(/[óòôö]/g, 'o')
    .replace(/[úùûü]/g, 'u').replace(/[''`]/g, "'").replace(/['']/g, "'")
}

function matchScore(arbuzProduct, dbProduct) {
  let score = 0
  const pName = normalize(arbuzProduct.name)
  const pBrand = normalize(arbuzProduct.brandName)
  const dbName = normalize(dbProduct.name)
  const dbBrand = normalize(dbProduct.brand)

  if (dbBrand && pBrand === dbBrand) score += 80
  else if (dbBrand && pBrand.includes(dbBrand)) score += 50
  else if (dbBrand && dbBrand.includes(pBrand) && pBrand.length > 2) score += 40
  else if (dbBrand && pName.includes(dbBrand)) score += 20

  if (arbuzProduct.barcode && dbProduct.ean && arbuzProduct.barcode === dbProduct.ean) score += 100

  const nameWords = dbName.split(/\s+/).filter(w => w.length > 2)
  for (const w of nameWords) {
    if (pName.includes(w)) score += 8
  }

  const brandWords = dbBrand.split(/\s+/).filter(w => w.length > 2)
  for (const w of brandWords) {
    if (pName.includes(w)) score += 5
  }

  if (arbuzProduct.ingredients) score += 2
  if (arbuzProduct.nutrition) score += 2

  return score
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Supabase keys not set')
    process.exit(1)
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log('Authenticating...')
  try {
    await getToken()
    console.log('Auth OK\n')
  } catch (e) {
    console.error('Auth FAILED:', e.message)
    process.exit(1)
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data: products, error } = await sb
    .from('global_products')
    .select('id, ean, name, brand, ingredients_raw, halal_status, name_kz, source_primary')
    .eq('is_active', true)

  if (error) { console.error('DB error:', error); process.exit(1) }

  const needsComp = products.filter(p => !p.ingredients_raw || p.ingredients_raw.trim() === '')
  console.log(`Total: ${products.length}, Need composition: ${needsComp.length}`)

  const testSet = needsComp.slice(0, 50)
  console.log(`Testing ${testSet.length} products\n`)

  const results = []
  let found = 0, compFound = 0, nutFound = 0, noMatch = 0

  for (let i = 0; i < testSet.length; i++) {
    const p = testSet[i]
    const label = `[${i + 1}/${testSet.length}] #${p.id} ${p.brand || '?'} — ${(p.name || '').substring(0, 30)}`
    process.stdout.write(label + '... ')

    const queries = []
    const brand = (p.brand || '').trim()
    const name = (p.name || '').trim()

    if (brand.length >= 2) queries.push(brand)
    if (name.length >= 3 && name !== brand) queries.push(name)
    if (brand && name && !name.startsWith(brand)) queries.push(brand + ' ' + name.split(/\s+/).slice(0, 3).join(' '))
    if (brand.length > 3) queries.push(brand.split(/\s+/)[0])

    let bestMatch = null
    let bestScore = 0
    let matchedQuery = null

    for (const q of queries.slice(0, 3)) {
      if (q.length < 2) continue
      try {
        const arbuzResults = await searchArbuz(q, 50)
        for (const ap of arbuzResults) {
          const score = matchScore(ap, p)
          if (score > bestScore) {
            bestScore = score
            bestMatch = ap
            matchedQuery = q
          }
        }
      } catch (e) {}
      await sleep(DELAY_MS)
      if (bestScore >= 50) break
    }

    if (!bestMatch || bestScore < 30) {
      console.log(`✗ no match (best=${bestScore})`)
      noMatch++
      results.push({ id: p.id, ean: p.ean, name: p.name, brand: p.brand, status: 'no_match', bestScore, queries })
      continue
    }

    const composition = stripHtml(bestMatch.ingredients)
    const nutrition = bestMatch.nutrition || null
    const barcode = bestMatch.barcode || bestMatch.articleIndex || null

    found++
    if (composition) compFound++
    if (nutrition) nutFound++

    const barcodeMatch = barcode && p.ean && barcode === p.ean

    console.log(`✓ q="${matchedQuery}" score=${bestScore}${barcodeMatch ? ' [EAN✓]' : ''} comp=${!!composition} nut=${!!nutrition}`)
    console.log(`    Arbuz: ${bestMatch.brandName || '?'} — ${(bestMatch.name || '').substring(0, 50)}`)

    if (composition) {
      console.log(`    Comp: ${composition.substring(0, 80)}...`)
    }

    results.push({
      id: p.id, ean: p.ean, name: p.name, brand: p.brand,
      status: 'found',
      arbuzId: bestMatch.id,
      arbuzName: bestMatch.name,
      arbuzBrand: bestMatch.brandName,
      arbuzBarcode: barcode,
      matchedQuery,
      score: bestScore,
      barcodeMatch,
      composition,
      nutrition,
      hasHalalChar: !!(bestMatch.characteristics && bestMatch.characteristics.length > 0),
    })
  }

  console.log('\n' + '═'.repeat(60))
  console.log('RESULTS ON 50 REAL DB PRODUCTS')
  console.log('═'.repeat(60))
  console.log(`Processed: ${testSet.length}`)
  console.log(`Found: ${found}/${testSet.length} (${(found / testSet.length * 100).toFixed(0)}%)`)
  console.log(`Composition: ${compFound}/${testSet.length} (${(compFound / testSet.length * 100).toFixed(0)}%)`)
  console.log(`Nutrition: ${nutFound}/${testSet.length}`)
  console.log(`No match: ${noMatch}`)

  const barcodeMatches = results.filter(r => r.barcodeMatch).length
  console.log(`EAN-verified matches: ${barcodeMatches}`)

  const noMatchResults = results.filter(r => r.status === 'no_match')
  if (noMatchResults.length > 0) {
    console.log(`\nUnmatched products:`)
    noMatchResults.forEach(r => console.log(`  ${r.brand || '?'} — ${r.name || '?'} (tried: ${r.queries?.join(', ')})`))
  }

  fs.writeFileSync(path.join(OUT_DIR, 'real-db-test-50.json'), JSON.stringify({
    testedAt: new Date().toISOString(),
    stats: { processed: testSet.length, found, compFound, nutFound, noMatch, barcodeMatches },
    results,
  }, null, 2))
  console.log(`\nSaved to ${OUT_DIR}/real-db-test-50.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
