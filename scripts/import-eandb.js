/**
 * KORSET — Import products from EAN-DB API
 * Usage (PowerShell):
 *   $env:EANDB_API_KEY="your_jwt"; $env:SUPABASE_SERVICE_KEY="your_key"; node scripts/import-eandb.js
 * 
 * Options:
 *   --ean=4870000000001     Import single EAN
 *   --file=eans.txt         Import EANs from text file (one per line)
 *   --popular               Import popular food/beverage EANs (built-in list)
 *   --dry-run               Don't write to Supabase, just show what would be imported
 */

const EANDB_API_KEY      = process.env.EANDB_API_KEY
const SUPABASE_URL       = 'https://tcvuffoxwavqdexrzwjj.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const EANDB_API = 'https://ean-db.com/api/v2/product'

const POPULAR_EANS = [
  '5449000000996','5449000054227','5449000131805','5449000014740','5449000054241',
  '4002359010538','5449000054036',
  '7613035351608','7613287044433','7613036101639','7613032910150','5900951254006',
  '7613033555817','8593893738045',
  '5000159461422','5000159407236','5000159064996','5000159461704','5000159368834',
  '5000159461729',
  '7622210449283','7622210451439','7622210452511','7622300441937','7622300489984',
  '7622210647566',
  '3017620422003','3017620425035','8000500310427','8000500205228','8000500014226',
  '8000500037256',
  '5053990101536','5053990105756','5053827281083','5053990144748','5053827144808',
  '8718114916002','8718114990476','4008167014201','8711000501169',
  '5900497120115','7613036897396','4006359001065',
  '4015000011754','3033490004743','3033710065967','5411188100447','5411188119180',
  '5053827198208','5059319013090','7613035683679','5900017023083',
  '8715700043449','8715700110134','8715700100159',
  '3033710069279','7613034626974',
  '5000159484695',
  '4005808220007','4005808220014',
  '4600494000633','4607025392408',
  '4607025392200',
  '8710398518058','8710398518348',
  '5903277001168','5903277001236',
  '4600674002127','4600674002196',
  '4690228010737',
  '4820024710015','4820024710107',
  '4810192000016','4810192000023',
  '4870000000010','4870000000027','4870000000034','4870000000041','4870000000058',
  '4870018000010','4870018000027','4870018000034','4870018000041','4870018000058',
]

function extractIngredients(metadata) {
  if (!metadata?.generic?.ingredients) return null
  const groups = metadata.generic.ingredients
  const parts = []
  for (const group of groups) {
    const names = (group.ingredientsGroup || []).map((ing) => {
      const orig = ing.originalNames
      const ru = orig?.ru || orig?.en || orig?.de || ''
      if (ing.subIngredients) {
        const subs = ing.subIngredients.map((s) =>
          s.canonicalNames?.ru || s.canonicalNames?.en || s.id || ''
        ).filter(Boolean).join(', ')
        return ru + (subs ? ` (${subs})` : '')
      }
      return ru
    }).filter(Boolean)
    const groupName = group.groupName
    if (groupName && names.length) parts.push(`${groupName}: ${names.join(', ')}`)
    else if (names.length) parts.push(names.join(', '))
  }
  return parts.join('; ') || null
}

function extractAdditives(metadata) {
  if (!metadata?.generic?.ingredients) return []
  const additives = new Set()
  for (const group of metadata.generic.ingredients) {
    for (const ing of (group.ingredientsGroup || [])) {
      if (ing.id && /^e\d{3,4}/i.test(ing.id)) additives.add(ing.id.toUpperCase())
      if (ing.subIngredients) {
        for (const sub of ing.subIngredients) {
          if (sub.id && /^e\d{3,4}/i.test(sub.id)) additives.add(sub.id.toUpperCase())
        }
      }
    }
  }
  return [...additives]
}

