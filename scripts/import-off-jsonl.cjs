/**
 * KORSET — Stream OFF JSONL dump, filter for KZ/CIS products, import to Supabase
 * Downloads the full OFF JSONL dump and filters on the fly.
 * Usage (PowerShell):
 *   $env:SUPABASE_SERVICE_KEY="key"; node scripts/import-off-jsonl.cjs
 *
 * Options:
 *   --dry-run      Don't write to Supabase, just count matches
 *   --limit=N      Stop after N matches (default 2000)
 *   --all          No limit (import ALL matching products)
 */

const https = require('https')
const zlib = require('zlib')

const SUPABASE_URL       = 'https://tcvuffoxwavqdexrzwjj.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const JSONL_URL = 'https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz'

const VALID_NUTRISCORE = new Set(['A','B','C','D','E'])
const VALID_HALAL = new Set(['yes','no','unknown'])
const VALID_NOVA = new Set([1,2,3,4])
const VALID_SOURCE = new Set(['manual','openfoodfacts','store_import','ai_enriched','eandb','kz_verified','kaspi','halal_damu'])

const TARGET_BRANDS = [
  'coca-cola','pepsi','fanta','sprite','schweppes',
  'mars','snickers','twix','bounty','milky way','m&ms',
  'kitkat','nescafe','nesquik','nestle',
  'milka','oreo','barni','cadbury','toblerone',
  'nutella','kinder','ferrero','raffaello',
  'lays','pringles','doritos','cheetos',
  'lipton','greenfield','tess','ahmad',
  'jacobs','bonjour','jardin','carte noire',
  'danone','activia','prostokvashino','vesely molochnik',
  'alpro','valio','president','hochland','viola',
  'heinz','hellmanns','calve','maggi',
  'kelloggs','cheerios',
  'red bull','monster','burn','adrenaline rush',
  'rahat','bayan sulu','biena','piala','leov',
  'tassay','asem','kaiyt','raimbek',
  'foodmaster','campina','unimilk','wimm-bill-dann',
  'dobry','adrenaline','yashkino','rossiya',
  'makfa','galya-gourmet','sloboda',
]

// Источник истины: src/constants/allergens.js (ТР ТС 022/2011 canonical IDs).
// Этот файл — .cjs, не может import ES module, поэтому копия.
// ДО фикса (2026-04-28) здесь были legacy IDs и разные формы: 'nuts'/'shellfish'/'molluscs'/'sulphites'.
const ALLERGEN_MAP = {
  'en:milk':'milk',
  'en:eggs':'eggs',
  'en:gluten':'gluten','en:wheat':'gluten',
  'en:peanuts':'peanuts',
  'en:nuts':'tree_nuts','en:tree-nuts':'tree_nuts',
  'en:soybeans':'soy','en:soy':'soy',
  'en:fish':'fish',
  'en:crustaceans':'crustaceans','en:shellfish':'crustaceans',
  'en:molluscs':'mollusks','en:molluscs-and-products-thereof':'mollusks',
  'en:sesame':'sesame','en:sesame-seeds':'sesame',
  'en:celery':'celery',
  'en:mustard':'mustard',
  'en:lupin':'lupin',
  'en:sulphur-dioxide-and-sulphites':'sulfites','en:sulphites':'sulfites',
}

function shouldInclude(p) {
  const ean = p.code
  if (!ean || String(ean).length < 8) return false

  const name = (p.product_name_ru || p.product_name || p.product_name_en || '').trim()
  if (!name || name.length < 2) return false

  const countries = p.countries_tags || []
  if (countries.some(c => c.includes('kazakhstan'))) return true
  if (p.product_name_ru && p.product_name_ru.trim().length > 2) return true
  if (p.ingredients_text_ru && p.ingredients_text_ru.trim().length > 10) return true

  const brandsLower = (p.brands || '').toLowerCase()
  if (!TARGET_BRANDS.some(b => brandsLower.includes(b))) return false

  const ingredients = p.ingredients_text || p.ingredients_text_ru || p.ingredients_text_en || ''
  const n = p.nutriments || {}
  const hasNutriments = n['energy-kcal_100g'] != null || n.proteins_100g != null
  if (!ingredients && !hasNutriments && !p.image_front_url) return false

  return true
}

