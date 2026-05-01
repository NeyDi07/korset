const fs = require('fs')
const path = require('path')
const https = require('https')
const { URL } = require('url')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const { classifyBarcode } = require('./validate-ean.cjs')
const { downloadAndUpload } = require('./utils/r2-upload.cjs')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const NPC_API_KEY = process.env.NPC_API_KEY

const ARBUZ_CONSUMER_NAME = 'arbuz-kz.web.mobile'
const ARBUZ_CONSUMER_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
const ARBUZ_API_BASE = 'https://arbuz.kz/api/v1'
const ARBUZ_TOKEN_TTL = 10 * 60 * 1000
const DELAY_MS = 400
const OUT_DIR = path.join(__dirname, '..', 'data', 'arbuz-import')

let _tokenCache = { token: null, expires: 0 }

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function httpReq(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const reqOpts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Accept-Language': 'ru-RU,ru',
        ...headers,
      },
      timeout: 20000,
    }
    const req = https.request(reqOpts, res => {
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

async function getArbuzToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expires) return _tokenCache.token
  const r = await httpReq('POST', ARBUZ_API_BASE + '/auth/token', {}, {
    consumer: ARBUZ_CONSUMER_NAME,
    key: ARBUZ_CONSUMER_KEY,
  })
  if (r.status !== 200) throw new Error(`Auth failed: ${r.status} ${r.body.substring(0, 200)}`)
  const json = JSON.parse(r.body)
  const token = json.data?.token
  if (!token) throw new Error('No token in response')
  _tokenCache = { token, expires: Date.now() + ARBUZ_TOKEN_TTL }
  return token
}

async function arbuzApiGet(pathParam, params = {}) {
  const token = await getArbuzToken()
  const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  const url = ARBUZ_API_BASE + pathParam + (qs ? '?' + qs : '')
  const r = await httpReq('GET', url, { Authorization: 'Bearer ' + token })
  if (r.status !== 200) return { error: `HTTP ${r.status}`, data: null }
  try {
    return { error: null, data: JSON.parse(r.body).data }
  } catch (e) {
    return { error: `Parse error: ${e.message}`, data: null }
  }
}

function stripHtml(html) {
  if (!html) return null
  return html
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<\/p>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&plusmn;/g, '±')
    .replace(/&mdash;/g, '—')
    .replace(/&deg;/g, '°')
    .replace(/,(\s*,)+/g, ',')
    .replace(/^\s*,\s*/, '')
    .trim() || null
}

function parseNutrition(n) {
  if (!n || typeof n !== 'object') return null
  return {
    energy_kcal: n.kcal ? parseFloat(String(n.kcal).replace(',', '.')) : null,
    protein_100g: n.protein ? parseFloat(String(n.protein).replace(',', '.')) : null,
    fat_100g: n.fats ? parseFloat(String(n.fats).replace(',', '.')) : null,
    carbohydrates_100g: n.carbs ? parseFloat(String(n.carbs).replace(',', '.')) : null,
  }
}

function isHalalCharacteristic(characteristics) {
  if (!Array.isArray(characteristics)) return false
  return characteristics.some(c => c.name && c.name.toLowerCase().includes('халал'))
}

