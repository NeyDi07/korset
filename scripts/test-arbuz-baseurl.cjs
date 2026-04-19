const fs = require('fs')

const js = fs.readFileSync('data/arbuz-debug/frontend.js', 'utf8')

// Find the API client initialization - look for 'r.a' which is the HTTP client
// r.a.get("shop/search/products", ...) 
// r.a.post("auth/token", {}, {consumer, key})

// Search for the string "auth/token" to find the full context
const authTokenIdx = js.indexOf('"auth/token"')
if (authTokenIdx > -1) {
  console.log('=== AUTH/TOKEN FULL CONTEXT ===')
  console.log(js.substring(authTokenIdx - 1000, authTokenIdx + 500))
}

// Find where r.a is defined - it's the API client
// Look for axios.create or similar
console.log('\n\n=== AXIOS/HTTP CLIENT SETUP ===')
const axiosCreate = [...js.matchAll(/\.create\s*\(\s*\{[^}]{0,500}\}/g)]
axiosCreate.forEach((m, i) => {
  console.log(`  ${i}: ${m[0].substring(0, 300)}`)
})

// Search for baseURL assignment near the HTTP calls
const shopSearchIdx = js.indexOf('"shop/search/products"')
if (shopSearchIdx > -1) {
  // Go back further to find the client setup
  const region = js.substring(Math.max(0, shopSearchIdx - 10000), shopSearchIdx)
  
  // Find baseURL in this region
  const baseUrls = [...region.matchAll(/baseURL\s*[:=]\s*["']([^"']+)["']/g)]
  console.log('\nbaseURL values near shop/search:', baseUrls.map(m => m[1]))

  // Find any URL configuration
  const urls = [...region.matchAll(/["'](https?:\/\/[^"']{5,100})["']/g)]
  console.log('URLs near shop/search:', urls.map(m => m[1]).filter(u => u.includes('arbuz')))

  // Find the module that defines r.a
  const rDotADefs = [...region.matchAll(/r\.a\s*=\s*[^;]{5,200}/g)]
  console.log('r.a definitions:', rDotADefs.map(m => m[0].substring(0, 150)))
}

// The JS code has: r.a.post("auth/token",{},t) where t = {consumer:n, key:i}
// r.a is likely a module imported or created somewhere
// Let me look for the module definition

// Find the webpack module that defines the API client
console.log('\n\n=== WEBPACK MODULE SEARCH ===')
const webpackModules = [...js.matchAll(/\{([a-z]):\.([a-z])\}/g)]
console.log('Destructured imports:', webpackModules.length)

// Look for the actual module that exports the HTTP client
// The code uses: r.a.get(), r.a.post() - so r.a is the axios instance
// Find 'var r' or 'const r' that imports the axios module
const varR = [...js.matchAll(/(?:var|const|let)\s+r\s*=\s*t\(\d+\)/g)]
console.log('var r = t(NNN) definitions:', varR.length)
varR.slice(0, 5).forEach(m => {
  const ctx = js.substring(m.index, m.index + 100)
  console.log('  ' + ctx)
})

// Alternative: find the module by looking at the variable 'r' near the search code
// The pattern is: r.a.get("shop/search/products")
// So 'r' must be defined in the same module scope
if (shopSearchIdx > -1) {
  const start = Math.max(0, shopSearchIdx - 20000)
  const region = js.substring(start, shopSearchIdx)
  
  // Find 'var r=' or 'const r=' in this region
  const rDefs = [...region.matchAll(/(?:var|const|let)\s+r(?:,([a-z]))?\s*=\s*([^\n;]{5,100})/g)]
  console.log('\nVariable r definitions near shop/search:')
  rDefs.slice(0, 10).forEach(m => console.log('  ' + m[0].substring(0, 150)))
  
  // Find require/import calls
  const requires = [...region.matchAll(/(?:var|const)\s+([a-z])\s*=\s*(?:n\(|t\()\s*(\d+)\s*\)/g)]
  console.log('\nModule imports near shop/search:')
  requires.slice(0, 30).forEach(m => console.log(`  ${m[1]} = require(${m[2]})`))
}

// Look for the actual API base URL in a different way - search for hostnames
console.log('\n\n=== ARBUZ API URL PATTERNS ===')
const apiUrls = [...js.matchAll(/["'](https?:\/\/[^"']*(?:arbuz|pinemelon)[^"']*)["']/g)]
const uniqueApiUrls = [...new Set(apiUrls.map(m => m[1]))]
uniqueApiUrls.forEach(u => console.log('  ' + u))

// Also search for Pinemelon - Arbuz might use Pinemelon platform
const pinemelon = [...js.matchAll(/pinemelon/gi)]
console.log('\nPinemelon references:', pinemelon.length)

const pinemelonIdx = js.indexOf('Pinemelon')
if (pinemelonIdx > -1) {
  console.log('Pinemelon context:', js.substring(pinemelonIdx - 100, pinemelonIdx + 200))
}
