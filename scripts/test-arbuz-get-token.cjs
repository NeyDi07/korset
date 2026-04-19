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

async function main() {
  // First: get platformConfiguration from the HTML page
  console.log('=== STEP 1: Get platformConfiguration from HTML ===')
  const mainPage = await httpReq('GET', 'https://arbuz.kz/ru/almaty/')
  
  const configMatch = mainPage.body.match(/platformConfiguration\s*=\s*(\{[^;]+\})/)
  if (configMatch) {
    console.log('platformConfiguration found:')
    console.log(configMatch[1].substring(0, 500))
    try {
      const config = JSON.parse(configMatch[1])
      console.log('Parsed config keys:', Object.keys(config))
      console.log('url:', config.url)
    } catch (e) {
      console.log('Parse error, raw:', configMatch[1].substring(0, 300))
    }
  } else {
    const configMatch2 = mainPage.body.match(/platformConfiguration[^}]*\{[^}]*url[^}]*\}/)
    if (configMatch2) {
      console.log('platformConfiguration (alt):', configMatch2[0].substring(0, 300))
    } else {
      console.log('platformConfiguration not found, searching for url config...')
      const urlConfigs = [...mainPage.body.matchAll(/window\.\w+\s*=\s*\{[^}]*url[^}]*\}/g)]
      urlConfigs.forEach((m, i) => console.log(`  ${i}: ${m[0].substring(0, 200)}`))
    }
  }

  // Try auth/token as GET
  console.log('\n=== STEP 2: GET auth/token ===')
  const tokenUrls = [
    'https://arbuz.kz/api/auth/token',
    'https://arbuz.kz/api/v2/auth/token',
    'https://arbuz.kz/api/auth/token/',
    'https://arbuz.kz/api/v2/auth/token/',
  ]

  for (const url of tokenUrls) {
    const r = await httpReq('GET', url)
    console.log(`GET ${url}: ${r.status} | ${r.body.substring(0, 300)}`)
    if (r.status === 200) {
      try {
        const json = JSON.parse(r.body)
        console.log('TOKEN DATA:', JSON.stringify(json).substring(0, 500))
        if (json.data?.token) {
          console.log('TOKEN VALUE:', json.data.token.substring(0, 50) + '...')
        }
      } catch (e) {}
    }
  }

  // Try POST auth/token with consumer key (from the JS: r.a.post("auth/token",{},t) where t = {consumer, key})
  console.log('\n=== STEP 3: POST auth/token with consumer key ===')
  const MOBILE_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
  const DESKTOP_KEY = 'M3KAMKD0esxMQUcIBBnYD8sl1LUS6OQr'
  
  const postUrls = [
    'https://arbuz.kz/api/auth/token',
    'https://arbuz.kz/api/v2/auth/token',
  ]

  for (const url of postUrls) {
    for (const [label, payload] of [
      ['consumer+key(mobile)', { consumer: 'mobile', key: MOBILE_KEY }],
      ['consumer+key(desktop)', { consumer: 'desktop', key: DESKTOP_KEY }],
      ['empty body', {}],
    ]) {
      const r = await httpReq('POST', url, {}, payload)
      console.log(`POST ${url} ${label}: ${r.status} | ${r.body.substring(0, 300)}`)
      if (r.status === 200 || r.status === 201) {
        try {
          const json = JSON.parse(r.body)
          console.log('TOKEN DATA:', JSON.stringify(json).substring(0, 500))
        } catch (e) {}
      }
    }
  }

  // Check if the search page HTML has initial auth data
  console.log('\n=== STEP 4: Look for auth data in HTML ===')
  const authDataPatterns = [...mainPage.body.matchAll(/"token"\s*:\s*"([^"]{10,})"/g)]
  console.log('Token values in HTML:', authDataPatterns.length)
  authDataPatterns.forEach((m, i) => console.log(`  ${i}: ${m[1].substring(0, 80)}...`))

  const jwtPatterns = [...mainPage.body.matchAll(/eyJ[A-Za-z0-9_-]{20,}/g)]
  console.log('JWT-like tokens in HTML:', jwtPatterns.length)
  jwtPatterns.forEach((m, i) => console.log(`  ${i}: ${m[0].substring(0, 80)}...`))
}

main().catch(console.error)
