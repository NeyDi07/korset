const https = require('https')
const { URL } = require('url')
const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'data', 'arbuz-methods')
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

const CONSUMER_NAME = 'arbuz-kz.web.mobile'
const CONSUMER_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
const API_BASE = 'https://arbuz.kz/api/v1'
const TOKEN_TTL = 10 * 60 * 1000

let _token = { value: null, expires: 0 }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function httpReq(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Accept-Language': 'ru-RU,ru',
        ...headers,
      },
      timeout: 20000,
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

async function getToken() {
  if (_token.value && Date.now() < _token.expires) return _token.value
  const r = await httpReq('POST', API_BASE + '/auth/token', {}, {
    consumer: CONSUMER_NAME, key: CONSUMER_KEY,
  })
  if (r.status !== 200) throw new Error(`Auth failed: ${r.status}`)
  const json = JSON.parse(r.body)
  const token = json.data?.token
  if (!token) throw new Error('No token')
  _token = { value: token, expires: Date.now() + TOKEN_TTL }
  return token
}

async function apiGet(path, params = {}) {
  const token = await getToken()
  const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  const url = API_BASE + path + (qs ? '?' + qs : '')
  const r = await httpReq('GET', url, { Authorization: 'Bearer ' + token })
  if (r.status !== 200) return { error: `HTTP ${r.status}`, data: null }
  try {
    const json = JSON.parse(r.body)
    return { error: null, data: json.data, raw: json }
  } catch (e) {
    return { error: `Parse: ${e.message}`, data: null }
  }
}

function stripHtml(html) {
  if (!html) return null
  return html
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<\/p>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/,(\s*,)+/g, ',').replace(/^\s*,\s*/, '').trim() || null
}

function hasIngredients(p) {
  if (p.ingredients && stripHtml(p.ingredients)) return true
  if (p.composition && stripHtml(p.composition)) return true
  return false
}

function hasNutrition(p) {
  return !!p.nutrition
}

