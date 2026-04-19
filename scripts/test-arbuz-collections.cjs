const https = require('https')
const { URL } = require('url')

function httpReq(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const opts = {
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Accept-Language': 'ru-RU,ru',
        ...headers,
      },
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })
    req.on('error', reject)
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

function decodeHtml(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

function stripHtml(html) {
  return html.replace(/<br\s*\/?>/gi, ', ').replace(/<\/p>/gi, ', ').replace(/<[^>]+>/g, '').trim()
}

const CONSUMERS = {
  mobile: { name: 'arbuz-kz.web.mobile', key: '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj' },
  desktop: { name: 'arbuz-kz.web.desktop', key: 'M3KAMKD0esxMQUcIBBnYD8sl1LUS6OQr' },
  terminal: { name: 'arbuz-kz.web.terminal', key: 'LYYzhkpYsWEYjDHGolTeuUtgYB1Y6oaA' },
}

async function tryAuth(basePath, consumerObj) {
  const payloads = [
    { consumer: consumerObj.name, key: consumerObj.key },
    { consumer: consumerObj.key },
    { name: consumerObj.name, key: consumerObj.key },
    { consumer_key: consumerObj.key },
  ]
  
  for (const payload of payloads) {
    const url = basePath + 'auth/token'
    try {
      const r = await httpReq('POST', url, {}, payload)
      if (r.status !== 404) {
        console.log(`  POST ${url} ${JSON.stringify(payload).substring(0, 80)}: ${r.status} | ${r.body.substring(0, 200)}`)
        if (r.status === 200 || r.status === 201) {
          return r.body
        }
      }
    } catch (e) {}
  }

  // Also try GET
  for (const payload of [{}, { consumer: consumerObj.key }]) {
    const qs = Object.keys(payload).length > 0 ? '?' + Object.entries(payload).map(([k,v]) => k + '=' + v).join('&') : ''
    const url = basePath + 'auth/token' + qs
    try {
      const r = await httpReq('GET', url, { 'X-Api-Key': consumerObj.key })
      if (r.status !== 404) {
        console.log(`  GET ${url}: ${r.status} | ${r.body.substring(0, 200)}`)
        if (r.status === 200 || r.status === 201) {
          return r.body
        }
      }
    } catch (e) {}
  }

  return null
}

async function main() {
  console.log('=== APPROACH 1: Try all auth/token URL variants ===')
  const basePaths = [
    'https://arbuz.kz/api/',
    'https://arbuz.kz/api/v2/',
  ]

  for (const base of basePaths) {
    for (const [label, consumer] of Object.entries(CONSUMERS)) {
      console.log(`\n${base} - ${label} (${consumer.name}):`)
      const result = await tryAuth(base, consumer)
      if (result) {
        console.log('TOKEN FOUND!', result)
        break
      }
    }
  }

  console.log('\n\n=== APPROACH 2: Scrape collection pages for product data ===')
  const collectionSlugs = [
    '251362-skidochnyi_weekend',
    '251965-eksklyuziv_iz_yaponii',
    '252029-luchshie_predlozheniya',
    '252032-novinki',
    '252033-k_vyhodnym_na_prirodu',
    '252034-sezon_nachalsya',
    '252035-otvechaem_za_kachestvo',
    '252104-chistota_i_uhod',
    '251921-gelato_madre',
    '251967-more_pod_rukoi',
    '252026-sezon_prostud_i_allergii',
  ]

  let totalProducts = 0
  let totalWithNutrition = 0
  let totalWithIngredients = 0
  let allBarcodes = new Set()

  for (const slug of collectionSlugs.slice(0, 3)) {
    const url = 'https://arbuz.kz/ru/almaty/collections/' + slug
    console.log(`\nFetching ${url}...`)
    try {
      const r = await httpReq('GET', url)
      if (r.status !== 200) {
        console.log('  Status:', r.status)
        continue
      }
      
      const decoded = decodeHtml(r.body)
      
      // Find all product IDs with barcodes
      const barcodeRe = /"barcode"\s*:\s*"(\d{8,14})"/g
      let m
      const products = []
      while ((m = barcodeRe.exec(decoded)) !== null) {
        const barcode = m[1]
        if (allBarcodes.has(barcode)) continue
        allBarcodes.add(barcode)

        // Find the product block
        const start = decoded.lastIndexOf('{"id"', m.index)
        const endIdx = decoded.indexOf(',"catalog_id"', m.index)
        
        if (start > -1 && endIdx > -1) {
          const block = decoded.substring(start, endIdx + 2000)
          try {
            const p = JSON.parse(block)
            const hasNutrition = !!p.nutrition
            const hasIngredients = !!p.ingredients
            products.push({ barcode, name: p.name, brand: p.brand_name, hasNutrition, hasIngredients, price: p.price_actual })
            if (hasNutrition) totalWithNutrition++
            if (hasIngredients) totalWithIngredients++
          } catch (e) {}
        }
      }
      
      totalProducts += products.length
      console.log(`  Products: ${products.length}, with nutrition: ${products.filter(p => p.hasNutrition).length}, with ingredients: ${products.filter(p => p.hasIngredients).length}`)
      products.filter(p => p.hasNutrition || p.hasIngredients).slice(0, 5).forEach(p => {
        console.log(`    ${p.barcode} ${p.brand} - ${p.name?.substring(0, 30)} | nut:${p.hasNutrition} comp:${p.hasIngredients}`)
      })

      await new Promise(r => setTimeout(r, 300))
    } catch (e) {
      console.log('  Error:', e.message)
    }
  }

  console.log(`\n=== SCRAPE SUMMARY ===`)
  console.log(`Total unique products: ${totalProducts}`)
  console.log(`With nutrition: ${totalWithNutrition}`)
  console.log(`With ingredients: ${totalWithIngredients}`)
  console.log(`Unique barcodes: ${allBarcodes.size}`)

  // APPROACH 3: Also try scraping category/catalog pages
  console.log('\n\n=== APPROACH 3: Category pages ===')
  const categories = [
    '20339', // Milka category
    '224439',
    '94117',
  ]

  for (const catId of categories) {
    const url = `https://arbuz.kz/ru/almaty/collections/${catId}`
    console.log(`Fetching ${url}...`)
    try {
      const r = await httpReq('GET', url)
      console.log(`  Status: ${r.status}, Size: ${r.body.length}`)
      if (r.status === 200) {
        const decoded = decodeHtml(r.body)
        const barcodes = [...decoded.matchAll(/"barcode"\s*:\s*"(\d{8,14})"/g)].map(m => m[1])
        console.log(`  Barcodes found: ${barcodes.length}`)
      }
    } catch (e) {
      console.log('  Error:', e.message)
    }
  }
}

main().catch(console.error)
