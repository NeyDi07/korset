const https = require('https')
const { URL } = require('url')

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
  
  const scriptSrcs = []
  const srcRe = /src="(\/[^"]+\.js)"/g
  let m
  while ((m = srcRe.exec(main.body)) !== null) {
    scriptSrcs.push(m[1])
  }
  console.log('Script sources:', scriptSrcs.length)
  scriptSrcs.slice(0, 15).forEach(s => console.log('  ' + s))

  const nextChunks = []
  const chunkRe = /src="(\/_next\/static\/[^"]+\.js)"/g
  while ((m = chunkRe.exec(main.body)) !== null) {
    nextChunks.push(m[1])
  }
  console.log('Next.js chunks:', nextChunks.length)
  nextChunks.forEach(s => console.log('  ' + s))

  const buildIdMatch = main.body.match(/buildId":"([^"]+)"/)
  if (buildIdMatch) {
    console.log('Build ID:', buildIdMatch[1])
  }

  // Fetch the largest chunks to find API patterns
  const chunksToFetch = scriptSrcs.filter(s => s.includes('chunks') || s.includes('_app')).slice(0, 3)
  for (const src of chunksToFetch) {
    console.log('\nFetching chunk:', src)
    const chunk = await httpReq('https://arbuz.kz' + src)
    console.log('Status:', chunk.status, 'Size:', chunk.body.length)

    // Search for API endpoint patterns
    const apiEndpoints = []
    const apiRe = /["'](\/api\/[^"']{3,60})["']/g
    while ((m = apiRe.exec(chunk.body)) !== null) {
      apiEndpoints.push(m[1])
    }
    const uniqueApis = [...new Set(apiEndpoints)]
    console.log('API endpoints found:', uniqueApis.length)
    uniqueApis.forEach(a => console.log('  ' + a))

    // Search for search-related patterns
    const searchEndpoints = []
    const sRe = /["']([^"']*search[^"']{3,60})["']/gi
    while ((m = sRe.exec(chunk.body)) !== null) {
      if (m[1].includes('/') && !m[1].includes('http')) searchEndpoints.push(m[1])
    }
    console.log('Search endpoints:', [...new Set(searchEndpoints)].slice(0, 10))

    // Look for X-Api-Key usage
    const keyRe = /X-Api-Key|x-api-key|apiKey|api_key/gi
    const keyMatches = [...chunk.body.matchAll(keyRe)]
    console.log('API key references:', keyMatches.length)
    keyMatches.forEach(km => {
      const ctx = chunk.body.substring(Math.max(0, km.index - 50), km.index + 100)
      console.log('  ' + ctx.replace(/\n/g, ' ').substring(0, 150))
    })
  }

  // Also look for the API base URL
  console.log('\n=== Looking for API base URLs ===')
  for (const src of scriptSrcs.slice(0, 5)) {
    const chunk = await httpReq('https://arbuz.kz' + src)
    if (chunk.status !== 200) continue
    
    const urlMatches = []
    const urlRe = /["'](https?:\/\/[^"']*(?:api|arbuz)[^"']{5,80})["']/g
    while ((m = urlRe.exec(chunk.body)) !== null) {
      urlMatches.push(m[1])
    }
    const uniqueUrls = [...new Set(urlMatches)]
    if (uniqueUrls.length > 0) {
      console.log('URLs in', src, ':', uniqueUrls.length)
      uniqueUrls.forEach(u => console.log('  ' + u))
    }

    const fetchMatches = []
    const fetchRe = /fetch\(["']([^"']{5,80})/g
    while ((m = fetchRe.exec(chunk.body)) !== null) {
      fetchMatches.push(m[1])
    }
    if (fetchMatches.length > 0) {
      console.log('fetch() calls:', [...new Set(fetchMatches)].slice(0, 10))
    }

    await new Promise(r => setTimeout(r, 200))
  }
}

main().catch(console.error)
