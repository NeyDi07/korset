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
  const mainPage = await httpReq('GET', 'https://arbuz.kz/ru/almaty/')

  // Parse platformConfiguration
  const configMatch = mainPage.body.match(/platformConfiguration\s*=\s*(\{[^;]+\});/)
  if (!configMatch) { console.log('No config'); return }

  const config = JSON.parse(configMatch[1])

  console.log('=== PLATFORM CONFIGURATION ===')
  console.log('url:', config.url)
  console.log('secureUrl:', config.secureUrl)
  console.log('consumer:', JSON.stringify(config.consumer))
  console.log('token:', JSON.stringify(config.token))
  console.log('project:', JSON.stringify(config.project))
  console.log('oauth:', JSON.stringify(config.oauth))
  console.log('city:', JSON.stringify(config.city))

  // Extract consumer keys
  if (config.consumer) {
    console.log('\nConsumer config:')
    for (const [k, v] of Object.entries(config.consumer)) {
      console.log(`  ${k}: ${v}`)
    }
  }

  if (config.token) {
    console.log('\nToken config:')
    for (const [k, v] of Object.entries(config.token)) {
      console.log(`  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    }
  }

  // Try auth endpoints with the consumer keys from config
  const consumerKeys = config.consumer || {}
  console.log('\n=== AUTH WITH CONSUMER KEYS FROM CONFIG ===')

  for (const [keyName, keyValue] of Object.entries(consumerKeys)) {
    if (typeof keyValue !== 'string' || keyValue.length < 5) continue
    console.log(`\nTrying key: ${keyName} = ${keyValue.substring(0, 10)}...`)

    const authUrls = [
      `https://arbuz.kz/api/v2/auth/token`,
      `https://arbuz.kz/api/auth/token`,
      `https://secure.arbuz.kz/api/v2/auth/token`,
      `https://secure.arbuz.kz/api/auth/token`,
      `https://secure.arbuz.kz/auth/token`,
    ]

    for (const authUrl of authUrls) {
      for (const [label, payload] of [
        ['POST consumer+key', { consumer: keyName, key: keyValue }],
        ['GET with X-Api-Key', null],
      ]) {
        try {
          const headers = label.includes('X-Api-Key') ? { 'X-Api-Key': keyValue } : {}
          const r = label.includes('POST')
            ? await httpReq('POST', authUrl, headers, payload)
            : await httpReq('GET', authUrl, headers)
          console.log(`  ${label} ${authUrl}: ${r.status} | ${r.body.substring(0, 200)}`)
          if (r.status === 200 || r.status === 201) {
            console.log('  FULL:', r.body.substring(0, 500))
            try {
              const json = JSON.parse(r.body)
              const token = json.data?.token || json.data?.jwt || json.token || json.access_token
              if (token) {
                console.log('\n=== TOKEN OBTAINED! Testing search... ===')
                const tokenStr = typeof token === 'string' ? token : token.access_token || token.token
                const searchUrls = [
                  `https://arbuz.kz/api/v2/shop/search/products?where[name][c]=milka&limit=5`,
                  `https://arbuz.kz/api/shop/search/products?where[name][c]=milka&limit=5`,
                ]
                for (const searchUrl of searchUrls) {
                  const sr = await httpReq('GET', searchUrl, { 'Authorization': 'Bearer ' + tokenStr })
                  console.log(`  Search ${searchUrl}: ${sr.status} | ${sr.body.substring(0, 300)}`)
                }
              }
            } catch (e) {}
          }
        } catch (e) {
          console.log(`  ${label} ${authUrl}: ERROR ${e.message}`)
        }
      }
    }
  }

  // Try secure.arbuz.kz
  console.log('\n=== TRYING SECURE.ARBUZ.KZ ===')
  try {
    const r = await httpReq('GET', 'https://secure.arbuz.kz/')
    console.log('secure.arbuz.kz status:', r.status, 'size:', r.body.length)
  } catch (e) {
    console.log('secure.arbuz.kz error:', e.message)
  }

  // Try auth with initial token from config
  if (config.token?.initial || config.token?.guest) {
    console.log('\n=== TOKEN FROM CONFIG ===')
    const initialToken = config.token.initial || config.token.guest
    console.log('Token:', initialToken)
  }
}

main().catch(console.error)
