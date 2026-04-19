const https = require('https')
const { URL } = require('url')

function httpReq(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const opts = {
      hostname: url.hostname, port: 443, path: url.pathname + url.search, method,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...headers },
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function test() {
  const authR = await httpReq('POST', 'https://arbuz.kz/api/v1/auth/token', {}, {
    consumer: 'arbuz-kz.web.mobile', key: '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
  })
  const token = JSON.parse(authR.body).data.token
  const headers = { Authorization: 'Bearer ' + token }

  const queries = [
    'Milka',
    'Milka шоколад',
    'Ritter Sport',
    'Coca-Cola',
    'Schogetten',
    'Bucheron',
    'Chokodelika',
  ]

  for (const q of queries) {
    const url = 'https://arbuz.kz/api/v1/shop/search/products?where[name][c]=' + encodeURIComponent(q) + '&limit=5'
    const r = await httpReq('GET', url, headers)
    const json = JSON.parse(r.body)
    console.log('Query: "' + q + '" -> count: ' + (json.data?.length || 0) + ' match: ' + (json.match || '-'))
    ;(json.data || []).forEach(p => {
      console.log('  ' + p.id + ' | ' + (p.brandName || '?') + ' | ' + (p.name || '').substring(0, 60))
    })
  }
}
test().catch(console.error)
