const https = require('https')
const { URL } = require('url')
const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'data', 'arbuz-methods')
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

const CONSUMER_NAME = 'arbuz-kz.web.mobile'
const CONSUMER_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
const API_BASE = 'https://arbuz.kz/api/v1'
const TOKEN_TTL = 10 * 60 * 1000

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
        'Accept': 'application/json', 'Content-Type': 'application/json',
        'Accept-Language': 'ru-RU,ru', ...headers,
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
  const r = await httpReq('POST', API_BASE + '/auth/token', {}, { consumer: CONSUMER_NAME, key: CONSUMER_KEY })
  if (r.status !== 200) throw new Error('Auth failed: ' + r.status)
  _token = { value: JSON.parse(r.body).data.token, expires: Date.now() + TOKEN_TTL }
  return _token.value
}

async function apiGet(path, params = {}) {
  const token = await getToken()
  const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  const url = API_BASE + path + (qs ? '?' + qs : '')
  const r = await httpReq('GET', url, { Authorization: 'Bearer ' + token })
  if (r.status !== 200) return { error: 'HTTP ' + r.status, data: null }
  try { return { error: null, data: JSON.parse(r.body).data } } catch { return { error: 'parse', data: null } }
}

function stripHtml(html) {
  if (!html) return null
  return html
    .replace(/<br\s*\/?>/gi, ', ').replace(/<\/p>/gi, ', ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/,(\s*,)+/g, ',').replace(/^\s*,\s*/, '').trim() || null
}

async function main() {
  console.log('=== ARBUZ CATALOG WALK: 50 products straight from Arbuz ===\n')
  await getToken()
  console.log('Auth OK\n')

  // Step 1: Discover all available browse methods
  console.log('Step 1: Finding how to browse Arbuz catalog...\n')

  // Try collections — known working
  const allCollections = []
  const collectionIds = [251362, 251965, 252029, 252032, 252033, 252034, 252035, 252104, 251921, 251967, 252026]

  // Also try to find more collections via search for popular categories
  const categorySearches = [
    'шоколад', 'молоко', 'хлеб', 'сыр', 'масло', 'кефир', 'напитки',
    'чипсы', 'печенье', 'конфеты', 'сок', 'вода', 'кофе', 'чай',
    'мороженое', 'йогурт', 'творог', 'колбаса', 'рис', 'макароны',
    'крупа', 'сахар', 'мука', 'кетчуп', 'майонез',
  ]

  // Method A: Browse by popular search queries
  console.log('Method A: Browse by popular category searches\n')
  let allProducts = []
  const seen = new Set()
  const stats = { total: 0, withComp: 0, withNut: 0, withBarcode: 0, withHalal: 0, withImage: 0 }

  for (const query of categorySearches) {
    if (allProducts.length >= 50) break

    const r = await apiGet('/shop/search/products', { 'where[name][c]': query, limit: '50' })
    if (r.error) { console.log(`  "${query}": ${r.error}`); continue }

    const prods = Array.isArray(r.data) ? r.data : []
    let newCount = 0
    for (const p of prods) {
      if (seen.has(p.id)) continue
      seen.add(p.id)

      const comp = stripHtml(p.ingredients)
      const hasComp = !!comp
      const hasNut = !!p.nutrition
      const hasBarcode = !!(p.barcode || p.articleIndex)
      const hasImage = !!p.image
      const hasHalal = !!(p.characteristics && p.characteristics.some(c => c.name && c.name.toLowerCase().includes('халал')))

      allProducts.push({
        id: p.id,
        name: p.name,
        brand: p.brandName,
        barcode: p.barcode || p.articleIndex || null,
        category: p.catalogName || null,
        price: p.priceActual || null,
        hasComp,
        hasNut,
        hasBarcode,
        hasImage,
        hasHalal,
        composition: comp ? comp.substring(0, 150) : null,
        nutrition: p.nutrition || null,
        image: p.image ? p.image.replace(/w=%w&h=%h/, 'w=100&h=100') : null,
        sourceQuery: query,
      })

      stats.total++
      if (hasComp) stats.withComp++
      if (hasNut) stats.withNut++
      if (hasBarcode) stats.withBarcode++
      if (hasImage) stats.withImage++
      if (hasHalal) stats.withHalal++
      newCount++
    }
    console.log(`  "${query}": ${prods.length} results, ${newCount} new (total unique: ${allProducts.length})`)

    await sleep(300)
  }

  // If we still need more, try collections
  if (allProducts.length < 50) {
    console.log('\n  Need more, trying collections...')
    for (const cid of collectionIds) {
      if (allProducts.length >= 50) break
      const r = await apiGet(`/shop/publications-products/${cid}`)
      if (r.error) continue
      const prods = Array.isArray(r.data) ? r.data : []
      let newCount = 0
      for (const p of prods) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        const comp = stripHtml(p.ingredients)
        allProducts.push({
          id: p.id, name: p.name, brand: p.brandName,
          barcode: p.barcode || p.articleIndex || null,
          category: p.catalogName || null, price: p.priceActual || null,
          hasComp: !!comp, hasNut: !!p.nutrition, hasBarcode: !!(p.barcode || p.articleIndex),
          hasImage: !!p.image, hasHalal: false,
          composition: comp ? comp.substring(0, 150) : null, nutrition: p.nutrition || null,
          image: p.image ? p.image.replace(/w=%w&h=%h/, 'w=100&h=100') : null,
          sourceQuery: 'collection-' + cid,
        })
        stats.total++; if (comp) stats.withComp++; if (p.nutrition) stats.withNut++
        if (p.barcode || p.articleIndex) stats.withBarcode++; if (p.image) stats.withImage++
        newCount++
      }
      console.log(`  Collection ${cid}: +${newCount} new`)
      await sleep(300)
    }
  }

  // Take first 50
  const testSet = allProducts.slice(0, 50)

  // Print results
  console.log('\n' + '═'.repeat(60))
  console.log('50 PRODUCTS FROM ARBUZ — COMPOSITION CHECK')
  console.log('═'.repeat(60))

  testSet.forEach((p, i) => {
    const compIcon = p.hasComp ? '✓' : '✗'
    const nutIcon = p.hasNut ? '✓' : '✗'
    const bcIcon = p.hasBarcode ? '✓' : '✗'
    console.log(`${String(i + 1).padStart(2)} ${compIcon}comp ${nutIcon}nut ${bcIcon}ean | ${p.brand || '?'} — ${(p.name || '').substring(0, 45)}`)
    if (p.composition) {
      console.log(`     ${p.composition.substring(0, 90)}...`)
    }
  })

  console.log('\n' + '═'.repeat(60))
  console.log('SUMMARY')
  console.log('═'.repeat(60))
  const testStats = {
    total: testSet.length,
    withComp: testSet.filter(p => p.hasComp).length,
    withNut: testSet.filter(p => p.hasNut).length,
    withBarcode: testSet.filter(p => p.hasBarcode).length,
    withImage: testSet.filter(p => p.hasImage).length,
    withHalal: testSet.filter(p => p.hasHalal).length,
  }
  console.log(`Products: ${testStats.total}`)
  console.log(`Composition: ${testStats.withComp}/${testStats.total} (${(testStats.withComp / testStats.total * 100).toFixed(0)}%)`)
  console.log(`Nutrition: ${testStats.withNut}/${testStats.total} (${(testStats.withNut / testStats.total * 100).toFixed(0)}%)`)
  console.log(`Barcode/EAN: ${testStats.withBarcode}/${testStats.total} (${(testStats.withBarcode / testStats.total * 100).toFixed(0)}%)`)
  console.log(`Image: ${testStats.withImage}/${testStats.total} (${(testStats.withImage / testStats.total * 100).toFixed(0)}%)`)
  console.log(`Halal char: ${testStats.withHalal}/${testStats.total}`)

  // Check: what about products WITHOUT composition?
  const noComp = testSet.filter(p => !p.hasComp)
  if (noComp.length > 0) {
    console.log(`\nProducts WITHOUT composition (${noComp.length}):`)
    noComp.forEach(p => console.log(`  ${p.brand || '?'} — ${p.name}`))
  }

  // Check: how many have barcodes for matching with NPC/OFF?
  const withBarcode = testSet.filter(p => p.hasBarcode)
  console.log(`\nProducts with EAN/barcode (can match with NPC/OFF): ${withBarcode.length}/${testStats.total}`)

  // Save
  fs.writeFileSync(path.join(OUT_DIR, 'arbuz-catalog-50.json'), JSON.stringify({
    testedAt: new Date().toISOString(),
    stats: testStats,
    products: testSet,
  }, null, 2))
  console.log(`\nSaved to ${OUT_DIR}/arbuz-catalog-50.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
