const https = require('https')
const { URL } = require('url')

function httpReq(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, */*',
        'Accept-Language': 'ru-RU,ru',
        ...headers,
      },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

const MOBILE_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
const DESKTOP_KEY = 'M3KAMKD0esxMQUcIBBnYD8sl1LUS6OQr'

async function main() {
  // Test 1: Consumer API search with mobile key
  console.log('=== Test 1: Arbuz Consumer API (mobile key) ===')
  const apiSearch1 = await httpReq('GET',
    'https://arbuz.kz/api/v3/catalog/search?query=milka&city_id=750000000',
    { 'X-Api-Key': MOBILE_KEY }
  )
  console.log('Status:', apiSearch1.status)
  if (apiSearch1.status === 200) {
    const json = JSON.parse(apiSearch1.body)
    console.log('Keys:', Object.keys(json))
    if (json.data) console.log('Data length:', json.data.length, 'First:', JSON.stringify(json.data[0]).substring(0, 300))
    if (json.products) console.log('Products length:', json.products.length)
  } else {
    console.log('Body:', apiSearch1.body.substring(0, 500))
  }

  // Test 2: Try v2 with key
  console.log('\n=== Test 2: Arbuz API v2 search (desktop key) ===')
  const apiSearch2 = await httpReq('GET',
    'https://arbuz.kz/api/v2/catalog/search?query=milka&city_id=750000000',
    { 'X-Api-Key': DESKTOP_KEY }
  )
  console.log('Status:', apiSearch2.status)
  if (apiSearch2.status === 200) {
    const json = JSON.parse(apiSearch2.body)
    console.log('Keys:', Object.keys(json))
  } else {
    console.log('Body:', apiSearch2.body.substring(0, 500))
  }

  // Test 3: Search page - check for additional data blocks
  console.log('\n=== Test 3: Full search page data analysis ===')
  const search = await httpReq('GET', 'https://arbuz.kz/ru/almaty/?q=' + encodeURIComponent('milka шоколад'))
  
  // Find all JSON-like data blocks
  const scriptBlocks = [...search.body.matchAll(/window\.__[A-Z_]+\s*=\s*({[\s\S]*?});/g)]
  console.log('window.__ data blocks:', scriptBlocks.length)
  scriptBlocks.forEach((m, i) => {
    console.log(`  Block ${i}: ${m[0].substring(0, 80)}...`)
  })

  // Find composition/attributes data
  const compOccurrences = [...search.body.matchAll(/Состав/g)]
  console.log('"Состав" occurrences:', compOccurrences.length)
  compOccurrences.forEach((m, i) => {
    console.log(`  ${i}: pos ${m.index}, context: "${search.body.substring(m.index, m.index + 100)}"`)
  })

  // Find attributes/характеристики
  const attrOccurrences = [...search.body.matchAll(/характеристик|attribute|nutrient|белок|жиры|углеводы/gi)]
  console.log('Attribute/nutrient occurrences:', attrOccurrences.length)
  attrOccurrences.forEach((m, i) => {
    console.log(`  ${i}: "${m[0]}" at pos ${m.index}, context: "${search.body.substring(m.index, m.index + 150)}"`)
  })

  // Test 4: Try Arbuz product detail via API with key
  console.log('\n=== Test 4: Product detail via API ===')
  // Milka article_index = 7622210694331
  const detail1 = await httpReq('GET',
    'https://arbuz.kz/api/v2/catalog/products/235473',
    { 'X-Api-Key': MOBILE_KEY }
  )
  console.log('v2 product detail status:', detail1.status)
  if (detail1.status === 200) {
    const json = JSON.parse(detail1.body)
    console.log('Keys:', Object.keys(json))
    console.log('Body preview:', detail1.body.substring(0, 500))
  } else {
    console.log('Body:', detail1.body.substring(0, 300))
  }

  // Try v3 product detail
  const detail2 = await httpReq('GET',
    'https://arbuz.kz/api/v3/catalog/products/235473',
    { 'X-Api-Key': MOBILE_KEY }
  )
  console.log('v3 product detail status:', detail2.status)
  if (detail2.status === 200) {
    console.log('Body preview:', detail2.body.substring(0, 500))
  }

  // Try with article_index
  const detail3 = await httpReq('GET',
    'https://arbuz.kz/api/v3/catalog/products/7622210694331',
    { 'X-Api-Key': MOBILE_KEY }
  )
  console.log('v3 product by article status:', detail3.status)
  if (detail3.status === 200) {
    console.log('Body preview:', detail3.body.substring(0, 500))
  }

  // Try product by article index in different formats
  const paths = [
    '/api/v3/catalog/product/235473',
    '/api/v3/products/235473',
    '/api/v3/product/235473',
    '/api/v3/catalog/items/235473',
    '/api/v3/catalog/item/235473',
  ]
  for (const p of paths) {
    const r = await httpReq('GET', 'https://arbuz.kz' + p, { 'X-Api-Key': MOBILE_KEY })
    console.log(`${p} → ${r.status}`)
    if (r.status === 200) {
      console.log('  Body:', r.body.substring(0, 300))
      break
    }
  }
}

main().catch(console.error)
