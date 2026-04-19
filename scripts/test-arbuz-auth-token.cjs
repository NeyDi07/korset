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

const MOBILE_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
const DESKTOP_KEY = 'M3KAMKD0esxMQUcIBBnYD8sl1LUS6OQr'

async function main() {
  const baseUrls = [
    'https://arbuz.kz/api/v2/',
    'https://arbuz.kz/api/v3/',
    'https://arbuz.kz/api/',
    'https://api.arbuz.kz/v2/',
    'https://api.arbuz.kz/',
  ]

  // Try auth/token with different base URLs and key formats
  console.log('=== AUTH TOKEN ===')
  for (const base of baseUrls) {
    for (const [label, payload] of [
      ['consumer+key(mobile)', { consumer: 'mobile', key: MOBILE_KEY }],
      ['consumer+key(desktop)', { consumer: 'desktop', key: DESKTOP_KEY }],
      ['consumer+apiKey(mobile)', { consumer: 'mobile', apiKey: MOBILE_KEY }],
      ['key+consumer(mobile)', { key: MOBILE_KEY, consumer: 'mobile' }],
      ['api_key(mobile)', { api_key: MOBILE_KEY }],
      ['X-Api-Key header', null],
    ]) {
      const url = base + 'auth/token'
      const headers = label === 'X-Api-Key header' ? { 'X-Api-Key': MOBILE_KEY } : {}
      const body = label === 'X-Api-Key header' ? {} : payload
      try {
        const r = await httpReq('POST', url, headers, body)
        const preview = r.body.substring(0, 300)
        console.log(`  ${base} ${label}: ${r.status} | ${preview}`)
        if (r.status === 200 || r.status === 201) {
          console.log('  FULL:', r.body)
          try {
            const json = JSON.parse(r.body)
            if (json.data?.token || json.data?.jwt || json.token || json.access_token) {
              console.log('  TOKEN FOUND!')
              const token = json.data?.token || json.data?.jwt || json.token || json.access_token
              console.log('  Token type:', typeof token, 'length:', JSON.stringify(token).length)

              // Try using the token for search
              console.log('\n=== SEARCH WITH TOKEN ===')
              const searchUrl = base + 'shop/search/products?where[name][c]=milka&limit=5'
              const searchR = await httpReq('GET', searchUrl, {
                'Authorization': 'Bearer ' + (typeof token === 'string' ? token : token.access_token || token.token),
              })
              console.log('Search status:', searchR.status)
              console.log('Search body:', searchR.body.substring(0, 500))
            }
          } catch (e) {}
        }
      } catch (e) {
        console.log(`  ${base} ${label}: ERROR ${e.message}`)
      }
    }
  }

  // Also try with the v2 endpoint format that gave 401 before
  console.log('\n=== TRY AUTH WITH EXISTING V2 ENDPOINT ===')
  const v2authTests = [
    { url: 'https://arbuz.kz/api/v2/auth/token', body: { consumer: 'mobile', key: MOBILE_KEY } },
    { url: 'https://arbuz.kz/api/v2/auth/token', body: { consumer: 'desktop', key: DESKTOP_KEY } },
    { url: 'https://arbuz.kz/api/v2/auth', body: { consumer: 'mobile', key: MOBILE_KEY } },
    { url: 'https://arbuz.kz/api/v2/token', body: { consumer: 'mobile', key: MOBILE_KEY } },
  ]

  for (const { url, body } of v2authTests) {
    const r = await httpReq('POST', url, {}, body)
    console.log(`  ${url}: ${r.status} | ${r.body.substring(0, 300)}`)
    if (r.status === 200 || r.status === 201) {
      console.log('  FULL:', r.body)
    }
  }
}

main().catch(console.error)
