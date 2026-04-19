const https = require('https')
const { URL } = require('url')
const fs = require('fs')
const path = require('path')

const CONSUMER_NAME = 'arbuz-kz.web.mobile'
const CONSUMER_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
const API_BASE = 'https://arbuz.kz/api/v1'
const TOKEN_TTL = 10 * 60 * 1000
let _token = { value: null, expires: 0 }

function httpReq(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request({
      hostname: url.hostname, port: 443, path: url.pathname + url.search, method,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...headers },
      timeout: 20000,
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })) })
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

async function getToken() {
  if (_token.value && Date.now() < _token.expires) return _token.value
  const r = await httpReq('POST', API_BASE + '/auth/token', {}, { consumer: CONSUMER_NAME, key: CONSUMER_KEY })
  _token = { value: JSON.parse(r.body).data.token, expires: Date.now() + TOKEN_TTL }
  return _token.value
}

async function apiGet(path) {
  const token = await getToken()
  const r = await httpReq('GET', API_BASE + path, { Authorization: 'Bearer ' + token })
  if (r.status !== 200) return null
  try { return JSON.parse(r.body).data } catch { return null }
}

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    https.get({
      hostname: url.hostname, port: 443, path: url.pathname + url.search,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html', 'Accept-Language': 'ru-RU,ru' },
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)) }).on('error', reject)
  })
}

function decodeHtml(s) { return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10))) }

function stripHtml(html) {
  if (!html) return null
  return html.replace(/<br\s*\/?>/gi, ', ').replace(/<\/p>/gi, ', ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/,(\s*,)+/g, ',').replace(/^\s*,\s*/, '').trim() || null
}

function extractFullProductsFromHtml(decoded) {
  const products = []
  const seen = new Set()

  const bcRe = /"barcode"\s*:\s*"(\d{8,14})"/g
  let m

  while ((m = bcRe.exec(decoded)) !== null) {
    const barcode = m[1]
    const barcodePos = m.index

    const searchStart = Math.max(0, barcodePos - 5000)
    const searchEnd = Math.min(decoded.length, barcodePos + 2000)
    const chunk = decoded.substring(searchStart, searchEnd)

    const idRe = /"id"\s*:\s*"?(\d{3,})"?/g
    let idMatch, bestId = null, bestIdPos = -1
    while ((idMatch = idRe.exec(chunk)) !== null) {
      const absPos = searchStart + idMatch.index
      if (absPos < barcodePos && absPos > bestIdPos) { bestId = idMatch[1]; bestIdPos = absPos }
    }

    if (!bestId || seen.has(bestId)) continue
    seen.add(bestId)

    const nameRe = /"name"\s*:\s*"([^"]{3,200})"/g
    const brandRe = /"brandName"\s*:\s*"([^"]{1,100})"/g

    let name = null, brand = null
    let nm
    while ((nm = nameRe.exec(chunk)) !== null) { name = nm[1] }
    while ((nm = brandRe.exec(chunk)) !== null) { brand = nm[1] }

    const nutritionRe = /"nutrition"\s*:\s*\{([^}]{5,200})\}/g
    let nutrition = null
    let nm2
    while ((nm2 = nutritionRe.exec(chunk)) !== null) {
      try { nutrition = JSON.parse('{' + nm2[1] + '}') } catch {}
    }

    const ingredientsRe = /"ingredients"\s*:\s*"([^"]{3,})"/g
    let ingredients = null
    while ((nm2 = ingredientsRe.exec(chunk)) !== null) { ingredients = nm2[1] }

    const priceRe = /"priceActual"\s*:\s*(\d+)/g
    let price = null
    while ((nm2 = priceRe.exec(chunk)) !== null) { price = parseInt(nm2[1]) }

    const imageRe = /"image"\s*:\s*"([^"]+)"/g
    let image = null
    while ((nm2 = imageRe.exec(chunk)) !== null) {
      if (nm2[1].includes('http')) image = nm2[1].replace(/w=%w&h=%h/, 'w=400&h=400')
    }

    products.push({
      id: bestId,
      barcode,
      name,
      brand,
      price,
      ingredients: ingredients ? stripHtml(decodeHtml(ingredients)) : null,
      nutrition,
      image,
    })
  }

  return products
}