function normalize(str) {
  return (str || '').toLowerCase()
    .replace(/[éèêë]/g, 'e')
    .replace(/[áàâä]/g, 'a')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[''`]/g, "'")
    .replace(/['']/g, "'")
}

const ARBUZ_CATEGORY_MAP = {
  'ovoshchi-i-frukty': 'fruits_vegetables',
  'frukty': 'fruits_vegetables',
  'ovoshchi': 'fruits_vegetables',
  'moloko-i-molochnye': 'dairy',
  'moloko': 'dairy',
  'molochnye-produkty': 'dairy',
  'myaso-i-ptitsa': 'meat_poultry',
  'myaso': 'meat_poultry',
  'ptitsa': 'meat_poultry',
  'ryba-i-moreprodukty': 'fish_seafood',
  'ryba': 'fish_seafood',
  'khleb-i-vypechka': 'bread_bakery',
  'khleb': 'bread_bakery',
  'vypechka': 'bread_bakery',
  'makaronnye-izdeliya': 'pasta',
  'krupy-i-zavtraki': 'cereals_grains',
  'krupy': 'cereals_grains',
  'zavtraki': 'cereals_grains',
  'konservy': 'canned',
  'sousy-i-pryanosti': 'condiments',
  'sousy': 'condiments',
  'pryanosti': 'condiments',
  'napitki': 'beverages',
  'soki': 'beverages',
  'voda': 'beverages',
  'chay-i-kofe': 'beverages',
  'kofe': 'beverages',
  'sladosti-i-snekhi': 'sweets_snacks',
  'sladosti': 'sweets_snacks',
  'snekhi': 'sweets_snacks',
  'shokolad': 'sweets_snacks',
  'pechenye': 'sweets_snacks',
  'zamorozhennye-produkty': 'frozen',
  'zamorozhennye': 'frozen',
  'polufabrikaty': 'frozen',
  'maslo-i-zhiry': 'oils_fats',
  'maslo': 'oils_fats',
  'syr': 'dairy',
  'yaytsa': 'dairy',
  'delikatesy': 'delicatessen',
  'gotovye-blyuda': 'ready_meals',
  'dieticheskoe-pitanie': 'dietary',
  'detskie-tovary': 'baby_food',
  'detskoe-pitanie': 'baby_food',
  'zoootovary': 'pet_food',
  'krasota-i-zdorove': 'health_beauty',
  'bytovaya-khimiya': 'household',
  'alkogol': 'alcohol',
  'pivo': 'alcohol',
  'vino': 'alcohol',
}

function mapArbuzCategory(category) {
  if (!category) return 'grocery'
  const slug = normalize(category).replace(/\s+/g, '-')
  for (const [key, val] of Object.entries(ARBUZ_CATEGORY_MAP)) {
    if (slug.includes(key) || key.includes(slug)) return val
  }
  return 'grocery'
}

function calcQualityScore(d) {
  let score = 0
  if (d.name) score += 15
  if (d.ingredients_raw) score += 25
  if (d.nutriments_json && Object.values(d.nutriments_json).some(v => v != null)) score += 15
  if (d.image_url) score += 15
  if (d.halal_status === 'yes') score += 10
  if (d.brand) score += 10
  if (d.ean && !d.ean.startsWith('arbuz_')) score += 5
  if (d.country_of_origin) score += 5
  return Math.min(score, 100)
}

function httpPost(urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const url = new URL(urlStr)
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    }
    const req = https.request(options, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) })
        } catch (_) {
          resolve({ status: res.statusCode, body: body.substring(0, 500) })
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(data)
    req.end()
  })
}

async function npcSearchByEan(ean) {
  if (!NPC_API_KEY) return null
  try {
    const r = await httpPost('https://nationalcatalog.kz/gw/search/api/v1/search', { query: ean, page: 1, size: 3 }, { 'X-API-KEY': NPC_API_KEY })
    if (r.status !== 200) return null
    const items = r.body.items || []
    if (items.length === 0) return null
    return items[0]
  } catch {
    return null
  }
}

async function offFetchProduct(ean) {
  const fields = [
    'product_name', 'product_name_ru', 'brands', 'allergens_tags', 'traces_tags',
    'nutriments', 'nutriscore_grade', 'nova_group', 'labels_tags',
    'additives_tags', 'categories_tags', 'image_front_url',
  ].join(',')
  try {
    const r = await httpReq('GET', `https://world.openfoodfacts.org/api/v2/product/${ean}?fields=${fields}`, {
      'User-Agent': 'Korset/1.0 (korset.app)',
    })
    if (r.status !== 200) return null
    const json = JSON.parse(r.body)
    if (json.status !== 1 || !json.product) return null
    return json.product
  } catch {
    return null
  }
}

function parseOffAllergens(product) {
  const ALLERGEN_MAP = {
    'en:gluten': 'gluten', 'en:milk': 'milk', 'en:eggs': 'eggs',
    'en:peanuts': 'peanuts', 'en:soybeans': 'soy', 'en:tree-nuts': 'tree_nuts',
    'en:celery': 'celery', 'en:mustard': 'mustard', 'en:sesame': 'sesame',
    'en:sulphites': 'sulphites', 'en:fish': 'fish', 'en:crustaceans': 'crustaceans',
    'en:molluscs': 'molluscs', 'en:lupin': 'lupin',
  }
  const allergens = [...new Set((product.allergens_tags || []).map(a => ALLERGEN_MAP[a]).filter(Boolean))]
  const traces = [...new Set((product.traces_tags || []).map(a => ALLERGEN_MAP[a]).filter(Boolean))]
  return { allergens, traces }
}