function extractAllergens(metadata, ingredientsRaw) {
  const allergens = new Set()
  // Canonical IDs из src/constants/allergens.js (ТР ТС 022/2011).
  // ДО 2026-04-28 здесь было: shellfish, nuts (legacy) → теперь crustaceans, tree_nuts.
  // coconut технически не tree_nut по FDA, но по факту покупатели с орех-аллергией
  // часто его избегают; оставлен в tree_nuts для безопасности.
  const ALLERGEN_IDS = {
    milk: 'milk', lactose: 'milk',
    eggs: 'eggs',
    wheat: 'gluten', gluten: 'gluten',
    peanuts: 'peanuts',
    nuts: 'tree_nuts', 'tree-nuts': 'tree_nuts', coconut: 'tree_nuts',
    soy: 'soy',
    fish: 'fish',
    shellfish: 'crustaceans', crustaceans: 'crustaceans',
    molluscs: 'mollusks', mollusks: 'mollusks',
    sesame: 'sesame', 'sesame-seeds': 'sesame',
    celery: 'celery',
    mustard: 'mustard',
    lupin: 'lupin',
    sulphites: 'sulfites', sulfites: 'sulfites',
  }
  if (metadata?.generic?.ingredients) {
    for (const group of metadata.generic.ingredients) {
      for (const ing of (group.ingredientsGroup || [])) {
        const props = ing.properties || {}
        const contains = Array.isArray(props.contains) ? props.contains : [props.contains]
        for (const c of contains) {
          if (ALLERGEN_IDS[c]) allergens.add(ALLERGEN_IDS[c])
        }
        if (ing.isVegan === false && ing.id === 'milk') allergens.add('milk')
      }
    }
  }
  const text = (ingredientsRaw || '').toLowerCase()
  if (text.includes('молок') || text.includes('молочн') || text.includes('сливк')) allergens.add('milk')
  if (text.includes('глютен') || text.includes('пшенич') || text.includes('мука пшен')) allergens.add('gluten')
  if (text.includes('арахис')) allergens.add('peanuts')
  if (text.includes('соя') || text.includes('соев')) allergens.add('soy')
  return [...allergens]
}

function extractDietTags(metadata, ingredientsRaw) {
  const tags = new Set()
  const text = (ingredientsRaw || '').toLowerCase()
  let hasNonVegan = false
  let hasNonVegetarian = false
  if (metadata?.generic?.ingredients) {
    for (const group of metadata.generic.ingredients) {
      for (const ing of (group.ingredientsGroup || [])) {
        if (ing.isVegan === false) hasNonVegan = true
        if (ing.isVegetarian === false) hasNonVegetarian = true
      }
    }
  }
  if (!hasNonVegan && !hasNonVegetarian && text) tags.add('vegan')
  else if (!hasNonVegetarian && text) tags.add('vegetarian')
  if (text.includes('халал') || text.includes('halal')) tags.add('halal')
  return [...tags]
}

function extractNutriments(metadata) {
  const n = metadata?.food?.nutrimentsPer100Grams
  if (!n) return {}
  const get = (obj) => obj?.equals?.value ? Number(obj.equals.value) : null
  const sodium = get(n.sodium)
  const salt = sodium != null ? sodium / 400 : null
  return {
    kcal:          get(n.energy) ? Math.round(get(n.energy)) : null,
    protein:       get(n.proteins),
    fat:           get(n.fat),
    carbs:         get(n.carbohydrates),
    sugar:         get(n.sugars) ?? get(n.sugar),
    fiber:         get(n.fiber),
    salt:          get(n.salt) ?? salt,
    saturatedFat:  get(n.saturatedFat),
    alcohol:       get(n.alcohol),
  }
}

function extractNutriscore(metadata) {
  const grade = metadata?.food?.nutriScore?.grade
  if (!grade) return null
  return grade.toUpperCase()
}

function extractCategory(categories) {
  if (!categories?.length) return null
  const foodCats = categories.filter(c => {
    const id = Number(c.id)
    return id >= 1400 && id <= 5500
  })
  if (!foodCats.length) return null
  const title = foodCats[0].titles?.en || foodCats[0].titles?.ru || null
  return title
}

function normalizeEanDbProduct(ean, data) {
  const p = data.product
  if (!p) return null

  const title = p.titles?.ru || p.titles?.en || p.titles?.de || null
  if (!title) return null

  const ingredientsRaw = extractIngredients(p.metadata)
  const additives = extractAdditives(p.metadata)
  const allergens = extractAllergens(p.metadata, ingredientsRaw)
  const dietTags = extractDietTags(p.metadata, ingredientsRaw)
  const nutriments = extractNutriments(p.metadata)
  const nutriscore = extractNutriscore(p.metadata)
  const category = extractCategory(p.categories)
  const manufacturerName = p.manufacturer?.titles?.en || p.manufacturer?.titles?.ru || null
  const country = p.barcodeDetails?.country || null
  const imageUrl = p.images?.find(i => i.isCatalog)?.url || p.images?.[0]?.url || null
  const weight = p.metadata?.generic?.weight?.unknown?.equals?.value
    ? `${p.metadata.generic.weight.unknown.equals.value} ${p.metadata.generic.weight.unknown.equals.unit}`
    : null

  let score = 0
  if (title.length > 2) score += 15
  if (ingredientsRaw && ingredientsRaw.length > 10) score += 25
  if (nutriments.kcal !== null) score += 15
  if (allergens.length > 0) score += 15
  if (additives.length > 0) score += 5
  if (imageUrl) score += 10
  if (nutriscore) score += 5
  if (manufacturerName) score += 5
  if (category) score += 5
  score = Math.min(score, 100)

  return {
    ean,
    name:               title,
    brand:               manufacturerName,
    category:            category || 'grocery',
    quantity:            weight,
    image_url:           imageUrl,
    ingredients_raw:     ingredientsRaw,
    allergens_json:      JSON.stringify(allergens),
    diet_tags_json:      JSON.stringify(dietTags),
    additives_tags_json: JSON.stringify(additives),
    nutriments_json:     JSON.stringify(nutriments),
    halal_status:        dietTags.includes('halal') ? 'yes' : 'unknown',
    nutriscore:          nutriscore,
    nova_group:          null,
    data_quality_score:  score,
    source_primary:      'eandb',
    source_confidence:   80,
    needs_review:        score < 60,
    is_verified:         false,
    manufacturer:        manufacturerName,
    country_of_origin:   country,
  }
}

