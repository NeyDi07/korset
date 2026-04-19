const https = require('https')
const { URL } = require('url')
const fs = require('fs')

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
  return str.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
}

const MOBILE_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
const DESKTOP_KEY = 'M3KAMKD0esxMQUcIBBnYD8sl1LUS6OQr'
const TERMINAL_KEY = 'LYYzhkpYsWEYjDHGolTeuUtgYB1Y6oaA'

async function main() {
  const outDir = 'data/arbuz-debug'
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  // Step 1: Get auth token via v1
  console.log('=== STEP 1: Get auth token via /api/v1/auth/token ===')
  const tokenTests = [
    { url: 'https://arbuz.kz/api/v1/auth/token', headers: {} },
    { url: 'https://arbuz.kz/api/v1/auth/token?id=', headers: {} },
    { url: 'https://arbuz.kz/api/v1/auth/token?id=1', headers: {} },
    { url: 'https://arbuz.kz/api/v1/auth/token', headers: { 'X-Api-Key': MOBILE_KEY } },
    { url: 'https://arbuz.kz/api/v1/auth/token', headers: { 'X-Api-Key': DESKTOP_KEY } },
    { url: 'https://arbuz.kz/api/v1/auth/token', headers: { 'X-Api-Key': TERMINAL_KEY } },
  ]

  let authToken = null

  for (const t of tokenTests) {
    const r = await httpReq('GET', t.url, t.headers)
    console.log(`GET ${t.url} key:${Object.keys(t.headers).join(',') || 'none'} -> ${r.status}`)
    if (r.status === 200) {
      console.log('  Body:', r.body.substring(0, 500))
      try {
        const json = JSON.parse(r.body)
        if (json.data?.token) {
          authToken = json.data.token
          console.log('  TOKEN:', authToken.substring(0, 50) + '...')
        }
      } catch (e) {}
    }
  }

  // POST auth/token with consumer keys
  console.log('\n=== STEP 1b: POST auth/token with consumer keys ===')
  const postTests = [
    { consumer: 'arbuz-kz.web.mobile', key: MOBILE_KEY },
    { consumer: 'arbuz-kz.web.desktop', key: DESKTOP_KEY },
    { consumer: 'arbuz-kz.web.terminal', key: TERMINAL_KEY },
  ]

  for (const payload of postTests) {
    const r = await httpReq('POST', 'https://arbuz.kz/api/v1/auth/token', {}, payload)
    console.log(`POST consumer:${payload.consumer} -> ${r.status} | ${r.body.substring(0, 300)}`)
    if (r.status === 200 || r.status === 201) {
      try {
        const json = JSON.parse(r.body)
        if (json.data?.token) {
          authToken = json.data.token
          console.log('  TOKEN:', authToken.substring(0, 50) + '...')
        }
      } catch (e) {}
    }
  }

  if (!authToken) {
    console.log('\nNo auth token obtained, trying with cookies...')
    // Try getting token from main page with session
    const main = await httpReq('GET', 'https://arbuz.kz/ru/almaty/')
    const cookies = (main.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ')
    const r = await httpReq('GET', 'https://arbuz.kz/api/v1/auth/token', { Cookie: cookies })
    console.log(`GET /api/v1/auth/token with cookies -> ${r.status} | ${r.body.substring(0, 300)}`)
    if (r.status === 200) {
      try {
        const json = JSON.parse(r.body)
        if (json.data?.token) {
          authToken = json.data.token
          console.log('  TOKEN:', authToken.substring(0, 50) + '...')
        }
      } catch (e) {}
    }
  }

  // Step 2: Search products via v1
  console.log('\n=== STEP 2: Search products via /api/v1/shop/search/products ===')
  const searchHeaders = authToken ? { Authorization: 'Bearer ' + authToken } : {}

  const searchTests = [
    'https://arbuz.kz/api/v1/shop/search/products?where[name][c]=milka&limit=5',
    'https://arbuz.kz/api/v1/shop/search/products?where[name][c]=milka&limit=5&page=1',
  ]

  for (const url of searchTests) {
    const r = await httpReq('GET', url, searchHeaders)
    console.log(`GET ${url.substring(24, 80)} -> ${r.status} | ${r.body.substring(0, 300)}`)
    if (r.status === 200) {
      fs.writeFileSync(outDir + '/v1-search-milka.json', r.body)
      try {
        const json = JSON.parse(r.body)
        console.log('  Data keys:', Object.keys(json))
        console.log('  Products count:', json.data?.length)
        if (json.data?.[0]) console.log('  First product:', JSON.stringify(json.data[0]).substring(0, 300))
      } catch (e) {}
    }
  }

  // Step 3: Get product detail via v1
  console.log('\n=== STEP 3: Product detail via /api/v1/shop/product/{id} ===')
  const detailUrl = 'https://arbuz.kz/api/v1/shop/product/235473'
  const r = await httpReq('GET', detailUrl, searchHeaders)
  console.log(`GET /api/v1/shop/product/235473 -> ${r.status} | ${r.body.substring(0, 500)}`)
  if (r.status === 200) {
    fs.writeFileSync(outDir + '/v1-product-235473.json', r.body)
    try {
      const json = JSON.parse(r.body)
      const p = json.data
      if (p) {
        console.log('  Name:', p.name)
        console.log('  Brand:', p.brandName)
        console.log('  Nutrition:', p.nutrition)
        console.log('  Ingredients:', (p.ingredients || '').substring(0, 200))
        console.log('  Barcode:', p.barcode || p.articleIndex)
        console.log('  Price:', p.priceActual)
        console.log('  Halal:', p.isHalal || p.halal || '-')
        console.log('  DietPrefs:', p.dietPreferences)
        console.log('  Keys:', Object.keys(p).join(', '))
      }
    } catch (e) {}
  }

  // Step 4: Publications-products (the one we saw working)
  console.log('\n=== STEP 4: Publications-products (known working) ===')
  const pubUrl = 'https://arbuz.kz/api/v1/shop/publications-products/251362'
  const r2 = await httpReq('GET', pubUrl, searchHeaders)
  console.log(`GET /api/v1/shop/publications-products/251362 -> ${r2.status} | ${r2.body.substring(0, 500)}`)
  if (r2.status === 200) {
    fs.writeFileSync(outDir + '/v1-publications-251362.json', r2.body)
    try {
      const json = JSON.parse(r2.body)
      console.log('  Products count:', json.data?.length)
      if (json.data?.[0]) {
        const p = json.data[0]
        console.log('  First product keys:', Object.keys(p).join(', '))
        console.log('  First product:', JSON.stringify(p).substring(0, 300))
      }
    } catch (e) {}
  }

  // Step 5: Try all collection IDs
  console.log('\n=== STEP 5: Browse all collections ===')
  const collectionIds = [251362, 251965, 252029, 252032, 252033, 252034, 252035, 252104, 251921, 251967, 252026]

  let totalProducts = 0
  let totalWithNutrition = 0
  let totalWithIngredients = 0
  const allBarcodes = new Set()

  for (const cid of collectionIds) {
    const url = `https://arbuz.kz/api/v1/shop/publications-products/${cid}`
    const r = await httpReq('GET', url, searchHeaders)
    if (r.status !== 200) {
      console.log(`  Collection ${cid}: ${r.status}`)
      continue
    }
    try {
      const json = JSON.parse(r.body)
      const products = json.data || []
      totalProducts += products.length
      let withNut = 0, withIng = 0
      products.forEach(p => {
        if (p.nutrition) { withNut++; totalWithNutrition++ }
        if (p.ingredients) { withIng++; totalWithIngredients++ }
        if (p.barcode || p.articleIndex) allBarcodes.add(p.barcode || p.articleIndex)
      })
      console.log(`  Collection ${cid}: ${products.length} products, nutrition:${withNut}, ingredients:${withIng}`)
    } catch (e) {
      console.log(`  Collection ${cid}: parse error`)
    }
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n=== TOTAL: ${totalProducts} products, ${totalWithNutrition} with nutrition, ${totalWithIngredients} with ingredients, ${allBarcodes.size} unique barcodes ===`)
}

main().catch(console.error)
