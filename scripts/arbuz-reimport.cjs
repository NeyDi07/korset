const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const { downloadAndUpload, inferSource } = require('./utils/r2-upload.cjs')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_BASE = 'https://arbuz.kz/api/v1'
const CONSUMER_NAME = 'arbuz-kz.web.mobile'
const CONSUMER_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
const CONCURRENCY = 5
const SEARCH_LIMIT = 50
const OUT_DIR = path.join(__dirname, '..', 'data', 'arbuz-reimport')
const PROGRESS_FILE = path.join(OUT_DIR, 'progress.json')

const SEARCH_QUERIES = [
  'молоко', 'кефир', 'сметана', 'йогурт', 'творог', 'сыр', 'ряженка', 'масло сливочное',
  'колбаса', 'сосиски', 'деликатесы', 'ветчина', 'сало',
  'чипсы', 'сухарики', 'попкорн', 'орешки', 'семечки',
  'конфеты', 'шоколад', 'печенье', 'вафли', 'зефир', 'мармелад', 'халва',
  'кофе', 'чай', 'какао',
  'вода', 'сок', 'напиток', 'лимонад', 'квас', 'энергетик',
  'макароны', 'крупа', 'рис', 'гречка', 'овсянка', 'мюсли',
  'майонез', 'кетчуп', 'соус', 'масло подсолнечное', 'масло оливковое',
  'консервы', 'шпроты', 'тунец', 'кукуруза', 'горошек',
  'хлеб', 'батон', 'лепешка', 'лаваш', 'булочка',
  'пельмени', 'вареники', 'котлеты', 'наггетсы', 'пицца',
  'мороженое', 'сгущенка', 'мёд', 'варенье',
  'сахар', 'мука', 'соль', 'специи', 'приправы',
  'сгущенное молоко', 'творожный сырок', 'плавленый сыр',
  'яйцо', 'уксус', 'уксус',
]

const SKIP_BRANDS = ['Arbuz Select', 'Arbuz Select х Бурненское', 'Arbuz Select x Meta Farm']

let _token = { value: null, expires: 0 }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function parseArgs() {
  const args = process.argv.slice(2)
  const result = { dryRun: false, skipR2: true, resume: false }
  for (const arg of args) {
    if (arg === '--dry-run') result.dryRun = true
    else if (arg === '--skip-r2') result.skipR2 = true
    else if (arg === '--resume') result.resume = true
  }
  return result
}

async function getToken() {
  if (_token.value && Date.now() < _token.expires) return _token.value
  const r = await fetch(API_BASE + '/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumer: CONSUMER_NAME, key: CONSUMER_KEY }),
  })
  const j = await r.json()
  _token = { value: j.data.token, expires: Date.now() + 10 * 60 * 1000 }
  return _token.value
}

