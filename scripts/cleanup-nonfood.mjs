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

const NON_FOOD_KEYWORDS = [
  'сотейник', 'сковород', 'кастрюл', 'тарелка ', 'бокал', 'фужер',
  'микроволновая печь', 'микроволновк', 'печь ava', 'чайник ', 'кофеварк', 'блендер', 'мультивар',
  'утюг', 'пылесос', 'стиральн', 'телевизор', 'ноутбук',
  'колготк', 'сандали', 'обувь', 'куртк', 'рубашк', 'футболк', 'джинсы', 'пальто',
  'полотенце', 'шампунь', 'гель для душ', 'дезодорант', 'подгузник', 'прокладк',
  'вставка в паллет', 'штамп', 'набор для лица', 'маска для вол',
  'ковш для', 'доска разделочная',
  'кроссовк', 'тапочк',
  'губк', 'щетк', 'венчик', 'терк', 'скалк', 'шпатель',
  'порошок ariel', 'порошок persil', 'стиральный порошок',
]

const PET_FOOD_KEYWORDS = [
  'корм для собак', 'корм для кошек', 'влажный корм для', 'сухой корм для',
  'полнорац корм', 'корм д.собак', 'корм d.собак',
]

const GARBAGE_QUANTITY = new Set(['вес', 'weight', 'весовой', '-'])

function isNonFood(name) {
  if (!name) return false
  const n = name.toLowerCase()
  return NON_FOOD_KEYWORDS.some((k) => n.includes(k.toLowerCase()))
}

function isPetFood(name) {
  if (!name) return false
  const n = name.toLowerCase()
  return PET_FOOD_KEYWORDS.some((k) => n.includes(k.toLowerCase()))
}

function isFakeEan(ean) {
  return ean.startsWith('arbuz_') || ean.startsWith('kaspi_') || ean.startsWith('korzinavdom_')
}

function isGarbageQuantity(quantity) {
  if (!quantity) return false
  return GARBAGE_QUANTITY.has(quantity.trim().toLowerCase())
}

async function cleanup(dryRun = true) {
  const label = dryRun ? '[DRY RUN]' : '[LIVE]'
  console.log(`\n${label} Data quality cleanup\n`)

  const BATCH = 500
  let offset = 0
  const all = []
  while (true) {
    const { data, error } = await supabase
      .from('global_products')
      .select('id, ean, name, name_kz, brand, category, source_primary, quantity, is_active')
      .eq('is_active', true)
      .range(offset, offset + BATCH - 1)

    if (error) {
      console.error('Fetch error:', error.message)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < BATCH) break
    offset += BATCH
  }

  console.log(`Total active products: ${all.length}\n`)

  const toDeactivate = []

  for (const p of all) {
    const reasons = []

    if (isNonFood(p.name)) reasons.push('non_food')
    if (isPetFood(p.name)) reasons.push('pet_food')

    if (reasons.length > 0) {
      toDeactivate.push({ ...p, reasons })
    }
  }

  const nonFoodCount = toDeactivate.filter((p) => p.reasons.includes('non_food')).length
  const petFoodCount = toDeactivate.filter((p) => p.reasons.includes('pet_food')).length

  console.log('--- DEACTIVATION PLAN ---')
  console.log(`  Non-food products:    ${nonFoodCount}`)
  console.log(`  Pet food:             ${petFoodCount}`)
  console.log(`  Total to deactivate:  ${toDeactivate.length}`)
  console.log(`  Remaining after:      ${all.length - toDeactivate.length}`)
  console.log()

  if (toDeactivate.length > 0) {
    console.log('--- SAMPLES ---')
    const samples = toDeactivate.slice(0, 30)
    for (const p of samples) {
      const reason = p.reasons.join('+')
      console.log(`  [${reason.padEnd(12)}] ${p.ean.padEnd(15)} ${(p.name || '').slice(0, 50)}`)
    }
    if (toDeactivate.length > 30) {
      console.log(`  ... and ${toDeactivate.length - 30} more`)
    }
  }

  // Garbage quantity fix (separate — not deactivation, just cleanup)
  const garbageQty = all.filter((p) => isGarbageQuantity(p.quantity))
  console.log(`\n--- GARBAGE QUANTITY ("вес"/"weight"/"-") ---`)
  console.log(`  Count: ${garbageQty.length}`)
  console.log(`  Action: set quantity = null (these are weight-by-weight items)`)

  // Summary of what will happen
  console.log(`\n--- SUMMARY ---`)
  console.log(`  Deactivate (is_active=false): ${toDeactivate.length} products`)
  console.log(`  Fix garbage quantity:          ${garbageQty.length} products`)

  if (dryRun) {
    console.log(`\n${label} Run with --live to apply changes.`)
    return
  }

  // Apply deactivation
  console.log(`\n--- APPLYING DEACTIVATIONS ---`)
  let deactivated = 0
  let deactivateFailed = 0

  for (let i = 0; i < toDeactivate.length; i++) {
    const { error } = await supabase
      .from('global_products')
      .update({ is_active: false, needs_review: false })
      .eq('id', toDeactivate[i].id)

    if (error) {
      console.error(`  FAIL ${toDeactivate[i].ean}: ${error.message}`)
      deactivateFailed++
    } else {
      deactivated++
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  Progress: ${i + 1}/${toDeactivate.length}`)
    }
  }

  console.log(`  Deactivated: ${deactivated}, Failed: ${deactivateFailed}`)

  // Apply garbage quantity fix
  console.log(`\n--- FIXING GARBAGE QUANTITY ---`)
  let qtyFixed = 0
  let qtyFailed = 0

  for (const p of garbageQty) {
    const { error } = await supabase
      .from('global_products')
      .update({ quantity: null })
      .eq('id', p.id)

    if (error) {
      console.error(`  FAIL ${p.ean}: ${error.message}`)
      qtyFailed++
    } else {
      qtyFixed++
    }
  }

  console.log(`  Fixed: ${qtyFixed}, Failed: ${qtyFailed}`)

  // Also deactivate store_products linked to deactivated global_products
  console.log(`\n--- DEACTIVATING LINKED store_products ---`)
  const deactivatedEans = toDeactivate.map((p) => p.ean)
  let storeDeactivated = 0
  let storeFailed = 0

  for (let i = 0; i < deactivatedEans.length; i += 100) {
    const batch = deactivatedEans.slice(i, i + 100)
    const { error, count } = await supabase
      .from('store_products')
      .update({ is_active: false })
      .eq('is_active', true)
      .in('ean', batch)

    if (error) {
      console.error(`  Store products FAIL: ${error.message}`)
      storeFailed++
    } else {
      storeDeactivated++
    }
  }

  console.log(`  Store products batches updated: ${storeDeactivated}, Failed: ${storeFailed}`)

  console.log(`\n${label} Cleanup complete!`)
  console.log(`  Products remaining: ${all.length - deactivated}`)
}

const live = process.argv.includes('--live')
cleanup(!live)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
