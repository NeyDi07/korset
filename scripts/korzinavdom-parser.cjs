const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const { downloadAndUpload, inferSource } = require('./utils/r2-upload.cjs')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_BASE = 'https://api.korzinavdom.kz/client'
const CONCURRENCY = 5
const DB_BATCH = 50
const OUT_DIR = path.join(__dirname, '..', 'data', 'korzinavdom')
const PROGRESS_FILE = path.join(OUT_DIR, 'progress.json')

const MILK_CATEGORIES = [
  { number: 3, name: 'Молочные продукты и сыры, яйцо' },
]

const SNACK_CATEGORIES = [
  { number: 15, name: 'Снеки (чипсы, попкорн, семечки)' },
]

const ALL_CATEGORIES = [...MILK_CATEGORIES, ...SNACK_CATEGORIES]

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function parseArgs() {
  const args = process.argv.slice(2)
  const result = { dryRun: false, limit: 0, skipR2: false, resume: false, categories: null }
  for (const arg of args) {
    if (arg === '--dry-run') result.dryRun = true
    else if (arg.startsWith('--limit=')) result.limit = parseInt(arg.split('=')[1], 10)
    else if (arg === '--skip-r2') result.skipR2 = true
    else if (arg === '--resume') result.resume = true
    else if (arg.startsWith('--categories=')) result.categories = arg.split('=')[1].split(',').map(Number)
  }
  return result
}

async function fetchPage(catNumber, page, size = 500) {
  try {
    const url = `${API_BASE}/showcases?categoryNumber=${catNumber}&size=${size}&page=${page}`
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!r.ok) return null
    const j = await r.json()
    return j.data?.page || null
  } catch { return null }
}

async function fetchAllListItems(catNumber) {
  const allItems = []
  let page = 0
  while (true) {
    const pageData = await fetchPage(catNumber, page, 500)
    if (!pageData || !pageData.content?.length) break
    allItems.push(...pageData.content)
    if (pageData.last) break
    const totalPages = pageData.totalPages || 0
    if (totalPages > 0 && page >= totalPages - 1) break
    page++
    if (page > 20) break
  }
  const seen = new Set()
  return allItems.filter(item => {
    if (seen.has(item.quantumNumber)) return false
    seen.add(item.quantumNumber)
    return true
  })
}

async function fetchDetailsParallel(items) {
  const details = []
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(item =>
        fetch(`${API_BASE}/showcases/${item.quantumNumber}`, { signal: AbortSignal.timeout(10000) })
          .then(r => r.json())
          .then(j => j.data || null)
          .catch(() => null)
      )
    )
    for (const r of results) {
      details.push(r.status === 'fulfilled' ? r.value : null)
    }
  }
  return details
}

function extractNutriments(options) {
  if (!Array.isArray(options)) return null
  const result = {}
  for (const opt of options) {
    if (opt.optionName === 'Энергетическая ценность (ккал на 100г)' && opt.valueFloat) result.energy_kcal = opt.valueFloat
    if (opt.optionName === 'Белки' && opt.valueFloat) result.protein_100g = opt.valueFloat
    if (opt.optionName === 'Жиры' && opt.valueFloat) result.fat_100g = opt.valueFloat
    if (opt.optionName === 'Углеводы' && opt.valueFloat) result.carbohydrates_100g = opt.valueFloat
  }
  return Object.keys(result).length > 0 ? result : null
}

function extractManufacturer(options) {
  if (!Array.isArray(options)) return null
  return options.find(o => o.optionName === 'Производитель')?.valueVariant || null
}

function extractHalalStatus(detail) {
  if (detail.markers?.some(m => (m.text || m.title || '').toLowerCase().includes('халал'))) return 'yes'
  if (detail.promotion?.text?.toLowerCase().includes('халяль')) return 'yes'
  return null
}

