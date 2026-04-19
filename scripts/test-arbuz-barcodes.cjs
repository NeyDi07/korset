const https = require('https')
const { URL } = require('url')
const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'data', 'arbuz-methods')
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    https.get({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'ru-RU,ru',
      },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function decodeHtml(str) {
  return str
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

function stripHtml(html) {
  if (!html) return null
  return html.replace(/<br\s*\/?>/gi, ', ').replace(/<\/p>/gi, ', ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/,(\s*,)+/g, ',').replace(/^\s*,\s*/, '').trim() || null
}

const CONSUMER_NAME = 'arbuz-kz.web.mobile'
const CONSUMER_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
const API_BASE = 'https://arbuz.kz/api/v1'
const TOKEN_TTL = 10 * 60 * 1000
let _token = { value: null, expires: 0 }

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

async function main() {
  console.log('=== BARCODE SOURCES TEST ===\n')

  // METHOD 1: HTML scraping from search page
  console.log('--- Method 1: HTML search page barcodes ---')
  const queries = ['шоколад', 'молоко', 'чипсы']
  let htmlBarcodes = new Set()

  for (const q of queries) {
    console.log(`Fetching HTML for "${q}"...`)
    const html = await httpGet('https://arbuz.kz/ru/almaty/?q=' + encodeURIComponent(q))
    const decoded = decodeHtml(html)

    // Find barcodes in JSON embedded in HTML
    const bcRe = /"barcode"\s*:\s*"(\d{8,14})"/g
    let m
    while ((m = bcRe.exec(decoded)) !== null) {
      htmlBarcodes.add(m[1])
    }

    // Also check article_index
    const artRe = /"article_index"\s*:\s*"(\d{8,14})"/g
    while ((m = artRe.exec(decoded)) !== null) {
      htmlBarcodes.add(m[1])
    }

    console.log(`  Found ${htmlBarcodes.size} unique barcodes so far`)
  }

  console.log(`\nHTML barcodes total: ${htmlBarcodes.size}`)
  const bcArr = [...htmlBarcodes]
  bcArr.slice(0, 10).forEach(b => console.log(`  ${b}`))

  // METHOD 2: NPC search by product NAME (not EAN)
  console.log('\n--- Method 2: NPC search by product name ---')

  const NPC_API_KEY = process.env.NPC_API_KEY
  if (!NPC_API_KEY) {
    console.log('NPC_API_KEY not set, skipping')
  } else {
    // Get some Arbuz products first
    await getToken()
    const r = await apiGet('/shop/search/products', { 'where[name][c]': 'шоколад', limit: '10' })
    const prods = Array.isArray(r.data) ? r.data : []

    console.log(`Got ${prods.length} Arbuz products for NPC name search test\n`)

    let npcFound = 0, npcEans = 0
    for (const p of prods.slice(0, 5)) {
      const searchName = (p.name || '').substring(0, 60)
      process.stdout.write(`  NPC search "${searchName}"... `)

      try {
        const npcR = await httpReq('POST', 'https://nationalcatalog.kz/gw/search/api/v1/search', {
          'X-API-KEY': NPC_API_KEY,
          'Content-Type': 'application/json',
        }, { query: searchName, page: 1, size: 3 })

        if (npcR.status !== 200) {
          console.log(`HTTP ${npcR.status}`)
          continue
        }

        const npcData = JSON.parse(npcR.body)
        const items = npcData.items || []
        if (items.length > 0) {
          npcFound++
          const item = items[0]
          const gtin = item.gtin || null
          const nameRu = item.nameRu || null
          if (gtin) npcEans++
          console.log(`✓ NPC: gtin=${gtin || 'none'} name="${(nameRu || '').substring(0, 40)}"`)
        } else {
          console.log('not found')
        }
      } catch (e) {
        console.log(`error: ${e.message}`)
      }
    }
    console.log(`NPC by name: found=${npcFound}/5, with EAN=${npcEans}/5`)
  }

  // METHOD 3: Detail API — check ALL fields for barcode-like data
  console.log('\n--- Method 3: Detail API full barcode check ---')
  await getToken()
  const r2 = await apiGet('/shop/search/products', { 'where[name][c]': 'молоко', limit: '5' })
  const prods2 = Array.isArray(r2.data) ? r2.data : []

  for (const p of prods2.slice(0, 3)) {
    if (!p.id) continue
    console.log(`\nProduct: ${p.brandName || '?'} — ${(p.name || '').substring(0, 40)}`)
    console.log(`  Search: barcode=${JSON.stringify(p.barcode)} articleIndex=${JSON.stringify(p.articleIndex)}`)

    const det = await apiGet('/shop/product/' + p.id)
    if (det.data) {
      const d = det.data
      // Check ALL fields for barcode-like values
      const barcodeFields = ['barcode', 'articleIndex', 'article_index', 'gtin', 'ean', 'ean13', 'upc', 'code', 'externalCode', 'external_code']
      for (const f of barcodeFields) {
        if (d[f] !== undefined && d[f] !== null && d[f] !== '') {
          console.log(`  Detail.${f} = ${JSON.stringify(d[f])}`)
        }
      }

      // Check attributes
      if (d.attributes && Array.isArray(d.attributes)) {
        for (const a of d.attributes) {
          if (a.code && (a.code.toLowerCase().includes('bar') || a.code.toLowerCase().includes('gtin') || a.code.toLowerCase().includes('ean'))) {
            console.log(`  attribute: ${a.code} = ${a.value}`)
          }
        }
      }

      // Check specs/labels
      if (d.labels) console.log(`  labels: ${JSON.stringify(d.labels).substring(0, 200)}`)
    }
  }

  // METHOD 4: HTML product detail page
  console.log('\n--- Method 4: HTML product detail page ---')
  if (prods2.length > 0 && prods2[0].uri) {
    const uri = prods2[0].uri
    console.log(`Fetching product page: https://arbuz.kz${uri}`)
    const html = await httpGet('https://arbuz.kz' + uri)
    const decoded = decodeHtml(html)
    const bcRe = /"barcode"\s*:\s*"(\d{8,14})"/g
    let m
    const found = []
    while ((m = bcRe.exec(decoded)) !== null) found.push(m[1])
    console.log(`  Barcodes in product detail HTML: ${found.length}`)
    found.forEach(b => console.log(`  ${b}`))

    // Also check for article_index with long numbers
    const artRe = /"article_index"\s*:\s*"(\d{8,14})"/g
    const artFound = []
    while ((m = artRe.exec(decoded)) !== null) artFound.push(m[1])
    console.log(`  article_index (8-14 digits) in HTML: ${artFound.length}`)
  }

  console.log('\n=== SUMMARY ===')
  console.log(`HTML search pages: ${htmlBarcodes.size} barcodes found`)
  console.log('NPC by name: see results above')
  console.log('Detail API: barcodes are empty strings')
  console.log('Best approach: HTML scraping for barcodes OR NPC name search for EANs')
}

main().catch(e => { console.error(e); process.exit(1) })
