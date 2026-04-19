const fs = require('fs')

const js = fs.readFileSync('data/arbuz-debug/frontend.js', 'utf8')

console.log('JS size:', js.length)

// Find ApiBase definition
const apiBaseIdx = js.indexOf('ApiBase')
if (apiBaseIdx > -1) {
  console.log('\nApiBase context:', js.substring(apiBaseIdx - 100, apiBaseIdx + 300))
}

// Find the api module structure
const apiIdx = js.indexOf('api:{Api:')
if (apiIdx > -1) {
  console.log('\napi module context:', js.substring(apiIdx - 50, apiIdx + 500))
}

// Find Search module
const searchModuleIdx = js.indexOf('Search:R')
if (searchModuleIdx > -1) {
  // Find R definition nearby
  console.log('\nSearch:R context:', js.substring(searchModuleIdx - 200, searchModuleIdx + 200))
}

// Look for token/auth patterns
const authPatterns = [
  /token\s*[:=]\s*["']([^"']{10,100})["']/g,
  /["']Authorization["']\s*[,:]\s*["']([^"']{5,80})["']/g,
  /Bearer\s+["']([^"']{10,100})["']/g,
  /getToken/gi,
  /setToken/gi,
  /accessToken/gi,
  /refreshToken/gi,
  /["']X-Api-Key["']/g,
  /x-api-key/gi,
]

for (const pat of authPatterns) {
  const matches = [...js.matchAll(pat)]
  if (matches.length > 0) {
    console.log('\nPattern:', pat, '- matches:', matches.length)
    const unique = [...new Set(matches.map(m => m[0]))]
    unique.slice(0, 5).forEach(u => {
      const idx = js.indexOf(u)
      console.log('  ' + u.substring(0, 150) + '  [at ' + idx + ']')
      console.log('    Context: ' + js.substring(Math.max(0, idx - 80), idx + u.length + 80).replace(/\n/g, ' '))
    })
  }
}

// Find the consumer key in the JS
const keyIdx1 = js.indexOf('20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj')
const keyIdx2 = js.indexOf('M3KAMKD0esxMQUcIBBnYD8sl1LUS6OQr')
console.log('\nMobile key found at:', keyIdx1)
console.log('Desktop key found at:', keyIdx2)

if (keyIdx1 > -1) {
  console.log('Mobile key context:', js.substring(keyIdx1 - 200, keyIdx1 + 300).replace(/\n/g, ' '))
}
if (keyIdx2 > -1) {
  console.log('Desktop key context:', js.substring(keyIdx2 - 200, keyIdx2 + 300).replace(/\n/g, ' '))
}

// Find URL construction patterns
const urlPatterns = [...js.matchAll(/["']\/api\/v[0-9]\/([^"']{3,60})["']/g)]
console.log('\nAPI v-path patterns:', urlPatterns.length)
const uniqueVPaths = [...new Set(urlPatterns.map(m => m[0]))]
uniqueVPaths.slice(0, 20).forEach(p => console.log('  ' + p))

// Look for the actual search API call
const searchCallPatterns = [...js.matchAll(/search[^;]{0,200}(?:axios|fetch|\.(?:get|post))\(/gi)]
console.log('\nSearch API call patterns:', searchCallPatterns.length)
searchCallPatterns.slice(0, 5).forEach(p => console.log('  ' + p[0].substring(0, 200)))

// Find the base URL for API
const baseUrlPatterns = [...js.matchAll(/base[Uu][Rr][Ll]\s*[:=]\s*["']([^"']{5,100})["']/g)]
console.log('\nBase URL patterns:', baseUrlPatterns.length)
baseUrlPatterns.forEach(m => console.log('  ' + m[1]))

// Find the actual axios/fetch calls with API endpoints
const axiosCalls = [...js.matchAll(/\.(?:get|post|put|delete)\s*\(\s*["']([^"']{5,100})["']/g)]
console.log('\nHTTP method calls:', axiosCalls.length)
const uniqueCalls = [...new Set(axiosCalls.map(m => m[1]))]
uniqueCalls.filter(c => c.includes('api') || c.includes('catalog') || c.includes('product')).forEach(c => console.log('  ' + c))

// Look for environment config with API URLs
const configPatterns = [...js.matchAll(/API_*(?:URL|BASE|ENDPOINT|HOST)\s*[:=]\s*["']([^"']{5,100})["']/gi)]
console.log('\nAPI config patterns:', configPatterns.length)
configPatterns.forEach(m => console.log('  ' + m[1]))