function mapToGlobalProduct(item, detail) {
  const ean = `korzinavdom_${detail.quantumNumber || item.quantumNumber}`
  const catPath = detail.catalogPath || item.catalogPath || []
  const category = catPath.map(c => c.title).filter(Boolean).join(' / ') || null
  const subcategory = catPath.length > 0 ? catPath[catPath.length - 1].title : null

  return {
    ean,
    name: detail.productName || item.productName,
    name_kz: null,
    brand: detail.brand || null,
    category,
    subcategory,
    quantity: item.quantumUnit === 'кг' ? 'вес' : item.quantumUnit || null,
    image_url: detail.imagePath || item.imagePath || null,
    images: null,
    ingredients_raw: detail.composition || null,
    ingredients_kz: null,
    nutriments_json: extractNutriments(detail.options),
    allergens_json: null,
    diet_tags_json: null,
    halal_status: extractHalalStatus(detail) || 'unknown',
    nutriscore: null,
    data_quality_score: 0,
    source_primary: 'korzinavdom',
    source_confidence: 70,
    needs_review: false,
    is_verified: false,
    manufacturer: extractManufacturer(detail.options),
    country_of_origin: detail.country || null,
    description: detail.productDescription || null,
    specs_json: {
      shelfLife: detail.shelfLife || null,
      storageConditions: detail.storageConditions || null,
      vendorCode: detail.vendorCode || null,
      ownProduction: detail.ownProduction || false,
      korzinavdomId: detail.productNumber || item.productNumber,
      quantumNumber: detail.quantumNumber || item.quantumNumber,
    },
    is_active: true,
    image_source: inferSource(detail.imagePath || item.imagePath),
  }
}

function calcQualityScore(p) {
  let s = 0
  if (p.name) s += 15
  if (p.ingredients_raw) s += 25
  if (p.nutriments_json && Object.values(p.nutriments_json).some(v => v != null)) s += 15
  if (p.image_url) s += 15
  if (p.halal_status === 'yes') s += 10
  if (p.brand) s += 10
  if (p.country_of_origin) s += 5
  return Math.min(s, 100)
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { processedCategories: [], productCount: 0 }
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) } catch { return { processedCategories: [], productCount: 0 } }
}

function saveProgress(p) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
}