function stripHtml(html) {
  if (!html) return null
  return html
    .replace(/<br\s*\/?>/gi, ', ').replace(/<\/p>/gi, ', ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/,(\s*,)+/g, ',').trim() || null
}

function parseNutrition(n) {
  if (!n || typeof n !== 'object') return null
  const result = {}
  if (n.kcal) result.energy_kcal = parseFloat(String(n.kcal).replace(',', '.'))
  if (n.protein) result.protein_100g = parseFloat(String(n.protein).replace(',', '.'))
  if (n.fats) result.fat_100g = parseFloat(String(n.fats).replace(',', '.'))
  if (n.carbs) result.carbohydrates_100g = parseFloat(String(n.carbs).replace(',', '.'))
  return Object.keys(result).length > 0 ? result : null
}

function isHalalCharacteristic(characteristics) {
  if (!Array.isArray(characteristics)) return false
  return characteristics.some(c => c.name && c.name.toLowerCase().includes('халал'))
}

function calcQualityScore(p) {
  let s = 0
  if (p.name) s += 15
  if (p.ingredients_raw) s += 25
  if (p.nutriments_json && Object.values(p.nutriments_json).some(v => v != null)) s += 15
  if (p.image_url) s += 15
  if (p.halal_status === 'yes') s += 10
  if (p.brand) s += 10
  if (p.ean && !p.ean.startsWith('arbuz_')) s += 5
  if (p.country_of_origin) s += 5
  return Math.min(s, 100)
}

async function apiSearch(query, token) {
  const url = `${API_BASE}/shop/search/products?where[name][c]=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}`
  const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
  if (!r.ok) return []
  const j = await r.json()
  return Array.isArray(j.data) ? j.data : []
}

async function apiDetail(productId, token) {
  const url = `${API_BASE}/shop/products/${productId}`
  const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
  if (!r.ok) return null
  const j = await r.json()
  return j.data || null
}

function mapToGlobalProduct(p, detail) {
  const d = detail || p
  const composition = stripHtml(d.ingredients || d.compound) || stripHtml(p.ingredients || p.compound)
  const nutrition = parseNutrition(d.nutrition || p.nutrition)
  const halal = isHalalCharacteristic(d.characteristics || p.characteristics)
  const barcode = d.barcode || p.barcode
  const ean = barcode ? String(barcode) : `arbuz_${p.id}`
  const image = d.image || p.image
  const imageUrl = image ? image.replace(/w=%w&h=%h/, 'w=400&h=400') : null

  return {
    ean,
    name: p.name,
    name_kz: null,
    brand: p.brandName || null,
    category: p.catalogName || null,
    subcategory: null,
    quantity: p.measure || null,
    image_url: imageUrl,
    images: null,
    ingredients_raw: composition,
    ingredients_kz: null,
    nutriments_json: nutrition,
    allergens_json: null,
    diet_tags_json: null,
    halal_status: halal ? 'yes' : 'unknown',
    nutriscore: null,
    data_quality_score: 0,
    source_primary: 'arbuz',
    source_confidence: 70,
    needs_review: false,
    is_verified: false,
    manufacturer: null,
    country_of_origin: p.producerCountry || null,
    description: stripHtml(d.description || p.description) || null,
    specs_json: {
      arbuzId: p.id,
      isWeighted: p.isWeighted || false,
      storageConditions: stripHtml(d.storageConditions || p.storageConditions) || null,
    },
    is_active: true,
    image_source: inferSource(imageUrl),
  }
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { processedQueries: [], processedIds: [] }
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) } catch { return { processedQueries: [], processedIds: [] } }
}

function saveProgress(p) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
}

async function batchUpsert(sb, products) {
  let inserted = 0, updated = 0, failed = 0

  const eans = products.map(p => p.ean)
  const { data: existing } = await sb.from('global_products').select('id, ean, name, ingredients_raw, brand, nutriments_json').in('ean', eans)
  const existingMap = new Map((existing || []).map(e => [e.ean, e]))

  const toInsert = []
  const toUpdate = []

  for (const p of products) {
    const ex = existingMap.get(p.ean)
    if (ex) {
      const u = {}
      if (!ex.ingredients_raw && p.ingredients_raw) u.ingredients_raw = p.ingredients_raw
      if (p.nutriments_json && Object.keys(p.nutriments_json).length > 0 && (!ex.nutriments_json || Object.values(ex.nutriments_json).every(v => v == null))) u.nutriments_json = p.nutriments_json
      if (p.brand && !ex.brand) u.brand = p.brand
      if (p.description && !ex.description) u.description = p.description
      if (p.country_of_origin && !ex.country_of_origin) u.country_of_origin = p.country_of_origin
      if (p.halal_status === 'yes') u.halal_status = 'yes'
      u.data_quality_score = Math.max(ex.data_quality_score || 0, p.data_quality_score)
      if (Object.keys(u).length > 0) toUpdate.push({ id: ex.id, updates: u })
      else { /* skip */ }
    } else {
      toInsert.push(p)
    }
  }

  if (toInsert.length > 0) {
    const { error } = await sb.from('global_products').insert(toInsert)
    if (error) {
      for (const p of toInsert) {
        const { error: e2 } = await sb.from('global_products').insert(p)
        if (e2 && e2.code !== '23505') { failed++ } else { inserted++ }
      }
    } else {
      inserted = toInsert.length
    }
  }

  for (const { id, updates } of toUpdate) {
    const { error } = await sb.from('global_products').update(updates).eq('id', id)
    if (error) failed++; else updated++
  }

  return { inserted, updated, failed }
}

