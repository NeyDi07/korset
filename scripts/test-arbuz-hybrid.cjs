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
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...headers },
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
  if (r.status !== 200) throw new Error('Auth failed')
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

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    https.get({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html', 'Accept-Language': 'ru-RU,ru' },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function decodeHtml(str) {
  return str.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

function stripHtml(html) {
  if (!html) return null
  return html.replace(/<br\s*\/?>/gi, ', ').replace(/<\/p>/gi, ', ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/,(\s*,)+/g, ',').replace(/^\s*,\s*/, '').trim() || null
}

function extractBarcodesFromHtml(decoded) {
  const result = new Map()
  const re = /"barcode"\s*:\s*"(\d{8,14})"/g
  let m
  while ((m = re.exec(decoded)) !== null) {
    const barcode = m[1]
    const before = decoded.lastIndexOf('"id"', m.index)
    if (before === -1) continue
    const blockStart = decoded.lastIndexOf('{', before)
    const blockEnd = decoded.indexOf(',"catalog_id"', m.index)
    if (blockStart === -1 || blockEnd === -1) continue
    const block = decoded.substring(blockStart, blockEnd + 2000)
    const idMatch = block.match(/"id"\s*:\s*"?(\d+)"?/)
    if (idMatch) {
      result.set(idMatch[1], barcode)
    }
  }
  return result
}

async function main() {
  console.log('=== HYBRID TEST: API composition + HTML barcodes for 50 products ===\n')
  await getToken()
  console.log('Auth OK\n')

  const categoryQueries = [
    'шоколад', 'молоко', 'хлеб', 'сыр', 'масло',
    'кефир', 'напитки', 'чипсы', 'печенье', 'конфеты',
    'сок', 'кофе', 'мороженое', 'йогурт', 'колбаса',
    'макароны', 'крупа', 'кетчуп', 'майонез', 'вода',
  ]

  const allProducts = new Map()
  const barcodeMap = new Map()

  for (const query of categoryQueries) {
    if (allProducts.size >= 50) break

    // Step 1: API search — get products with composition
    const apiResult = await apiGet('/shop/search/products', { 'where[name][c]': query, limit: '50' })
    if (apiResult.error) { console.log(`  "${query}": API ${apiResult.error}`); continue }
    const apiProds = Array.isArray(apiResult.data) ? apiResult.data : []

    // Step 2: HTML search — get barcodes
    let htmlBarcodes = new Map()
    try {
      const html = await httpGet('https://arbuz.kz/ru/almaty/?q=' + encodeURIComponent(query))
      const decoded = decodeHtml(html)
      htmlBarcodes = extractBarcodesFromHtml(decoded)
    } catch (e) {
      console.log(`  "${query}": HTML error: ${e.message}`)
    }

    let newCount = 0
    let compCount = 0
    let nutCount = 0
    let bcFromHtml = 0

    for (const p of apiProds) {
      if (allProducts.has(p.id)) continue
      if (allProducts.size >= 50) break

      const composition = stripHtml(p.ingredients)
      const nutrition = p.nutrition || null
      const htmlBarcode = htmlBarcodes.get(String(p.id)) || null

      allProducts.set(p.id, {
        id: p.id,
        name: p.name,
        brand: p.brandName,
        ean: htmlBarcode,
        category: p.catalogName,
        price: p.priceActual,
        composition,
        nutrition,
        image: p.image ? p.image.replace(/w=%w&h=%h/, 'w=400&h=400') : null,
        halalChars: (p.characteristics || []).filter(c => c.name && c.name.toLowerCase().includes('халал')),
        country: p.producerCountry,
        sourceQuery: query,
      })

      newCount++
      if (composition) compCount++
      if (nutrition) nutCount++
      if (htmlBarcode) bcFromHtml++
    }

    console.log(`  "${query}": API ${apiProds.length} products, HTML ${htmlBarcodes.size} barcodes | +${newCount} new, comp=${compCount}, nut=${nutCount}, ean=${bcFromHtml}`)

    await sleep(400)
  }

  // Print results
  const products = [...allProducts.values()]
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`HYBRID TEST RESULTS: ${products.length} products`)
  console.log('═'.repeat(60))

  const stats = {
    total: products.length,
    withComp: products.filter(p => p.composition).length,
    withNut: products.filter(p => p.nutrition).length,
    withEan: products.filter(p => p.ean).length,
    withImage: products.filter(p => p.image).length,
    withHalal: products.filter(p => p.halalChars.length > 0).length,
  }

  console.log(`Total: ${stats.total}`)
  console.log(`Composition: ${stats.withComp}/${stats.total} (${(stats.withComp / stats.total * 100).toFixed(0)}%)`)
  console.log(`Nutrition: ${stats.withNut}/${stats.total} (${(stats.withNut / stats.total * 100).toFixed(0)}%)`)
  console.log(`EAN (from HTML): ${stats.withEan}/${stats.total} (${(stats.withEan / stats.total * 100).toFixed(0)}%)`)
  console.log(`Image: ${stats.withImage}/${stats.total} (${(stats.withImage / stats.total * 100).toFixed(0)}%)`)
  console.log(`Halal: ${stats.withHalal}/${stats.total}`)

  // Show sample products
  console.log('\nSample products (first 15):')
  products.slice(0, 15).forEach((p, i) => {
    const eanIcon = p.ean ? '✓' : '✗'
    const compIcon = p.composition ? '✓' : '✗'
    console.log(`${String(i + 1).padStart(2)} ${eanIcon}ean ${compIcon}comp | ${p.brand || '?'} — ${(p.name || '').substring(0, 45)} ${p.ean ? '(' + p.ean + ')' : ''}`)
  })

  // Products without EAN — how many?
  const noEan = products.filter(p => !p.ean)
  console.log(`\nProducts without EAN (${noEan.length}/${stats.total}):`)
  noEan.slice(0, 10).forEach(p => console.log(`  ${p.brand || '?'} — ${(p.name || '').substring(0, 40)}`))

  // Save
  fs.writeFileSync(path.join(OUT_DIR, 'hybrid-test-50.json'), JSON.stringify({
    testedAt: new Date().toISOString(),
    stats,
    products,
  }, null, 2))
  console.log(`\nSaved to ${OUT_DIR}/hybrid-test-50.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