async function batchUpsert(sb, products) {
  let inserted = 0, updated = 0, failed = 0

  const eans = products.map(p => p.ean)
  const { data: existing } = await sb
    .from('global_products')
    .select('id, ean, name, ingredients_raw, brand, country_of_origin')
    .in('ean', eans)

  const existingMap = new Map((existing || []).map(e => [e.ean, e]))
  const toInsert = []
  const toUpdate = []

  for (const p of products) {
    const ex = existingMap.get(p.ean)
    if (ex) {
      const u = {}
      if (!ex.ingredients_raw && p.ingredients_raw) u.ingredients_raw = p.ingredients_raw
      if (p.nutriments_json && Object.keys(p.nutriments_json).length > 0) u.nutriments_json = p.nutriments_json
      if (p.brand && !ex.brand) u.brand = p.brand
      if (p.manufacturer) u.manufacturer = p.manufacturer
      if (p.country_of_origin && !ex.country_of_origin) u.country_of_origin = p.country_of_origin
      if (p.description) u.description = p.description
      if (p.specs_json) u.specs_json = p.specs_json
      if (p.halal_status === 'yes') u.halal_status = 'yes'
      if (p.image_url) u.image_url = p.image_url
      if (p.image_source) u.image_source = p.image_source
      u.data_quality_score = Math.max(ex.data_quality_score || 0, p.data_quality_score)
      if (Object.keys(u).length > 0) toUpdate.push({ id: ex.id, updates: u })
    } else {
      toInsert.push(p)
    }
  }

  if (toInsert.length > 0) {
    const { error, data: insData } = await sb.from('global_products').insert(toInsert).select()
    if (error) {
      console.log(`    Batch insert error: ${error.code} ${error.message.substring(0,100)}`)
      for (const p of toInsert) {
        const { error: e2 } = await sb.from('global_products').insert(p)
        if (e2) { console.log(`    Single insert fail [${p.ean}]: ${e2.message.substring(0,80)}`); failed++ } else { inserted++ }
      }
    } else {
      inserted = insData ? insData.length : toInsert.length
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

  console.log('════════════════════════════════════════════════')
  console.log('KORZINAVDOM PARSER v2 — Параллельный')
  console.log('════════════════════════════════════════════════')
  console.log(`Dry run:  ${opts.dryRun}`)
  console.log(`Limit:    ${opts.limit || 'none'}`)
  console.log(`Skip R2:  ${opts.skipR2}`)
  console.log(`Resume:   ${opts.resume}`)
  console.log(`Concurrency: ${CONCURRENCY}, DB batch: ${DB_BATCH}`)
  console.log()

  const categories = opts.categories
    ? ALL_CATEGORIES.filter(c => opts.categories.includes(c.number))
    : ALL_CATEGORIES

  console.log(`Categories: ${categories.length}`)
  categories.forEach(c => console.log(`  #${c.number} ${c.name}`))
  console.log()

  const progress = loadProgress()
  const processedCats = new Set(progress.processedCategories || [])

  let totalDiscovered = 0
  let totalInserted = 0
  let totalUpdated = 0
  let totalSkipped = 0
  let totalFailed = 0
  let totalWithComp = 0
  let totalWithNutr = 0

  const t0 = Date.now()

  for (let ci = 0; ci < categories.length; ci++) {
    const cat = categories[ci]

    if (opts.resume && processedCats.has(cat.number)) {
      console.log(`  [${ci + 1}/${categories.length}] #${cat.number} ${cat.name} — SKIP (resume)`)
      continue
    }

    console.log(`\n── [${ci + 1}/${categories.length}] #${cat.number} ${cat.name} ──`)

    const listItems = await fetchAllListItems(cat.number)
    if (!listItems.length) { console.log('  Empty category'); continue }
    console.log(`  List: ${listItems.length} products`)

    const limitItems = opts.limit > 0 ? listItems.slice(0, opts.limit) : listItems
    totalDiscovered += limitItems.length

    console.log(`  Fetching details (${CONCURRENCY} parallel)...`)
    const details = await fetchDetailsParallel(limitItems)
    const validDetails = details.filter(Boolean)
    console.log(`  Details: ${validDetails.length}/${limitItems.length} OK`)

    const products = []
    for (let i = 0; i < limitItems.length; i++) {
      if (!details[i]) continue
      const p = mapToGlobalProduct(limitItems[i], details[i])
      p.data_quality_score = calcQualityScore(p)
      products.push(p)
      if (p.ingredients_raw) totalWithComp++
      if (p.nutriments_json) totalWithNutr++
    }

    if (opts.dryRun) {
      console.log(`  DRY RUN: ${products.length} products would be inserted`)
      products.slice(0, 3).forEach(p => {
        console.log(`    "${p.name}" comp=${!!p.ingredients_raw} nutr=${!!p.nutriments_json} brand=${p.brand}`)
      })
      totalInserted += products.length
      continue
    }

    let catInserted = 0, catUpdated = 0, catFailed = 0
    for (let i = 0; i < products.length; i += DB_BATCH) {
      const batch = products.slice(i, i + DB_BATCH)
      const result = await batchUpsert(sb, batch)
      catInserted += result.inserted
      catUpdated += result.updated
      catFailed += result.failed
    }

    console.log(`  DB: +${catInserted} new, ~${catUpdated} upd, ${catFailed} fail (comp: ${products.filter(p=>p.ingredients_raw).length}, nutr: ${products.filter(p=>p.nutriments_json).length})`)
    totalInserted += catInserted
    totalUpdated += catUpdated
    totalFailed += catFailed

    processedCats.add(cat.number)
    progress.processedCategories = [...processedCats]
    progress.productCount = totalDiscovered
    saveProgress(progress)

    if (opts.limit > 0 && totalDiscovered >= opts.limit) break
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  console.log('\n════════════════════════════════════════════════')
  console.log('  SUMMARY')
  console.log('════════════════════════════════════════════════')
  console.log(`  Discovered:    ${totalDiscovered}`)
  console.log(`  Inserted:      ${totalInserted}`)
  console.log(`  Updated:       ${totalUpdated}`)
  console.log(`  Failed:        ${totalFailed}`)
  console.log(`  With composition: ${totalWithComp}`)
  console.log(`  With nutriments:  ${totalWithNutr}`)
  console.log(`  Time:          ${elapsed}s`)
  console.log(`  Mode:          ${opts.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('════════════════════════════════════════════════')

  if (!opts.skipR2 && !opts.dryRun && totalInserted > 0) {
    console.log('\nR2 upload: run separately with migrate-images-to-r2.mjs')
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
