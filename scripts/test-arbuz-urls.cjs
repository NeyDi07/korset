const https = require('https')
const { URL } = require('url')

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ru-RU,ru',
      },
    }, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

async function main() {
  console.log('=== Step 1: Search for Milka on Arbuz ===')
  const search = await httpGet('https://arbuz.kz/ru/almaty/?q=' + encodeURIComponent('milka'))
  console.log('Search status:', search.status, 'Length:', search.body.length)

  // Find product IDs
  const idRe = /&quot;id&quot;:(\d+).*?&quot;article_index&quot;:&quot;(\d+)&quot;.*?&quot;name&quot;:&quot;([^&]+?)&quot;.*?&quot;brand_name&quot;:&quot;([^&]+?)&quot;/g
  const products = []
  let m
  while ((m = idRe.exec(search.body)) !== null) {
    products.push({ id: m[1], articleIndex: m[2], name: m[3], brand: m[4] })
  }
  console.log(`Found ${products.length} products in search`)
  products.slice(0, 5).forEach(p => console.log(`  id:${p.id} art:${p.articleIndex} ${p.brand} — ${p.name}`))

  if (products.length === 0) {
    console.log('No products found, aborting')
    return
  }

  // Try different product detail URL formats
  const milkaId = products.find(p => p.brand === 'Milka')?.id || products[0].id
  console.log(`\n=== Step 2: Find product detail URL for id:${milkaId} ===`)

  const detailPaths = [
    `/ru/almaty/catalog/item/${milkaId}/`,
    `/ru/almaty/catalog/item-${milkaId}/`,
    `/ru/almaty/catalog/${milkaId}/`,
    `/ru/almaty/item/${milkaId}/`,
    `/ru/almaty/product/${milkaId}/`,
  ]

  for (const p of detailPaths) {
    const r = await httpGet('https://arbuz.kz' + p)
    console.log(`  ${p} → ${r.status} (${r.body.length} bytes)`)
    if (r.status === 200) {
      const hasComp = r.body.includes('Состав')
      const hasKbju = r.body.includes('белки') || r.body.includes('ккал')
      console.log(`    Composition: ${hasComp}, КБЖУ: ${hasKbju}`)
    }
  }

  // Try to find product URL from search page
  console.log(`\n=== Step 3: Look for product links in search HTML ===`)
  // Check around the Milka product for any href/link patterns
  const milkaIdx = search.body.indexOf('Milka')
  if (milkaIdx > -1) {
    const chunk = search.body.substring(Math.max(0, milkaIdx - 2000), milkaIdx + 200)
    // Find href patterns
    const hrefs = [...chunk.matchAll(/href="([^"]{5,100})"/g)].map(m => m[1])
    console.log('hrefs near Milka:', hrefs.slice(0, 10))
    // Also try encoded
    const hrefs2 = [...chunk.matchAll(/href=&quot;([^&]{5,100})&quot;/g)].map(m => m[1])
    console.log('encoded hrefs near Milka:', hrefs2.slice(0, 10))
  }

  // Check if ALL product data is in the search JSON (just HTML-encoded)
  console.log(`\n=== Step 4: Check full product data in search results ===`)
  const firstProdIdx = search.body.indexOf('&quot;id&quot;:235473')
  if (firstProdIdx > -1) {
    const chunk = search.body.substring(firstProdIdx, firstProdIdx + 10000)
    const compMatch = chunk.match(/Состав/)
    const kbjuMatch = chunk.match(/белки|жиры|углеводы|ккал/)
    const halalMatch = chunk.match(/халал|halal/i)
    const priceMatch = chunk.match(/price_actual&quot;:(\d+)/)
    console.log('Composition in product data:', !!compMatch)
    console.log('КБЖУ in product data:', !!kbjuMatch)
    console.log('Halal in product data:', !!halalMatch)
    console.log('Price:', priceMatch ? priceMatch[1] + '₸' : 'none')

    // Print first 500 chars of the product entry
    console.log('\nFirst 800 chars of product entry:')
    console.log(chunk.substring(0, 800))
  }

  // Try API endpoints
  console.log(`\n=== Step 5: Try Arbuz API endpoints ===`)
  const apiPaths = [
    `/api/v1/products/${milkaId}`,
    `/api/products/${milkaId}`,
    `/api/v2/products/${milkaId}`,
  ]
  for (const p of apiPaths) {
    const r = await httpGet('https://arbuz.kz' + p)
    console.log(`  ${p} → ${r.status}`)
    if (r.status === 200) {
      console.log('    Body:', r.body.substring(0, 300))
    }
  }

  // Try with consumer API key
  console.log(`\n=== Step 6: Try Arbuz consumer API ===`)
  const apiKey = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
  const apiSearchUrl = `https://arbuz.kz/api/v2/catalog/search?query=milka&city_id=750000000`
  const apiSearch = await httpGet(apiSearchUrl)
  console.log('API search status:', apiSearch.status)
  if (apiSearch.status === 200) {
    console.log('Body start:', apiSearch.body.substring(0, 500))
  } else if (apiSearch.status === 404) {
    // Try mobile API format
    const mobileApi = `https://arbuz.kz/api/v3/catalog/search?query=milka`
    const r2 = await httpGet(mobileApi)
    console.log('Mobile API search status:', r2.status, 'Body:', r2.body.substring(0, 300))
  }
}

main().catch(console.error)