async function fetchEanDb(ean) {
  try {
    const res = await fetch(`${EANDB_API}/${ean}`, {
      headers: {
        'Authorization': `Bearer ${EANDB_API_KEY}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (res.status === 404) return { found: false, balance: null }
    if (res.status === 403) {
      const body = await res.text()
      throw new Error(`403: ${body}`)
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    return { found: true, data: json, balance: json.balance }
  } catch (e) {
    if (e.name === 'TimeoutError') return { found: false, error: 'timeout' }
    return { found: false, error: e.message }
  }
}

async function upsertProduct(product) {
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
  if (!res.ok) throw new Error(await res.text())
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

function parseArgs() {
  const args = { mode: 'popular', eans: [] }
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--ean=')) { args.mode = 'single'; args.eans.push(arg.slice(6)) }
    else if (arg.startsWith('--file=')) { args.mode = 'file'; args.file = arg.slice(7) }
    else if (arg === '--popular') { args.mode = 'popular' }
    else if (arg === '--dry-run') { args.dryRun = true }
  }
  return args
}

async function main() {
  if (!EANDB_API_KEY) {
    console.error('Missing EANDB_API_KEY')
    console.error('  $env:EANDB_API_KEY="jwt"; $env:SUPABASE_SERVICE_KEY="key"; node scripts/import-eandb.js')
    process.exit(1)
  }
  if (!SUPABASE_SERVICE_KEY && !parseArgs().dryRun) {
    console.error('Missing SUPABASE_SERVICE_KEY')
    process.exit(1)
  }

  const args = parseArgs()
  let eans = []

  if (args.mode === 'single') {
    eans = args.eans
  } else if (args.mode === 'file') {
    const fs = await import('fs')
    eans = fs.readFileSync(args.file, 'utf8')
      .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  } else {
    eans = POPULAR_EANS
  }

  console.log(`EAN-DB Import: ${eans.length} EANs to check${args.dryRun ? ' (DRY RUN)' : ''}\n`)

  let success = 0, skipped = 0, failed = 0, balance = null
  const imported = []

  for (let i = 0; i < eans.length; i++) {
    const ean = eans[i]
    process.stdout.write(`[${i + 1}/${eans.length}] ${ean} -> `)

    const result = await fetchEanDb(ean)

    if (result.balance != null) balance = result.balance

    if (!result.found) {
      if (result.error) console.log(`ERR: ${result.error}`)
      else console.log('not found')
      skipped++
      await sleep(200)
      continue
    }

    const product = normalizeEanDbProduct(ean, result.data)
    if (!product) {
      console.log('no title, skipping')
      skipped++
      await sleep(200)
      continue
    }

    if (args.dryRun) {
      console.log(`${product.name} | Q:${product.data_quality_score} | ${product.brand || '-'}`)
      imported.push(product)
    } else {
      try {
        await upsertProduct(product)
        console.log(`${product.name} | Q:${product.data_quality_score} | ${product.brand || '-'}`)
        imported.push(product)
        success++
      } catch (e) {
        console.log(`DB ERR: ${e.message}`)
        failed++
      }
    }

    if (balance !== null && balance <= 10) {
      console.log(`\nWARNING: Balance low (${balance} remaining). Stopping.`)
      break
    }

    await sleep(250)
  }

  console.log(`\n========================================`)
  console.log(`Imported:  ${args.dryRun ? imported.length : success}`)
  console.log(`Not found: ${skipped}`)
  console.log(`Errors:    ${failed}`)
  console.log(`Balance:   ${balance}`)
  console.log(`========================================`)

  const withIngredients = imported.filter(p => p.ingredients_raw)
  const withNutriments = imported.filter(p => {
    try {
      const n = JSON.parse(p.nutriments_json || '{}')
      return n.kcal != null
    } catch { return false }
  })
  console.log(`With ingredients: ${withIngredients.length}/${imported.length}`)
  console.log(`With nutriments:  ${withNutriments}/${imported.length}`)
}

main()