function sanitizeEan(raw) {
  const ean = String(raw).trim()
  if (ean.length < 8 || ean.length > 30) return null
  if (!/^[\d]+$/.test(ean)) return null
  return ean
}

function sanitizeNutriscore(val) {
  if (!val) return null
  const ch = String(val).toUpperCase().charAt(0)
  return VALID_NUTRISCORE.has(ch) ? ch : null
}

function sanitizeHalalStatus(p) {
  const labels = p.labels_tags || []
  if (labels.some(l => /halal/i.test(l))) return 'yes'
  const ingredients = (p.ingredients_text || p.ingredients_text_ru || '').toLowerCase()
  if (ingredients.includes('свинин') || ingredients.includes('pork') || ingredients.includes('gelatine') || ingredients.includes('желатин')) return 'no'
  const n = p.nutriments || {}
  if (n.alcohol_100g != null && Number(n.alcohol_100g) > 0.5) return 'no'
  return 'unknown'
}

function sanitizeNovaGroup(val) {
  const n = Number(val)
  return VALID_NOVA.has(n) ? n : null
}

function sanitizeSmallint(val, min, max) {
  const n = Number(val)
  if (isNaN(n)) return null
  return Math.max(min, Math.min(max, Math.round(n)))
}

function sanitizeJsonArray(val) {
  if (!val) return '[]'
  if (Array.isArray(val)) return JSON.stringify(val)
  if (typeof val === 'string') {
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? JSON.stringify(parsed) : '[]' }
    catch { return '[]' }
  }
  return '[]'
}

function sanitizeJsonObject(val) {
  if (!val) return '{}'
  if (typeof val === 'object' && !Array.isArray(val)) return JSON.stringify(val)
  if (typeof val === 'string') {
    try { const parsed = JSON.parse(val); return typeof parsed === 'object' && !Array.isArray(parsed) ? JSON.stringify(parsed) : '{}' }
    catch { return '{}' }
  }
  return '{}'
}

function sanitizeText(val) {
  if (!val) return null
  const s = String(val).trim()
  return s.length > 0 ? s.substring(0, 1000) : null
}

function sanitizeUrl(val) {
  if (!val) return null
  const s = String(val).trim()
  if (!s.startsWith('http')) return null
  return s.substring(0, 500)
}

