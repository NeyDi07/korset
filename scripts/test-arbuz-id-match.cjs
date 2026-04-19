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

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    https.get({
      hostname: url.hostname, port: 443, path: url.pathname + url.search,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html', 'Accept-Language': 'ru-RU,ru' },
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)) }).on('error', reject)
  })
}

function decodeHtml(s) { return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10))) }

function extractBarcodesFromHtml(decoded) {
  const result = new Map()
  const bcRe = /"barcode"\s*:\s*"(\d{8,14})"/g
  let m
  while ((m = bcRe.exec(decoded)) !== null) {
    const barcode = m[1]
    const barcodePos = m.index
    const searchStart = Math.max(0, barcodePos - 3000)
    const chunk = decoded.substring(searchStart, barcodePos + 500)
    const idRe = /"id"\s*:\s*"?(\d{4,})"?/g
    let idMatch, bestId = null, bestIdPos = -1
    while ((idMatch = idRe.exec(chunk)) !== null) {
      const pos = searchStart + idMatch.index
      if (pos < barcodePos && pos > bestIdPos) { bestId = idMatch[1]; bestIdPos = pos }
    }
    if (bestId) result.set(bestId, barcode)
  }
  return result
}

async function main() {
  await getToken()

  // Get API products
  const r = await httpReq('GET', API_BASE + '/shop/search/products?where[name][c]=шоколад&limit=5', { Authorization: 'Bearer ' + _token.value })
  const apiProds = JSON.parse(r.body).data
  console.log('API product IDs (first 5):')
  apiProds.forEach(p => console.log('  id=' + JSON.stringify(p.id) + ' type=' + typeof p.id))

  // Get HTML barcodes
  const html = await httpGet('https://arbuz.kz/ru/almaty/?q=шоколад')
  const decoded = decodeHtml(html)
  const htmlBarcodes = extractBarcodesFromHtml(decoded)
  console.log('\nHTML barcode IDs (first 5):')
  let count = 0
  for (const [id, bc] of htmlBarcodes) {
    console.log(`  id=${id} barcode=${bc}`)
    count++
    if (count >= 5) break
  }

  // Check direct match
  console.log('\nDirect matching test:')
  for (const p of apiProds) {
    const apiId = String(p.id)
    const match = htmlBarcodes.get(apiId)
    console.log(`  API id=${apiId} → HTML match: ${match || 'NONE'}`)
    if (!match) {
      // Check if the id exists in ANY form in the HTML
      const idx = decoded.indexOf(apiId)
      if (idx > -1) {
        console.log(`    Found "${apiId}" in HTML at pos ${idx}, context: ${decoded.substring(Math.max(0, idx - 20), idx + 40)}`)
      } else {
        console.log(`    "${apiId}" NOT found in HTML at all`)
      }
    }
  }

  // The real fix: look at the actual structure around a known product
  // Take first API product, find its ID in HTML, check what's nearby
  const testId = String(apiProds[0].id)
  console.log(`\nSearching HTML for product id="${testId}":`)
  const searchStr = '"id":"' + testId + '"'
  let idx1 = decoded.indexOf(searchStr)
  let idx2 = decoded.indexOf('"id":' + testId)
  console.log(`  "${searchStr}" at: ${idx1}`)
  console.log(`  "id":${testId} at: ${idx2}`)

  if (idx1 > -1) {
    console.log(`  Context: ${decoded.substring(Math.max(0, idx1 - 30), idx1 + 200)}`)
  }
  if (idx2 > -1) {
    console.log(`  Context2: ${decoded.substring(Math.max(0, idx2 - 30), idx2 + 200)}`)
  }

  // Find ALL occurrences of this product ID
  const re = new RegExp('"id"\\s*:\\s*"?' + testId + '"?', 'g')
  let m, positions = []
  while ((m = re.exec(decoded)) !== null) positions.push(m.index)
  console.log(`  All occurrences of id=${testId}: ${positions.length} at positions: ${positions.slice(0, 5).join(', ')}`)
}

main().catch(console.error)