async function main() {
  const opts = parseArgs()
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Supabase keys not set'); process.exit(1) }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  try {
    await getToken()
    console.log('Arbuz auth OK')
  } catch (e) {
    console.error('Auth FAILED:', e.message)
    process.exit(1)
  }

  console.log('════════════════════════════════════════════════')
  console.log('ARBUZ RE-IMPORT v2 (parallel search)')
  console.log('════════════════════════════════════════════════')
  console.log(`Dry run: ${opts.dryRun}, Skip R2: ${opts.skipR2}, Resume: ${opts.resume}`)
  console.log()

  const progress = loadProgress()
  const doneQueries = new Set(progress.processedQueries || [])
  const doneIds = new Set(progress.processedIds || [])

  let totalDiscovered = 0
  let totalInserted = 0
  let totalUpdated = 0
  let totalSkipped = 0
  let totalFailed = 0
  let totalStmSkipped = 0

  const t0 = Date.now()

  // PHASE 1: Search queries to discover products
  const queries = SEARCH_QUERIES.filter(q => !doneQueries.has(q))
  console.log(`Queries: ${queries.length} (${doneQueries.size} already done)`)

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi]
    const token = await getToken()
    process.stdout.write(`[${qi + 1}/${queries.length}] "${query}": `)

    const prods = await apiSearch(query, token)
    const newProds = prods.filter(p => !doneIds.has(String(p.id)))
    const stmProds = newProds.filter(p => SKIP_BRANDS.some(b => p.brandName && p.brandName.includes(b)))

    console.log(`${prods.length} found, +${newProds.length - stmProds.length} new (${stmProds.length} СТМ skipped)`)
    totalStmSkipped += stmProds.length

    const goodProds = newProds.filter(p => !SKIP_BRANDS.some(b => p.brandName && p.brandName.includes(b)))
    if (!goodProds.length) { doneQueries.add(query); continue }

    // Fetch details in parallel batches
    const products = []
    for (let i = 0; i < goodProds.length; i += CONCURRENCY) {
      const batch = goodProds.slice(i, i + CONCURRENCY)
      const token2 = await getToken()
      const details = await Promise.allSettled(
        batch.map(p => apiDetail(p.id, token2).catch(() => null))
      )
      for (let j = 0; j < batch.length; j++) {
        const detail = details[j]?.status === 'fulfilled' ? details[j].value : null
        const gp = mapToGlobalProduct(batch[j], detail)
        gp.data_quality_score = calcQualityScore(gp)
        products.push(gp)
        doneIds.add(String(batch[j].id))
      }
    }

    totalDiscovered += products.length

    if (opts.dryRun) {
      console.log(`  DRY: ${products.length} products`)
      products.slice(0, 2).forEach(p => console.log(`    "${p.name}" comp=${!!p.ingredients_raw} ean=${p.ean}`))
    } else {
      // Batch upsert
      for (let i = 0; i < products.length; i += 50) {
        const batch = products.slice(i, i + 50)
        const result = await batchUpsert(sb, batch)
        totalInserted += result.inserted
        totalUpdated += result.updated
        totalFailed += result.failed
      }
    }

    doneQueries.add(query)
    if (qi % 5 === 0) {
      progress.processedQueries = [...doneQueries]
      progress.processedIds = [...doneIds]
      saveProgress(progress)
    }

    await sleep(200)
  }

  progress.processedQueries = [...doneQueries]
  progress.processedIds = [...doneIds]
  saveProgress(progress)

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log('\n════════════════════════════════════════════════')
  console.log('  SUMMARY')
  console.log('════════════════════════════════════════════════')
  console.log(`  Discovered:    ${totalDiscovered}`)
  console.log(`  Inserted:      ${totalInserted}`)
  console.log(`  Updated:       ${totalUpdated}`)
  console.log(`  STM skipped:   ${totalStmSkipped}`)
  console.log(`  Failed:        ${totalFailed}`)
  console.log(`  Time:          ${elapsed}s`)
  console.log(`  Mode:          ${opts.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('════════════════════════════════════════════════')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
