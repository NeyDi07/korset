const https = require('https')
const { URL } = require('url')
const fs = require('fs')

function httpReq(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        ...headers,
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
  const main = await httpReq('https://arbuz.kz/ru/almaty/')

  // Find ALL JS files in the page
  const allJsFiles = []
  const jsRe = /["'](\/static\/platform\/js\/[^"']+\.js)["']/g
  let m
  while ((m = jsRe.exec(main.body)) !== null) {
    allJsFiles.push(m[1])
  }

  // Also look for chunk files
  const chunkRe = /["'](\/static\/platform\/js\/[^"']+chunk[^"']+\.js)["']/gi
  while ((m = chunkRe.exec(main.body)) !== null) {
    allJsFiles.push(m[1])
  }

  console.log('JS files found:', allJsFiles.length)
  allJsFiles.forEach(f => console.log('  ' + f))

  // Fetch the main frontend JS and search for API patterns
  const mainJs = await httpReq('https://arbuz.kz/static/platform/js/frontend.09d4a343433ca2dc1f70.js')
  console.log('\nMain JS size:', mainJs.body.length)

  const outDir = 'data/arbuz-debug'
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outDir + '/frontend.js', mainJs.body)

  // Search for API-related patterns in the main JS
  const patterns = [
    /["']\/api\/[^"']{3,60}["']/g,
    /["']catalog[^"']{3,60}["']/gi,
    /["']search[^"']{5,60}["']/gi,
    /X-Api-Key/gi,
    /x-api-key/gi,
    /api_key/gi,
    /apiKey/gi,
    /consumerKey/gi,
    /["']v2["']/g,
    /["']v3["']/g,
    /baseURL/gi,
    /apiBase/gi,
    /apiUrl/gi,
  ]

  for (const pat of patterns) {
    const matches = [...mainJs.body.matchAll(pat)]
    if (matches.length > 0) {
      console.log('\nPattern:', pat, '- matches:', matches.length)
      const unique = [...new Set(matches.map(m => m[0]))]
      unique.slice(0, 10).forEach(u => console.log('  ' + u))
    }
  }

  // Find axios/fetch configuration with base URLs
  const axiosRe = /axios\.create\(\{[^}]{0,200}\}/g
  const axiosMatches = [...mainJs.body.matchAll(axiosRe)]
  console.log('\naxios.create calls:', axiosMatches.length)
  axiosMatches.forEach((am, i) => console.log('  ' + i + ': ' + am[0]))

  // Look for API module definitions
  const apiModuleRe = /(?:api|Api)\s*[:=]\s*\{[^}]{0,300}\}/g
  const apiModuleMatches = [...mainJs.body.matchAll(apiModuleRe)]
  console.log('\nAPI module definitions:', apiModuleMatches.length)
  apiModuleMatches.slice(0, 5).forEach((am, i) => console.log('  ' + i + ': ' + am[0].substring(0, 200)))

  // Search for "search" function definitions
  const searchFnRe = /search\s*[:=]\s*(?:function\s*)?\(?[^)]*\)\s*\{[^}]{0,300}/g
  const searchFnMatches = [...mainJs.body.matchAll(searchFnRe)]
  console.log('\nSearch function definitions:', searchFnMatches.length)
  searchFnMatches.slice(0, 5).forEach((sm, i) => console.log('  ' + i + ': ' + sm[0].substring(0, 200)))

  // Look for product-related API calls
  const productRe = /product[s]?\s*[:=]\s*\{[^}]{0,200}\}/gi
  const productMatches = [...mainJs.body.matchAll(productRe)]
  console.log('\nProduct definitions:', productMatches.length)
  productMatches.slice(0, 5).forEach((pm, i) => console.log('  ' + i + ': ' + pm[0].substring(0, 200)))

  // Try direct API calls with different auth approaches
  console.log('\n=== Direct API Tests ===')
  const MOBILE_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
  
  const apiTests = [
    ['GET /api/v2/catalog/search with Bearer', { 'Authorization': 'Bearer ' + MOBILE_KEY }],
    ['GET /api/v2/catalog/search with Token', { 'Authorization': 'Token ' + MOBILE_KEY }],
    ['GET /api/v2/catalog/search + Content-Type', { 'X-Api-Key': MOBILE_KEY, 'Content-Type': 'application/json' }],
    ['GET /api/v2/catalog/search + Accept json + key', { 'X-Api-Key': MOBILE_KEY, 'Accept': 'application/json', 'Content-Type': 'application/json' }],
  ]

  for (const [label, headers] of apiTests) {
    const url = 'https://arbuz.kz/api/v2/catalog/search?query=milka&city_id=750000000'
    const r = await httpReq(url, headers)
    console.log(label + ': ' + r.status + ' | ' + r.body.substring(0, 200))
  }

  // Try with different city_id values
  console.log('\n=== Different city_id values ===')
  for (const cityId of ['1', '2', '750000000', 'almaty', '750000']) {
    const r = await httpReq('https://arbuz.kz/api/v2/catalog/search?query=milka&city_id=' + cityId, { 'X-Api-Key': MOBILE_KEY })
    console.log('city_id=' + cityId + ': ' + r.status)
    if (r.status === 200) {
      console.log('  Body:', r.body.substring(0, 300))
    }
  }
}

main().catch(console.error)