function parseOffNutriments(product) {
  const n = product.nutriments || {}
  return {
    energy_kcal: n['energy-kcal_100g'] != null ? parseFloat(n['energy-kcal_100g']) : null,
    protein_100g: n.proteins_100g != null ? parseFloat(n.proteins_100g) : null,
    fat_100g: n.fat_100g != null ? parseFloat(n.fat_100g) : null,
    saturated_fat_100g: n['saturated-fat_100g'] != null ? parseFloat(n['saturated-fat_100g']) : null,
    carbohydrates_100g: n.carbohydrates_100g != null ? parseFloat(n.carbohydrates_100g) : null,
    sugar_100g: n.sugars_100g != null ? parseFloat(n.sugars_100g) : null,
    fiber_100g: n.fiber_100g != null ? parseFloat(n.fiber_100g) : null,
    salt_100g: n.salt_100g != null ? parseFloat(n.salt_100g) : null,
  }
}

function resolveEan(d) {
  if (!d.barcode) return 'arbuz_' + d.id
  const bc = classifyBarcode(String(d.barcode).trim())
  if (bc.valid && bc.ean13) return bc.ean13
  return 'arbuz_' + d.id
}

async function supabaseUpsert(product) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/global_products?on_conflict=ean`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(product),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upsert failed: ${res.status} ${text.substring(0, 300)}`)
  }
  return true
}