async function main() {
  console.log('=== HTML-FIRST APPROACH: Extract full products from HTML ===\n')

  const query = 'шоколад'
  console.log(`Fetching HTML for "${query}"...`)
  const html = await httpGet('https://arbuz.kz/ru/almaty/?q=' + encodeURIComponent(query))
  const decoded = decodeHtml(html)
  console.log(`HTML size: ${(decoded.length / 1024).toFixed(0)}KB\n`)

  const products = extractFullProductsFromHtml(decoded)
  console.log(`Products extracted: ${products.length}\n`)

  let withComp = 0, withNut = 0, withBrand = 0, withImage = 0
  products.slice(0, 30).forEach((p, i) => {
    const compIcon = p.ingredients ? '✓' : '✗'
    const nutIcon = p.nutrition ? '✓' : '✗'
    if (p.ingredients) withComp++
    if (p.nutrition) withNut++
    if (p.brand) withBrand++
    if (p.image) withImage++
    console.log(`${String(i + 1).padStart(2)} ${compIcon}comp ${nutIcon}nut | EAN=${p.barcode} ${p.brand || '?'} — ${(p.name || '?').substring(0, 45)}`)
    if (p.ingredients) console.log(`     ${p.ingredients.substring(0, 90)}...`)
  })

  withComp = products.filter(p => p.ingredients).length
  withNut = products.filter(p => p.nutrition).length
  withBrand = products.filter(p => p.brand).length
  withImage = products.filter(p => p.image).length

  console.log(`\n════════════════════════════════════════════`)
  console.log(`HTML EXTRACTION RESULTS`)
  console.log(`════════════════════════════════════════════`)
  console.log(`Products: ${products.length}`)
  console.log(`With EAN: ${products.length} (100% — all from HTML have barcodes)`)
  console.log(`With composition: ${withComp}/${products.length} (${(withComp / products.length * 100).toFixed(0)}%)`)
  console.log(`With nutrition: ${withNut}/${products.length} (${(withNut / products.length * 100).toFixed(0)}%)`)
  console.log(`With brand: ${withBrand}/${products.length} (${(withBrand / products.length * 100).toFixed(0)}%)`)
  console.log(`With image: ${withImage}/${products.length} (${(withImage / products.length * 100).toFixed(0)}%)`)

  // Now check: for products WITHOUT composition from HTML, can we get it from detail API?
  const noCompProducts = products.filter(p => !p.ingredients)
  if (noCompProducts.length > 0) {
    console.log(`\nProducts without composition from HTML: ${noCompProducts.length}`)
    console.log('Checking detail API for composition...')

    await getToken()
    let detailCompFound = 0
    for (const p of noCompProducts.slice(0, 5)) {
      process.stdout.write(`  Detail for id=${p.id} "${(p.name || '?').substring(0, 30)}"... `)
      const detail = await apiGet('/shop/product/' + p.id)
      if (detail) {
        const comp = stripHtml(detail.ingredients)
        if (comp) {
          detailCompFound++
          console.log(`✓ composition found (${comp.substring(0, 60)}...)`)
        } else {
          console.log('✗ no composition in detail either')
        }
      } else {
        console.log('✗ detail API failed')
      }
    }
    console.log(`Detail API composition recovery: ${detailCompFound}/${Math.min(5, noCompProducts.length)}`)
  }

  // Check: do we need multiple search pages? How many products total?
  console.log('\n--- Checking pagination: how many products per query? ---')
  for (const q of ['шоколад', 'молоко', 'чипсы']) {
    const h = await httpGet('https://arbuz.kz/ru/almaty/?q=' + encodeURIComponent(q))
    const d = decodeHtml(h)
    const prods = extractFullProductsFromHtml(d)
    console.log(`  "${q}": ${prods.length} products from HTML (1 page)`)
  }
}

main().catch(console.error)
