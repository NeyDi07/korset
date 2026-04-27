import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const WEIGHT_UNITS = ['г', 'гр', 'кг', 'грамм', 'килограмм', 'g', 'kg']
const VOLUME_UNITS = ['мл', 'л', 'миллилитр', 'литр', 'ml', 'l', 'L']
const PIECES_UNITS = ['шт', 'дана', 'данасы', 'пак', 'саше', 'таблеток', 'капсул', 'порций', 'пакетиков', 'pcs']

const UNIT_TYPE_MAP = {}
for (const u of WEIGHT_UNITS) UNIT_TYPE_MAP[u] = 'weight'
for (const u of VOLUME_UNITS) UNIT_TYPE_MAP[u] = 'volume'
for (const u of PIECES_UNITS) UNIT_TYPE_MAP[u] = 'pieces'

const CANONICAL_UNIT = {
  г: 'г', гр: 'г', кг: 'кг', грамм: 'г', килограмм: 'кг', g: 'г', kg: 'кг',
  мл: 'мл', л: 'л', миллилитр: 'мл', литр: 'л', ml: 'мл', l: 'л', L: 'л',
  шт: 'шт', дана: 'шт', данасы: 'шт', пак: 'пак', саше: 'саше',
  таблеток: 'таблеток', капсул: 'капсул', порций: 'порций',
  пакетиков: 'пакетиков', pcs: 'шт',
}

const UNIT_BOUNDARY = '(?![a-zA-Zа-яёА-ЯЁ0-9])'

const ALL_UNITS_RE =
  '(\\d+[.,]?\\d*)\\s*(килограмм|миллилитр|литр|грамм|данасы|таблеток|капсул|порций|пакетиков|кг|мл|гр|дана|пак|шт|саше|г|л|kg|ml|pcs|g|l|L)' + UNIT_BOUNDARY

const BARE_UNITS_RE = '(?:^|[\\s,;])(кг|л)\\s*$'

const PERCENT_RE = /\d+[.,]?\d*\s*%/g

const GARBAGE_QUANTITY = new Set(['вес', 'weight', 'весовой', '-'])

function parseQuantityTokens(text) {
  if (!text || typeof text !== 'string') return null

  let tail = text.slice(-60)
  tail = tail.replace(PERCENT_RE, ' ')

  const tokens = []
  const numRe = new RegExp(ALL_UNITS_RE, 'gi')
  let m
  while ((m = numRe.exec(tail)) !== null) {
    const rawNum = m[1].replace(',', '.')
    const num = Number(rawNum)
    if (!Number.isFinite(num) || num <= 0) continue
    const rawUnit = m[2].toLowerCase()
    const canonical = CANONICAL_UNIT[rawUnit]
    if (!canonical) continue
    const unitType = UNIT_TYPE_MAP[rawUnit]
    if (!unitType) continue
    const dup = tokens.some((t) => t.value === num && t.unit === canonical)
    if (!dup) tokens.push({ value: num, unit: canonical, unitType, isWeightByWeight: false })
  }

  if (tokens.length === 0) {
    const bareRe = new RegExp(BARE_UNITS_RE, 'i')
    const bareMatch = tail.match(bareRe)
    if (bareMatch) {
      const rawUnit = bareMatch[1].toLowerCase()
      const canonical = CANONICAL_UNIT[rawUnit]
      const unitType = UNIT_TYPE_MAP[rawUnit]
      if (canonical && unitType) {
        tokens.push({ value: null, unit: canonical, unitType, isWeightByWeight: true })
      }
    }
  }

  return tokens.length > 0 ? tokens : null
}

function formatQuantityFromTokens(tokens) {
  if (!tokens || tokens.length === 0) return null

  const wv = tokens.filter((t) => t.unitType === 'weight' || t.unitType === 'volume')
  const primary = wv.length > 1 ? wv[wv.length - 1] : (wv[0] || tokens[0])
  const pieces = tokens.find((t) => t.unitType === 'pieces' && t !== primary)

  if (primary.isWeightByWeight) return primary.unit

  const valueStr = primary.value != null ? String(primary.value).replace('.', ',') : ''
  let main = `${valueStr} ${primary.unit}`

  if (pieces) {
    const pStr = String(pieces.value).replace('.', ',')
    main += ` (${pStr} ${pieces.unit})`
  }

  return main
}

function shouldBackfill(quantity) {
  if (quantity === null || quantity === undefined) return true
  if (typeof quantity === 'string' && quantity.trim() === '') return true
  if (typeof quantity === 'string' && GARBAGE_QUANTITY.has(quantity.trim().toLowerCase())) return true
  return false
}

