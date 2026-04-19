const fs = require('fs')

const js = fs.readFileSync('data/arbuz-debug/frontend.js', 'utf8')

// Find the auth module and token flow
console.log('=== AUTH MODULE ===')

// Find auth.token.use and related patterns
const authPatterns = [
  /auth\.token\.[a-z]+\([^)]*\)/g,
  /token\.use\([^)]*\)/g,
  /token\.get\([^)]*\)/g,
  /token\.set\([^)]*\)/g,
  /guestToken/gi,
  /publicToken/gi,
  /anonymousToken/gi,
  /apiToken/gi,
  /consumerKey/gi,
  /consumer_key/gi,
  /appKey/gi,
  /app_key/gi,
]

for (const pat of authPatterns) {
  const matches = [...js.matchAll(pat)]
  if (matches.length > 0) {
    console.log('\nPattern:', pat, '- matches:', matches.length)
    matches.slice(0, 5).forEach(m => {
      const ctx = js.substring(Math.max(0, m.index - 100), m.index + m[0].length + 100)
      console.log('  ' + ctx.replace(/\n/g, ' ').substring(0, 300))
    })
  }
}

// Find the full shop/search/products call
console.log('\n=== SHOP SEARCH PRODUCTS ===')
const searchIdx = js.indexOf('shop/search/products')
if (searchIdx > -1) {
  console.log(js.substring(searchIdx - 500, searchIdx + 500))
}

// Find shop/product/{id} call
console.log('\n=== SHOP PRODUCT DETAIL ===')
const productIdx = js.indexOf('shop/product/{id}')
if (productIdx > -1) {
  console.log(js.substring(productIdx - 300, productIdx + 300))
}

// Find the base URL that prefixes these paths
console.log('\n=== FINDING BASE URL ===')
const baseUrlIdx = js.indexOf('shop/search')
if (baseUrlIdx > -1) {
  // Search backwards for baseURL or apiBase
  const chunk = js.substring(Math.max(0, baseUrlIdx - 5000), baseUrlIdx)
  const baseUrls = [...chunk.matchAll(/(?:baseURL|apiBase|apiUrl|baseUrl)\s*[:=]\s*["']([^"']+)["']/gi)]
  console.log('Base URLs nearby:', baseUrls.map(m => m[1]))
  
  // Also look for URL construction
  const urlConstructions = [...chunk.matchAll(/["'](https?:\/\/[^"']{5,80})["']/g)]
  const apiUrls = urlConstructions.filter(m => m[1].includes('api') || m[1].includes('arbuz'))
  console.log('API URLs nearby:', apiUrls.map(m => m[1]))
}

// Find login/auth endpoint
console.log('\n=== LOGIN/AUTH ENDPOINTS ===')
const authEndpoints = [...js.matchAll(/["']([^"']*(?:login|auth|token|session|register)[^"']{3,60})["']/gi)]
  .map(m => m[1])
  .filter(u => u.includes('/') && u.length < 60)
const uniqueAuth = [...new Set(authEndpoints)]
uniqueAuth.slice(0, 20).forEach(u => console.log('  ' + u))

// Find API host/domain
console.log('\n=== API HOST ===')
const apiHosts = [...js.matchAll(/["'](https?:\/\/api[^"']{5,60})["']/g)]
  .map(m => m[1])
apiHosts.forEach(h => console.log('  ' + h))

// Also look for api.arbuz.kz or similar
const arbuzApiHosts = [...js.matchAll(/["'](https?:\/\/[^"']*arbuz[^"']*api[^"']{0,30})["']/gi)]
  .map(m => m[1])
console.log('Arbuz API hosts:', arbuzApiHosts)

const arbuzHosts = [...js.matchAll(/["'](https?:\/\/[a-z.]*arbuz[a-z.]*[^"']{0,40})["']/gi)]
  .map(m => m[1])
const uniqueArbuzHosts = [...new Set(arbuzHosts)]
uniqueArbuzHosts.forEach(h => console.log('  ' + h))