function normalizeProduct(p) {
  const ean = sanitizeEan(p.code)
  if (!ean) return null

  const name = (p.product_name_ru || p.product_name || p.product_name_en || '').trim()
  if (!name || name.length < 2) return null

  const allergens = [...new Set(
    (p.allergens_tags || []).map(a => ALLERGEN_MAP[a]).filter(Boolean)
  )]
  const traces = [...new Set(
    (p.traces_tags || []).map(a => ALLERGEN_MAP[a]).filter(Boolean)
  )]
  const labels = p.labels_tags || []
  const dietTags = []
  if (labels.some(l => /vegan/i.test(l))) dietTags.push('vegan')
  if (labels.some(l => /vegetarian/i.test(l))) dietTags.push('vegetarian')
  if (labels.some(l => /halal/i.test(l))) dietTags.push('halal')
  if (labels.some(l => /gluten.free/i.test(l))) dietTags.push('gluten_free')
  const additives = (p.additives_tags || []).map(t => t.replace(/^en:/, '').toUpperCase())
  const categories = p.categories_tags || []
  const halalStatus = sanitizeHalalStatus(p)

  const n = p.nutriments || {}
  const nutriments = {
    kcal:          n['energy-kcal_100g'] != null ? Number(n['energy-kcal_100g']) : null,
    protein:       n.proteins_100g != null ? Number(n.proteins_100g) : null,
    fat:           n.fat_100g != null ? Number(n.fat_100g) : null,
    saturatedFat:  n['saturated-fat_100g'] != null ? Number(n['saturated-fat_100g']) : null,
    carbs:         n.carbohydrates_100g != null ? Number(n.carbohydrates_100g) : null,
    sugar:         n.sugars_100g != null ? Number(n.sugars_100g) : null,
    fiber:         n.fiber_100g != null ? Number(n.fiber_100g) : null,
    salt:          n.salt_100g != null ? Number(n.salt_100g) : null,
    alcohol:       n.alcohol_100g != null ? Number(n.alcohol_100g) : null,
  }

  let score = 0
  if (name.length > 2) score += 15
  const ingredients = p.ingredients_text_ru || p.ingredients_text || p.ingredients_text_en || ''
  if (ingredients.length > 10) score += 25
  if (nutriments.kcal !== null && !isNaN(nutriments.kcal)) score += 15
  if (allergens.length > 0) score += 10
  if (traces.length > 0) score += 5
  if (additives.length > 0) score += 5
  if (p.image_front_url) score += 10
  if (p.nutriscore_grade) score += 5
  if (p.brands) score += 5
  if (categories.length > 0) score += 5
  score = Math.min(score, 100)

  const country = p.countries_tags?.find(c => c.includes('kazakhstan')) ? 'kz' : null

  return {
    ean,
    name,
    brand:               sanitizeText((p.brands || '').split(',')[0].trim()),
    category:            sanitizeText(categories[0]?.replace('en:', '')) || 'grocery',
    quantity:            sanitizeText(p.quantity),
    image_url:           sanitizeUrl(p.image_front_url),
    ingredients_raw:     sanitizeText(ingredients) || null,
    allergens_json:      sanitizeJsonArray(allergens),
    diet_tags_json:      sanitizeJsonArray(dietTags),
    additives_tags_json: sanitizeJsonArray(additives),
    traces_json:         sanitizeJsonArray(traces),
    categories_tags_json: sanitizeJsonArray(categories),
    nutriments_json:     sanitizeJsonObject(nutriments),
    halal_status:        halalStatus,
    nutriscore:          sanitizeNutriscore(p.nutriscore_grade),
    nova_group:          sanitizeNovaGroup(p.nova_group),
    image_ingredients_url: sanitizeUrl(p.image_ingredients_url),
    image_nutrition_url: sanitizeUrl(p.image_nutrition_url),
    data_quality_score:  sanitizeSmallint(score, 0, 100),
    source_primary:      'openfoodfacts',
    source_confidence:   60,
    needs_review:        score < 60,
    is_verified:         false,
    manufacturer:        sanitizeText((p.brands || '').split(',').map(b => b.trim())[0]),
    country_of_origin:   sanitizeText(country),
    name_kz:             sanitizeText(p.product_name_ru),
    ingredients_kz:      sanitizeText(p.ingredients_text_ru),
    is_active:           true,
  }
}