async function backfillQuantity(dryRun = true) {
  const label = dryRun ? '[DRY RUN]' : '[LIVE]'
  console.log(`\n${label} Backfill global_products.quantity from name\n`)

  const BATCH = 1000
  let offset = 0
  const allProducts = []

  console.log('Fetching products...')
  while (true) {
    const { data, error } = await supabase
      .from('global_products')
      .select('id, ean, name, name_kz, quantity, category')
      .eq('is_active', true)
      .range(offset, offset + BATCH - 1)

    if (error) {
      console.error('Fetch error:', error.message)
      process.exit(1)
    }
    if (!data || data.length === 0) break

    allProducts.push(...data)
    if (data.length < BATCH) break
    offset += BATCH
  }

  console.log(`Total active products: ${allProducts.length}`)

  const needsUpdate = allProducts.filter((p) => shouldBackfill(p.quantity))
  console.log(`Need backfill (null/empty/garbage quantity): ${needsUpdate.length}`)

  const alreadyHave = allProducts.filter((p) => !shouldBackfill(p.quantity))
  const garbageCount = allProducts.filter(
    (p) => p.quantity && GARBAGE_QUANTITY.has(p.quantity.trim().toLowerCase())
  ).length
  console.log(`Already have valid quantity: ${alreadyHave.length}`)
  console.log(`Garbage quantity values (вес/weight/-): ${garbageCount}`)

  if (needsUpdate.length === 0) {
    console.log('\nAll products already have quantity! Nothing to do.')
    return
  }

  const results = {
    parsed: [],
    parsedFromNameKz: [],
    weightByWeight: [],
    failed: [],
  }

  for (const p of needsUpdate) {
    let tokens = parseQuantityTokens(p.name)

    if (tokens) {
      const display = formatQuantityFromTokens(tokens)
      const primary = tokens.find((t) => t.unitType === 'weight' || t.unitType === 'volume') || tokens[0]
      if (primary.isWeightByWeight) {
        results.weightByWeight.push({ ...p, newQuantity: display })
      } else {
        results.parsed.push({ ...p, newQuantity: display, source: 'name' })
      }
      continue
    }

    if (p.name_kz) {
      tokens = parseQuantityTokens(p.name_kz)
      if (tokens) {
        const display = formatQuantityFromTokens(tokens)
        results.parsedFromNameKz.push({ ...p, newQuantity: display, source: 'nameKz' })
        continue
      }
    }

    results.failed.push(p)
  }

  const totalParsed = results.parsed.length + results.parsedFromNameKz.length + results.weightByWeight.length
  console.log(`\n--- PARSE RESULTS ---`)
  console.log(`  Parsed from name:       ${results.parsed.length}`)
  console.log(`  Parsed from name_kz:    ${results.parsedFromNameKz.length}`)
  console.log(`  Weight-by-weight (кг):  ${results.weightByWeight.length}`)
  console.log(`  Failed (no quantity):   ${results.failed.length}`)
  console.log(`  Total with new qty:     ${totalParsed}`)
  console.log(`  Coverage:              ${((totalParsed / needsUpdate.length) * 100).toFixed(1)}%`)

  if (results.parsed.length > 0) {
    console.log('\n--- SAMPLE FROM name ---')
    const sample = results.parsed.slice(0, 25)
    for (const r of sample) {
      console.log(`  ${r.ean}: "${r.name?.slice(0, 50)}" → quantity="${r.newQuantity}"`)
    }
    if (results.parsed.length > 25) {
      console.log(`  ... and ${results.parsed.length - 25} more`)
    }
  }

  if (results.parsedFromNameKz.length > 0) {
    console.log('\n--- SAMPLE FROM name_kz ---')
    const sample = results.parsedFromNameKz.slice(0, 10)
    for (const r of sample) {
      console.log(`  ${r.ean}: "${r.name?.slice(0, 40)}" / kz="${r.name_kz?.slice(0, 40)}" → "${r.newQuantity}"`)
    }
  }

  if (results.weightByWeight.length > 0) {
    console.log('\n--- WEIGHT-BY-WEIGHT ---')
    const sample = results.weightByWeight.slice(0, 10)
    for (const r of sample) {
      console.log(`  ${r.ean}: "${r.name?.slice(0, 50)}" → quantity="${r.newQuantity}"`)
    }
  }

  if (results.failed.length > 0 && results.failed.length <= 50) {
    console.log('\n--- FAILED (no quantity found) ---')
    for (const r of results.failed) {
      console.log(`  ${r.ean}: "${r.name?.slice(0, 60)}"`)
    }
  } else if (results.failed.length > 50) {
    console.log(`\n--- FAILED: ${results.failed.length} products (too many to list) ---`)
    const cats = {}
    for (const r of results.failed) {
      const c = r.category || 'null'
      cats[c] = (cats[c] || 0) + 1
    }
    console.log('  By category:')
    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1])
    for (const [cat, count] of sorted.slice(0, 10)) {
      console.log(`    ${cat}: ${count}`)
    }
  }

  if (dryRun) {
    console.log(`\n${label} Run with --live to apply ${totalParsed} updates.`)
    return { totalParsed, totalFailed: results.failed.length }
  }

  console.log(`\n--- APPLYING UPDATES ---`)
  let updated = 0
  let failed = 0

  const allUpdates = [
    ...results.parsed.map((r) => ({ id: r.id, ean: r.ean, quantity: r.newQuantity })),
    ...results.parsedFromNameKz.map((r) => ({ id: r.id, ean: r.ean, quantity: r.newQuantity })),
    ...results.weightByWeight.map((r) => ({ id: r.id, ean: r.ean, quantity: r.newQuantity })),
  ]

  for (let i = 0; i < allUpdates.length; i++) {
    const { id, ean, quantity } = allUpdates[i]
    const { error } = await supabase
      .from('global_products')
      .update({ quantity })
      .eq('id', id)

    if (error) {
      console.error(`  FAIL ${ean}: ${error.message}`)
      failed++
    } else {
      updated++
    }

    if ((i + 1) % 200 === 0) {
      console.log(`  Progress: ${i + 1}/${allUpdates.length} (${updated} ok, ${failed} fail)`)
    }
  }

  console.log(`\n${label} Backfill complete: ${updated} updated, ${failed} failed`)
  console.log(`  Products still without quantity: ${results.failed.length}`)

  return { updated, failed, stillEmpty: results.failed.length }
}

const live = process.argv.includes('--live')
backfillQuantity(!live)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
