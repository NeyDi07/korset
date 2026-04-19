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
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html', 'Accept-Language': 'ru-RU,ru' },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function decodeHtml(str) {
  return str.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
}

function extractProductsFromHtml(decoded) {
  const products = []
  // Find all "barcode":"NNNNN" occurrences
  const bcRe = /"barcode"\s*:\s*"(\d{8,14})"/g
  let m
  while ((m = bcRe.exec(decoded)) !== null) {
    const barcode = m[1]
    const barcodePos = m.index

    // Search backwards for the product block start
    const searchStart = Math.max(0, barcodePos - 3000)
    const chunk = decoded.substring(searchStart, barcodePos + 500)

    // Find "id":NNNNN in the chunk before the barcode
    const idRe = /"id"\s*:\s*"?(\d{4,})"?/g
    let idMatch
    let bestId = null
    let bestIdPos = -1
    while ((idMatch = idRe.exec(chunk)) !== null) {
      const pos = searchStart + idMatch.index
      if (pos < barcodePos && pos > bestIdPos) {
        bestId = idMatch[1]
        bestIdPos = pos
      }
    }

    if (bestId) {
      // Also try to extract name and brand from the same block
      const blockStart = Math.max(0, bestIdPos - searchStart - 100)
      const blockEnd = Math.min(chunk.length, barcodePos - searchStart + 2000)
      const block = chunk.substring(blockStart, blockEnd)

      const nameMatch = block.match(/"name"\s*:\s*"([^"]{3,100})"/)
      const brandMatch = block.match(/"brandName"\s*:\s*"([^"]{1,80})"/)

      products.push({
        id: bestId,
        barcode,
        name: nameMatch ? nameMatch[1] : null,
        brand: brandMatch ? brandMatch[1] : null,
      })
    }
  }
  return products
}

async function main() {
  console.log('=== Debug HTML barcode extraction ===\n')

  const html = await httpGet('https://arbuz.kz/ru/almaty/?q=' + encodeURIComponent('шоколад'))
  const decoded = decodeHtml(html)
  console.log('HTML size:', decoded.length)

  const products = extractProductsFromHtml(decoded)
  console.log(`\nProducts with barcodes extracted: ${products.length}`)

  products.slice(0, 20).forEach((p, i) => {
    console.log(`  ${i + 1}. id=${p.id} barcode=${p.barcode} brand=${p.brand || '?'} name=${(p.name || '?').substring(0, 40)}`)
  })

  // Also check: are there barcodes with short article_index values?
  const artRe = /"article_index"\s*:\s*"(\d+)"/g
  const articles = []
  let am
  while ((am = artRe.exec(decoded)) !== null) {
    if (am[1].length >= 8) articles.push(am[1])
  }
  console.log(`\narticle_index values (8+ digits): ${articles.length}`)
  articles.slice(0, 10).forEach(a => console.log(`  ${a}`))

  // Now try to find the full product JSON blocks in the HTML
  // Look for the Nuxt/Vue data payload
  const nuxtIdx = decoded.indexOf('__NUXT__')
  if (nuxtIdx > -1) {
    console.log(`\n__NUXT__ found at position ${nuxtIdx}`)
    // Extract a chunk to see structure
    const chunk = decoded.substring(nuxtIdx, nuxtIdx + 500)
    console.log('Context:', chunk.substring(0, 300))
  }

  // Look for window.__INITIAL_STATE__ or similar
  for (const key of ['__INITIAL_STATE__', '__NEXT_DATA__', '__APP_DATA__', 'window.__DATA__']) {
    const idx = decoded.indexOf(key)
    if (idx > -1) {
      console.log(`\n${key} found at position ${idx}`)
    }
  }

  // Save decoded HTML for manual inspection
  fs.writeFileSync(path.join(OUT_DIR, 'search-chocolate-decoded.html'), decoded.substring(0, 500000))
  console.log('\nSaved decoded HTML (first 500KB)')
}

main().catch(e => { console.error(e); process.exit(1) })