async function upsertOne(product) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/global_products?on_conflict=ean`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer':        'resolution=merge-duplicates',
    },
    body: JSON.stringify(product),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err.substring(0, 200))
  }
}

function downloadWithRedirect(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    function doRequest(targetUrl, redirects) {
      https.get(targetUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          if (redirects <= 0) return reject(new Error('Too many redirects'))
          response.resume()
          doRequest(response.headers.location, redirects - 1)
        } else if (response.statusCode !== 200) {
          response.resume()
          reject(new Error(`HTTP ${response.statusCode}`))
        } else {
          resolve(response)
        }
      }).on('error', reject)
    }
    doRequest(url, maxRedirects)
  })
}

function parseArgs() {
  const args = process.argv.slice(2)
  const result = { dryRun: false, limit: 2000 }
  for (const arg of args) {
    if (arg === '--dry-run') result.dryRun = true
    else if (arg === '--all') result.limit = Infinity
    else if (arg.startsWith('--limit=')) result.limit = Number(arg.split('=')[1])
  }
  return result
}

async function main() {
  const opts = parseArgs()

  if (!SUPABASE_SERVICE_KEY && !opts.dryRun) {
    console.error('Missing SUPABASE_SERVICE_KEY')
    process.exit(1)
  }

  console.log(`OFF JSONL Import${opts.dryRun ? ' (DRY RUN)' : ''} | Limit: ${opts.limit === Infinity ? 'ALL' : opts.limit}`)
  console.log(`Downloading ${JSONL_URL}...\n`)

  let totalLines = 0, matched = 0, imported = 0, failed = 0
  const seenEans = new Set()
  const pending = []
  const MAX_CONCURRENT = 5
  let activeInserts = 0
  let lastLog = Date.now()

  let response
  try {
    response = await downloadWithRedirect(JSONL_URL)
  } catch (e) { console.error('Download failed:', e.message); process.exit(1) }

  const totalBytes = Number(response.headers['content-length'] || 0)
  let downloadedBytes = 0
  let lastProgressLog = Date.now()

  const gunzip = zlib.createGunzip()
  let buffer = ''

  response.on('data', (chunk) => {
    downloadedBytes += chunk.length
    if (totalBytes && Date.now() - lastProgressLog > 10000) {
      const pct = ((downloadedBytes / totalBytes) * 100).toFixed(1)
      process.stdout.write(`\r[DL: ${pct}%] Lines: ${totalLines.toLocaleString()}, Matched: ${matched}, OK: ${imported}, Err: ${failed}`)
      lastProgressLog = Date.now()
    }
  })

  const drainQueue = () => {
    while (pending.length > 0 && activeInserts < MAX_CONCURRENT) {
      const product = pending.shift()
      activeInserts++
      upsertOne(product)
        .then(() => { imported++; activeInserts--; drainQueue() })
        .catch((e) => {
          failed++
          activeInserts--
          if (failed <= 10) console.log(`  ERR ${product.ean}: ${e.message.substring(0, 120)}`)
          drainQueue()
        })
    }
  }

  const streamDone = new Promise((resolve, reject) => {
    response.pipe(gunzip)

    gunzip.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        totalLines++

        try {
          const p = JSON.parse(line)
          if (!shouldInclude(p)) continue

          const ean = sanitizeEan(p.code)
          if (!ean || seenEans.has(ean)) continue
          seenEans.add(ean)

          const product = normalizeProduct(p)
          if (!product) continue

          matched++

          if (opts.dryRun) {
            if (matched <= 30) {
              console.log(`  ${ean} | ${product.brand || '-'} | ${product.name.substring(0, 40)} | Q:${product.data_quality_score} | H:${product.halal_status} | N:${product.nutriscore || '-'}`)
            }
          } else {
            pending.push(product)
            drainQueue()
          }

          if (matched >= opts.limit) {
            gunzip.destroy()
            response.destroy()
            resolve()
            return
          }
        } catch {
          // skip malformed JSON lines
        }

        if (Date.now() - lastLog > 5000) {
          process.stdout.write(`\r[Scan] Lines: ${totalLines.toLocaleString()}, Matched: ${matched}, OK: ${imported}, Err: ${failed}, Queue: ${pending.length}`)
          lastLog = Date.now()
        }
      }
    })

    gunzip.on('end', () => {
      if (buffer.trim()) {
        try {
          const p = JSON.parse(buffer)
          if (shouldInclude(p) && !seenEans.has(sanitizeEan(p.code))) {
            const product = normalizeProduct(p)
            if (product) {
              matched++
              if (!opts.dryRun) { pending.push(product); drainQueue() }
            }
          }
        } catch { /* skip */ }
      }
      resolve()
    })

    gunzip.on('error', reject)
    response.on('error', reject)
  })

  await streamDone

  while (activeInserts > 0 || pending.length > 0) {
    drainQueue()
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\n\n========================================`)
  console.log(`Lines scanned:  ${totalLines.toLocaleString()}`)
  console.log(`Matched filter: ${matched}`)
  console.log(`Imported:       ${opts.dryRun ? 'N/A (dry run)' : imported}`)
  console.log(`Failed:         ${failed}`)
  console.log(`========================================`)
}

main()