async function main() {
  console.log('=== ARBUZ API METHOD TEST ===\n')
  console.log('Testing 3 methods to find best way to get composition data\n')

  try {
    const token = await getToken()
    console.log('Auth OK, token length:', token.length, '\n')
  } catch (e) {
    console.error('AUTH FAILED:', e.message)
    process.exit(1)
  }

  // ============================================================
  // METHOD 1: Categories browsing
  // ============================================================
  console.log('━'.repeat(60))
  console.log('METHOD 1: /shop/categories + browsing by category')
  console.log('━'.repeat(60))

  let categories = []
  const catResult = await apiGet('/shop/categories')
  if (catResult.error) {
    console.log('❌ /shop/categories FAILED:', catResult.error)
  } else {
    const data = catResult.data
    console.log('Response type:', Array.isArray(data) ? 'array' : typeof data)
    if (Array.isArray(data)) {
      categories = data
    } else if (data && typeof data === 'object') {
      const keys = Object.keys(data)
      console.log('Object keys:', keys.slice(0, 10).join(', '))
      for (const key of keys) {
        if (Array.isArray(data[key])) {
          categories = data[key]
          console.log('Found array in key:', key, '- length:', categories.length)
          break
        }
      }
    }

    console.log(`\nCategories found: ${categories.length}`)
    categories.slice(0, 15).forEach((c, i) => {
      const id = c.id || c.slug || c.code || '-'
      const name = c.name || c.title || c.slug || '-'
      const count = c.productsCount || c.count || c.product_count || '-'
      const hasSub = c.children || c.subcategories || c.items
      console.log(`  ${i + 1}. id=${id} name="${name}" products=${count}${hasSub ? ' [has children]' : ''}`)
    })

    if (categories.length > 0) {
      fs.writeFileSync(path.join(OUT_DIR, 'categories.json'), JSON.stringify(categories, null, 2))
    }
  }

  // Try browsing products by first category
  let method1Products = []
  if (categories.length > 0) {
    const testCat = categories[0]
    const catId = testCat.id || testCat.slug || testCat.code
    console.log(`\n--- Testing category browse: "${testCat.name || catId}" (id=${catId}) ---`)

    const browseTests = [
      { label: 'where[categoryId][c]', params: { 'where[categoryId][c]': String(catId), limit: '50' } },
      { label: 'where[catalogId][c]', params: { 'where[catalogId][c]': String(catId), limit: '50' } },
      { label: 'where[category_id][eq]', params: { 'where[category_id][eq]': String(catId), limit: '50' } },
      { label: 'where[catalog_id][eq]', params: { 'where[catalog_id][eq]': String(catId), limit: '50' } },
      { label: 'category_id param', params: { category_id: String(catId), limit: '50' } },
      { label: 'catalog_id param', params: { catalog_id: String(catId), limit: '50' } },
    ]

    for (const bt of browseTests) {
      const r = await apiGet('/shop/search/products', bt.params)
      const count = Array.isArray(r.data) ? r.data.length : (r.data?.items?.length || r.data?.products?.length || 0)
      console.log(`  ${bt.label}: ${r.error || count + ' products'}`)
      if (count > 0) {
        method1Products = Array.isArray(r.data) ? r.data : (r.data.items || r.data.products || [])
        console.log(`  ✅ WORKS! First product: ${method1Products[0]?.name || method1Products[0]?.brandName}`)
        console.log(`  Has ingredients: ${hasIngredients(method1Products[0])}, Has nutrition: ${hasNutrition(method1Products[0])}`)
        break
      }
      await sleep(200)
    }

    // If category search doesn't work, try child categories
    if (method1Products.length === 0 && (testCat.children || testCat.subcategories)) {
      const children = testCat.children || testCat.subcategories || []
      console.log(`\n  Trying ${children.length} child categories...`)
      for (const child of children.slice(0, 3)) {
        const childId = child.id || child.slug || child.code
        const r = await apiGet('/shop/search/products', { 'where[categoryId][c]': String(childId), limit: '10' })
        const count = Array.isArray(r.data) ? r.data.length : 0
        console.log(`  Child "${child.name || childId}": ${r.error || count + ' products'}`)
        if (count > 0) {
          method1Products = Array.isArray(r.data) ? r.data : []
          break
        }
        await sleep(200)
      }
    }
  }

  // Try publications/collections
  console.log('\n--- Testing publications-products (known collections) ---')
  const collectionIds = [251362, 251965, 252029, 252032, 252033]
  let collectionProducts = []
  let totalWithComp = 0, totalWithNut = 0

  for (const cid of collectionIds) {
    const r = await apiGet(`/shop/publications-products/${cid}`)
    if (r.error) { console.log(`  Collection ${cid}: ${r.error}`); continue }
    const prods = Array.isArray(r.data) ? r.data : (r.data?.items || r.data?.products || [])
    const withComp = prods.filter(p => hasIngredients(p)).length
    const withNut = prods.filter(p => hasNutrition(p)).length
    totalWithComp += withComp
    totalWithNut += withNut
    collectionProducts.push(...prods)
    console.log(`  Collection ${cid}: ${prods.length} products, composition:${withComp}, nutrition:${withNut}`)
    if (prods[0]) {
      console.log(`    Sample: ${prods[0].brandName || '?'} — ${(prods[0].name || '').substring(0, 40)}`)
      console.log(`    Has ingredients: ${hasIngredients(prods[0])}, Has nutrition: ${hasNutrition(prods[0])}`)
    }
    await sleep(300)
  }
  console.log(`  TOTAL collections: ${collectionProducts.length} products, composition:${totalWithComp}, nutrition:${totalWithNut}`)

  // ============================================================
  // METHOD 2: Search by PRODUCT NAME (not brand)
  // ============================================================
  console.log('\n' + '━'.repeat(60))
  console.log('METHOD 2: Search by product name (not just brand)')
  console.log('━'.repeat(60))

  const testQueries = [
    { query: 'Шоколад Milka молочный', type: 'name+brand' },
    { query: 'Doritos Nacho Cheese', type: 'name+brand en' },
    { query: 'Шоколад Ritter Sport', type: 'name+brand' },
    { query: 'Nutella крем', type: 'name+brand' },
    { query: 'Coca-Cola', type: 'brand only' },
    { query: 'Хлеб Зернышко', type: 'name ru' },
    { query: 'Ряженка', type: 'name ru' },
    { query: 'Alpro овсяный', type: 'name+brand' },
    { query: 'Schogetten', type: 'brand only' },
    { query: 'Bucheron шоколад', type: 'brand+name' },
  ]

  let method2Stats = { found: 0, withComp: 0, withNut: 0, notFound: 0 }
  const method2Results = []

  for (const tq of testQueries) {
    const r = await apiGet('/shop/search/products', { 'where[name][c]': tq.query, limit: '50' })
    if (r.error) {
      console.log(`  "${tq.query}" (${tq.type}): ❌ ${r.error}`)
      method2Stats.notFound++
      continue
    }
    const prods = Array.isArray(r.data) ? r.data : (r.data?.items || [])
    if (prods.length === 0) {
      console.log(`  "${tq.query}" (${tq.type}): 0 results`)
      method2Stats.notFound++
      continue
    }

    const top3 = prods.slice(0, 3).map(p => ({
      name: p.name?.substring(0, 40),
      brand: p.brandName,
      hasComp: hasIngredients(p),
      hasNut: hasNutrition(p),
    }))

    method2Stats.found++
    if (prods[0] && hasIngredients(prods[0])) method2Stats.withComp++
    if (prods[0] && hasNutrition(prods[0])) method2Stats.withNut++

    console.log(`  "${tq.query}" (${tq.type}): ${prods.length} results | comp:${top3[0]?.hasComp} nut:${top3[0]?.hasNut}`)
    top3.forEach((t, i) => console.log(`    ${i + 1}. ${t.brand} — ${t.name} [comp:${t.hasComp} nut:${t.hasNut}]`))

    method2Results.push({ query: tq.query, type: tq.type, count: prods.length, top: top3 })

    await sleep(300)
  }

  console.log(`\n  METHOD 2 summary: found=${method2Stats.found}/${testQueries.length}, comp=${method2Stats.withComp}, nut=${method2Stats.withNut}, notFound=${method2Stats.notFound}`)

  // ============================================================
  // METHOD 3: Search by brand (current method) with HIGHER limit
  // ============================================================
  console.log('\n' + '━'.repeat(60))
  console.log('METHOD 3: Search by brand only (current method, limit=50)')
  console.log('━'.repeat(60))

  const brandQueries = [
    { query: 'Milka', type: 'brand' },
    { query: 'Ritter Sport', type: 'brand' },
    { query: 'Nutella', type: 'brand' },
    { query: 'Doritos', type: 'brand' },
    { query: 'Alpro', type: 'brand' },
    { query: 'Schogetten', type: 'brand' },
    { query: 'Bucheron', type: 'brand' },
    { query: 'Chokodelika', type: 'brand' },
    { query: 'Coca-Cola', type: 'brand' },
    { query: 'Зернышко', type: 'brand ru' },
  ]

  let method3Stats = { found: 0, withComp: 0, withNut: 0, notFound: 0 }

  for (const bq of brandQueries) {
    const r = await apiGet('/shop/search/products', { 'where[name][c]': bq.query, limit: '50' })
    if (r.error) {
      console.log(`  "${bq.query}": ❌ ${r.error}`)
      method3Stats.notFound++
      continue
    }
    const prods = Array.isArray(r.data) ? r.data : []
    if (prods.length === 0) {
      console.log(`  "${bq.query}": 0 results`)
      method3Stats.notFound++
      continue
    }

    method3Stats.found++
    if (prods[0] && hasIngredients(prods[0])) method3Stats.withComp++
    if (prods[0] && hasNutrition(prods[0])) method3Stats.withNut++

    console.log(`  "${bq.query}": ${prods.length} results | top: ${prods[0]?.brandName} — ${(prods[0]?.name || '').substring(0, 40)} [comp:${hasIngredients(prods[0])}]`)

    await sleep(300)
  }

  console.log(`\n  METHOD 3 summary: found=${method3Stats.found}/${brandQueries.length}, comp=${method3Stats.withComp}, nut=${method3Stats.withNut}`)

  // ============================================================
  // KEY QUESTION: Does search result include composition/nutrition?
  // Or do we NEED to call /shop/product/{id} for each?
  // ============================================================
  console.log('\n' + '━'.repeat(60))
  console.log('CRITICAL: Does search include ingredients, or need detail API?')
  console.log('━'.repeat(60))

  const r = await apiGet('/shop/search/products', { 'where[name][c]': 'Milka', limit: '5' })
  if (r.data && Array.isArray(r.data) && r.data.length > 0) {
    const sample = r.data[0]
    const keys = Object.keys(sample)
    console.log('Search result keys:', keys.join(', '))
    console.log(`  ingredients: ${sample.ingredients ? 'YES' : 'NO'}`)
    console.log(`  nutrition: ${sample.nutrition ? 'YES' : 'NO'}`)
    console.log(`  characteristics: ${sample.characteristics ? 'YES' : 'NO'}`)
    console.log(`  composition: ${sample.composition ? 'YES' : 'NO'}`)
    console.log(`  description: ${sample.description ? 'YES' : 'NO'}`)

    // Now get detail
    if (sample.id) {
      console.log(`\n  Fetching detail for id=${sample.id}...`)
      const det = await apiGet('/shop/product/' + sample.id)
      if (det.data) {
        const detKeys = Object.keys(det.data)
        const searchOnlyKeys = detKeys.filter(k => !keys.includes(k))
        const missingInSearch = ['ingredients', 'nutrition', 'characteristics', 'composition', 'description', 'information', 'diet_preferences', 'storage_conditions', 'shelf_life_days']
        console.log('  Detail keys NOT in search:', searchOnlyKeys.join(', '))
        console.log('  Critical fields present in detail but NOT search:')
        missingInSearch.forEach(f => {
          const inSearch = keys.includes(f) && !!sample[f]
          const inDetail = detKeys.includes(f) && !!det.data[f]
          if (inDetail && !inSearch) console.log(`    ❌ ${f}: search=NO, detail=YES`)
          else if (inSearch) console.log(`    ✅ ${f}: search=YES`)
        })

        if (det.data.ingredients) {
          const comp = stripHtml(det.data.ingredients)
          console.log(`\n  Sample composition (detail): ${(comp || '').substring(0, 150)}...`)
        }
        if (det.data.nutrition) {
          console.log(`  Sample nutrition (detail): ${JSON.stringify(det.data.nutrition)}`)
        }
        if (det.data.characteristics) {
          console.log(`  Sample characteristics: ${JSON.stringify(det.data.characteristics)}`)
        }
      }
    }
  }

  // ============================================================
  // METHOD 1 DEEP TEST: Try to get 50 products from categories
  // ============================================================
  console.log('\n' + '━'.repeat(60))
  console.log('METHOD 1 DEEP: Browse categories → get 50 products → check composition')
  console.log('━'.repeat(60))

  let allCatProducts = []
  let catProductsNeedDetail = true

  if (categories.length > 0) {
    for (const cat of categories.slice(0, 10)) {
      if (allCatProducts.length >= 50) break
      const catId = cat.id || cat.slug || cat.code
      const catName = cat.name || cat.slug || catId

      // Try different param formats
      const paramSets = [
        { 'where[categoryId][c]': String(catId), limit: '50' },
        { 'where[catalogId][c]': String(catId), limit: '50' },
      ]

      let catProds = []
      for (const params of paramSets) {
        const r = await apiGet('/shop/search/products', params)
        if (!r.error) {
          catProds = Array.isArray(r.data) ? r.data : (r.data?.items || [])
          if (catProds.length > 0) break
        }
        await sleep(200)
      }

      if (catProds.length === 0) continue

      console.log(`  Category "${catName}" (${catId}): ${catProds.length} products`)

      // Check if search results have composition
      if (catProds.some(p => hasIngredients(p))) {
        catProductsNeedDetail = false
        console.log(`    ✅ Search results INCLUDE composition!`)
      }

      allCatProducts.push(...catProds)
      await sleep(300)
    }
  }

  // If no products from categories, try collections
  if (allCatProducts.length < 50) {
    console.log(`  Only ${allCatProducts.length} from categories, trying collections...`)
    for (const cid of collectionIds) {
      if (allCatProducts.length >= 50) break
      const r = await apiGet(`/shop/publications-products/${cid}`)
      if (r.error) continue
      const prods = Array.isArray(r.data) ? r.data : (r.data?.items || [])
      if (prods.some(p => hasIngredients(p))) {
        catProductsNeedDetail = false
      }
      allCatProducts.push(...prods)
      console.log(`  Collection ${cid}: +${prods.length} (total: ${allCatProducts.length})`)
      await sleep(300)
    }
  }

  // De-duplicate by id
  const seen = new Set()
  allCatProducts = allCatProducts.filter(p => {
    if (!p.id || seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })

  console.log(`\n  Total unique products from categories/collections: ${allCatProducts.length}`)

  // If we need detail, fetch first 10 to check composition rate
  if (catProductsNeedDetail && allCatProducts.length > 0) {
    console.log(`  Search does NOT include composition. Fetching detail for 10 products...`)
    let detComp = 0, detNut = 0
    for (const p of allCatProducts.slice(0, 10)) {
      const det = await apiGet('/shop/product/' + p.id)
      if (det.data) {
        if (hasIngredients(det.data)) detComp++
        if (hasNutrition(det.data)) detNut++
        console.log(`    ${p.brandName || '?'} — ${(p.name || '').substring(0, 30)}: comp=${!!det.data.ingredients} nut=${!!det.data.nutrition}`)
      }
      await sleep(300)
    }
    console.log(`  Detail composition rate: ${detComp}/10, nutrition: ${detNut}/10`)
  } else {
    const compCount = allCatProducts.filter(p => hasIngredients(p)).length
    const nutCount = allCatProducts.filter(p => hasNutrition(p)).length
    console.log(`  Search composition rate: ${compCount}/${allCatProducts.length}, nutrition: ${nutCount}/${allCatProducts.length}`)
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '═'.repeat(60))
  console.log('SUMMARY: Which method is best?')
  console.log('═'.repeat(60))
  console.log(`Method 1 (categories): ${allCatProducts.length} products found, need detail: ${catProductsNeedDetail}`)
  console.log(`Method 2 (search by name): found=${method2Stats.found}/${testQueries.length}, comp=${method2Stats.withComp}`)
  console.log(`Method 3 (search by brand): found=${method3Stats.found}/${brandQueries.length}, comp=${method3Stats.withComp}`)
  console.log(`Collections: ${collectionProducts.length} products, comp=${totalWithComp}, nut=${totalWithNut}`)

  fs.writeFileSync(path.join(OUT_DIR, 'test-results.json'), JSON.stringify({
    method1: { totalProducts: allCatProducts.length, needDetail: catProductsNeedDetail, categoriesFound: categories.length },
    method2: method2Stats,
    method3: method3Stats,
    collections: { totalProducts: collectionProducts.length, withComp: totalWithComp, withNut: totalWithNut },
  }, null, 2))

  console.log(`\nResults saved to ${OUT_DIR}/test-results.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