async function supabaseFetchByEan(ean) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/global_products?ean=eq.${encodeURIComponent(ean)}&select=id,ean,name,brand,ingredients_raw,halal_status,image_url,country_of_origin,specs_json,nutriments_json,source_primary`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
    },
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows.length > 0 ? rows[0] : null
}

function parseArgs() {
  const args = process.argv.slice(2)
  const result = { dryRun: false, limit: 0, category: null, skipImages: false }
  for (const arg of args) {
    if (arg === '--dry-run') result.dryRun = true
    else if (arg.startsWith('--limit=')) result.limit = parseInt(arg.split('=')[1], 10)
    else if (arg.startsWith('--category=')) result.category = arg.split('=')[1]
    else if (arg === '--skip-images') result.skipImages = true
  }
  return result
}

async function discoverCategories() {
  const r = await arbuzApiGet('/shop/categories')
  if (r.error) {
    console.error('Failed to fetch categories:', r.error)
    return []
  }
  const data = r.data
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.categories)) return data.categories
  if (data && Array.isArray(data.items)) return data.items
  if (data && typeof data === 'object') {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) return data[key]
    }
  }
  return []
}

async function fetchProductsByCategory(categoryId, page = 1, limit = 50) {
  const r = await arbuzApiGet('/shop/search/products', {
    'where[categoryId][c]': String(categoryId),
    limit: String(limit),
    page: String(page),
  })
  if (r.error) return { products: [], total: 0 }
  const data = r.data
  if (Array.isArray(data)) return { products: data, total: data.length }
  if (data && Array.isArray(data.items)) return { products: data.items, total: data.total || data.items.length }
  if (data && Array.isArray(data.products)) return { products: data.products, total: data.total || data.products.length }
  if (data && Array.isArray(data.list)) return { products: data.list, total: data.total || data.list.length }
  if (data && data.data && Array.isArray(data.data)) return { products: data.data, total: data.total || data.data.length }
  return { products: [], total: 0 }
}

async function fetchProductsByCollection(slug, page = 1, limit = 50) {
  const r = await arbuzApiGet(`/shop/collections/${slug}/products`, { limit: String(limit), page: String(page) })
  if (r.error) return { products: [], total: 0 }
  const data = r.data
  if (Array.isArray(data)) return { products: data, total: data.length }
  if (data && Array.isArray(data.items)) return { products: data.items, total: data.total || data.items.length }
  if (data && Array.isArray(data.products)) return { products: data.products, total: data.total || data.products.length }
  return { products: [], total: 0 }
}

async function fetchProductDetail(productId) {
  const r = await arbuzApiGet('/shop/product/' + productId)
  if (r.error) return null
  return r.data
}

async function processProduct(d, opts, stats) {
  const ean = resolveEan(d)

  const existing = opts.dryRun ? null : await supabaseFetchByEan(ean)

  const ingredients = stripHtml(d.ingredients)
  const nutrition = parseNutrition(d.nutrition)
  const halal = isHalalCharacteristic(d.characteristics)

  let imageUrl = null
  let imageSource = null
  let r2Key = null

  if (d.image && !opts.skipImages) {
    const arbuzImageUrl = d.image.replace(/w=%w&h=%h/, 'w=400&h=400')
    if (!opts.dryRun) {
      const uploaded = await downloadAndUpload(ean, arbuzImageUrl, 'main')
      if (uploaded) {
        imageUrl = uploaded.publicUrl
        r2Key = uploaded.r2Key || null
        imageSource = 'arbuz'
        stats.imagesUploaded++
      } else {
        imageUrl = arbuzImageUrl
        imageSource = 'arbuz'
      }
    } else {
      imageUrl = arbuzImageUrl
      imageSource = 'arbuz'
    }
  }

  const rawCategory = d.categoryName || d.category || null
  const norm = globalThis._normalizeCategory(rawCategory, null, d.name, d.brandName)
  const category = norm.category

  const product = {
    ean,
    name: d.name || null,
    name_kz: d.nameKk || null,
    brand: d.brandName || null,
    ingredients_raw: ingredients,
    nutriments_json: nutrition,
    halal_status: halal ? 'yes' : 'unknown',
    image_url: imageUrl,
    image_source: imageSource,
    r2_key: r2Key,
    source_primary: 'arbuz',
    source_confidence: 90,
    is_verified: true,
    country_of_origin: d.producerCountry || null,
    manufacturer: d.brandName || null,
    specs_json: { arbuz_price: d.priceActual || null, arbuz_id: d.id || null },
    category,
    is_active: true,
  }

  product.data_quality_score = calcQualityScore(product)

  let npcItem = null
  let offProduct = null

  const hasRealEan = !ean.startsWith('arbuz_')

  if (hasRealEan) {
    try {
      npcItem = await npcSearchByEan(ean)
      if (npcItem) {
        stats.npcMatches++
        const attrs = {}
        for (const a of (npcItem.attributes || [])) {
          if (a.value) attrs[a.code] = { nameRu: a.nameRu, value: a.value, valueRu: a.valueRu }
        }
        if (npcItem.gtin) {
          const bc = classifyBarcode(npcItem.gtin)
          if (bc.valid && bc.ean13) product.ean = bc.ean13
        }
        if (npcItem.nameRu && !product.name) product.name = npcItem.nameRu
        if (npcItem.nameKk && !product.name_kz) product.name_kz = npcItem.nameKk
        if (attrs.country?.valueRu && !product.country_of_origin) product.country_of_origin = attrs.country.valueRu
        if (attrs.producer_country?.valueRu && !product.country_of_origin) product.country_of_origin = attrs.producer_country.valueRu
        if (attrs.a4282e5d?.valueRu && !product.manufacturer) product.manufacturer = attrs.a4282e5d.valueRu
        product.specs_json.npc_id = npcItem.id || null
        if (npcItem.ntin) product.specs_json.ntin = npcItem.ntin
      }
    } catch {}

    await sleep(DELAY_MS)

    try {
      offProduct = await offFetchProduct(ean)
      if (offProduct) {
        stats.offMatches++
        const offAllergens = parseOffAllergens(offProduct)
        if (offAllergens.allergens.length > 0) product.allergens_json = offAllergens.allergens
        if (offAllergens.traces.length > 0) product.traces_json = offAllergens.traces
        if (offProduct.nutriscore_grade) product.nutriscore = offProduct.nutriscore_grade.toUpperCase()
        if (offProduct.nova_group) product.nova_group = offProduct.nova_group
        const offNutrition = parseOffNutriments(offProduct)
        if (!product.nutriments_json) {
          product.nutriments_json = offNutrition
        } else {
          for (const [k, v] of Object.entries(offNutrition)) {
            if (v != null && (product.nutriments_json[k] == null || product.nutriments_json[k] === null)) {
              product.nutriments_json[k] = v
            }
          }
        }
        if (offProduct.additives_tags) {
          product.additives_tags_json = offProduct.additives_tags.map(t => t.replace(/^en:/, '').toUpperCase())
        }
        const labels = offProduct.labels_tags || []
        const dietTags = []
        if (labels.some(l => /vegan/i.test(l))) dietTags.push('vegan')
        if (labels.some(l => /vegetarian/i.test(l))) dietTags.push('vegetarian')
        if (labels.some(l => /halal/i.test(l))) { dietTags.push('halal'); product.halal_status = 'yes' }
        if (labels.some(l => /gluten.free/i.test(l))) dietTags.push('gluten_free')
        if (dietTags.length > 0) product.diet_tags_json = dietTags
        if (offProduct.image_front_url && !product.image_url) {
          product.image_url = offProduct.image_front_url
          product.image_source = 'openfoodfacts'
        }
        product.data_quality_score = calcQualityScore(product)
      }
    } catch {}
  }

  if (existing) {
    stats.enriched++
    const merge = { updated_at: new Date().toISOString() }
    if (!existing.ingredients_raw && product.ingredients_raw) merge.ingredients_raw = product.ingredients_raw
    if (!existing.halal_status || existing.halal_status === 'unknown') {
      if (product.halal_status === 'yes') merge.halal_status = 'yes'
    }
    if (!existing.image_url && product.image_url) {
      merge.image_url = product.image_url
      merge.image_source = product.image_source
      if (r2Key) merge.r2_key = r2Key
    }
    if (!existing.nutriments_json && product.nutriments_json) merge.nutriments_json = product.nutriments_json
    if (!existing.country_of_origin && product.country_of_origin) merge.country_of_origin = product.country_of_origin
    if (!existing.manufacturer && product.manufacturer) merge.manufacturer = product.manufacturer
    if (product.allergens_json) merge.allergens_json = product.allergens_json
    if (product.traces_json) merge.traces_json = product.traces_json
    if (product.nutriscore) merge.nutriscore = product.nutriscore
    if (product.nova_group) merge.nova_group = product.nova_group
    if (product.additives_tags_json) merge.additives_tags_json = product.additives_tags_json
    if (product.diet_tags_json) merge.diet_tags_json = product.diet_tags_json
    if (!existing.name_kz && product.name_kz) merge.name_kz = product.name_kz
    const existingSpecs = existing.specs_json || {}
    merge.specs_json = { ...existingSpecs, ...(product.specs_json || {}) }
    if (existing.source_primary !== 'arbuz') {
      merge.source_primary = 'arbuz'
      merge.source_confidence = 90
      merge.is_verified = true
    }
    merge.data_quality_score = calcQualityScore({ ...existing, ...merge })

    if (!opts.dryRun && Object.keys(merge).length > 1) {
      const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
      const { error: updErr } = await sb.from('global_products').update(merge).eq('id', existing.id)
      if (updErr) throw new Error(`DB update error: ${updErr.message}`)
    }

    return { action: 'enriched', ean, name: product.name, arbuzId: d.id }
  }

  stats.created++
  product.created_at = new Date().toISOString()
  product.updated_at = product.created_at

  if (!opts.dryRun) {
    await supabaseUpsert(product)
  }

  return { action: 'created', ean, name: product.name, arbuzId: d.id }
}

async function main() {
  const { normalizeCategory } = await import('../src/domain/product/categoryMap.js')
  globalThis._normalizeCategory = normalizeCategory

  const opts = parseArgs()

  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Supabase keys not set'); process.exit(1) }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log('Authenticating with Arbuz API v1...')
  try {
    const token = await getArbuzToken()
    console.log('Token obtained, length:', token.length)
  } catch (e) {
    console.error('Auth failed:', e.message)
    process.exit(1)
  }

  const stats = {
    totalArbuzProducts: 0,
    created: 0,
    enriched: 0,
    imagesUploaded: 0,
    npcMatches: 0,
    offMatches: 0,
    errors: 0,
  }

  let categories = []

  if (opts.category) {
    console.log(`Using single category filter: ${opts.category}`)
    categories = [{ id: opts.category, name: opts.category, slug: opts.category }]
  } else {
    console.log('Discovering Arbuz categories...')
    const catResult = await discoverCategories()
    if (catResult.length === 0) {
      console.log('No categories returned, will try collection endpoint...')
      categories = []
    } else {
      categories = catResult
      console.log(`Found ${categories.length} categories`)
    }
  }

  let allProducts = []
  let processedCount = 0

  if (categories.length > 0) {
    for (const cat of categories) {
      const catId = cat.id || cat.slug || cat.code
      const catName = cat.name || cat.slug || catId
      console.log(`\n--- Category: ${catName} (${catId}) ---`)

      let page = 1
      let hasMore = true

      while (hasMore) {
        console.log(`  Fetching page ${page}...`)
        const result = await fetchProductsByCategory(catId, page, 50)
        const products = result.products || []

        if (products.length === 0) {
          console.log(`  No products found via categoryId, trying collection endpoint...`)
          const collResult = await fetchProductsByCollection(catId, page, 50)
          const collProducts = collResult.products || []
          if (collProducts.length > 0) {
            allProducts.push(...collProducts)
            console.log(`  Got ${collProducts.length} products from collection`)
            hasMore = collProducts.length >= 50
          } else {
            hasMore = false
          }
        } else {
          allProducts.push(...products)
          console.log(`  Got ${products.length} products (total so far: ${allProducts.length})`)
          hasMore = products.length >= 50
        }

        page++
        await sleep(DELAY_MS)

        if (opts.limit > 0 && allProducts.length >= opts.limit) {
          hasMore = false
        }
      }

      if (opts.limit > 0 && allProducts.length >= opts.limit) break
    }
  } else {
    console.log('\nNo categories available, browsing all products via search...')
    let page = 1
    let hasMore = true
    while (hasMore) {
      const r = await arbuzApiGet('/shop/search/products', { limit: '50', page: String(page) })
      if (r.error) {
        console.error(`Search page ${page} failed:`, r.error)
        break
      }
      const data = r.data
      let products = []
      if (Array.isArray(data)) products = data
      else if (data && Array.isArray(data.items)) products = data.items
      else if (data && Array.isArray(data.products)) products = data.products
      else if (data && Array.isArray(data.list)) products = data.list

      if (products.length === 0) { hasMore = false; break }

      allProducts.push(...products)
      console.log(`Page ${page}: ${products.length} products (total: ${allProducts.length})`)
      hasMore = products.length >= 50
      page++
      await sleep(DELAY_MS)

      if (opts.limit > 0 && allProducts.length >= opts.limit) break
    }
  }

  if (opts.limit > 0) {
    allProducts = allProducts.slice(0, opts.limit)
  }

  const seenEans = new Set()
  allProducts = allProducts.filter(p => {
    const ean = resolveEan(p)
    if (seenEans.has(ean)) return false
    seenEans.add(ean)
    return true
  })

  stats.totalArbuzProducts = allProducts.length
  console.log(`\nTotal unique Arbuz products to process: ${stats.totalArbuzProducts}`)

  if (stats.totalArbuzProducts === 0) {
    console.log('Nothing to do')
    return
  }

  const results = []

  for (let i = 0; i < allProducts.length; i++) {
    const d = allProducts[i]
    const label = `[${i + 1}/${allProducts.length}] ${d.brandName || '?'} — ${(d.name || '').substring(0, 30)}`
    process.stdout.write(`${label}... `)

    try {
      let detail = d
      if (d.id && (!d.ingredients && !d.nutrition && !d.characteristics)) {
        await sleep(DELAY_MS)
        const fetched = await fetchProductDetail(d.id)
        if (fetched) detail = fetched
      }

      const result = await processProduct(detail, opts, stats)
      console.log(`${result.action} (${result.ean})`)
      results.push(result)
    } catch (e) {
      console.log(`ERROR: ${e.message}`)
      stats.errors++
      results.push({ action: 'error', ean: resolveEan(d), name: d.name, error: e.message })
    }

    await sleep(DELAY_MS)
  }

  console.log('\n=== SUMMARY ===')
  console.log(`Total Arbuz products: ${stats.totalArbuzProducts}`)
  console.log(`New products created: ${stats.created}`)
  console.log(`Existing products enriched: ${stats.enriched}`)
  console.log(`Images uploaded to R2: ${stats.imagesUploaded}`)
  console.log(`NPC matches: ${stats.npcMatches}`)
  console.log(`OFF matches: ${stats.offMatches}`)
  console.log(`Errors: ${stats.errors}`)

  const outFile = path.join(OUT_DIR, `arbuz-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(outFile, JSON.stringify({ testedAt: new Date().toISOString(), stats, results }, null, 2))
  console.log(`Saved: ${outFile}`)
}

main().catch(e => { console.error(e); process.exit(1) })
