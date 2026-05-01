import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { normalizeCategory, DEACTIVATE, CATEGORIES, GENERIC_CATEGORIES } from '../src/domain/product/categoryMap.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

const args = process.argv.slice(2)
let dryRun = true
let limit = null

for (const arg of args) {
  if (arg === '--live') dryRun = false
  if (arg.startsWith('--limit=')) limit = parseInt(arg.split('=')[1], 10)
}

async function fetchAll() {
  const batch = 1000
  let offset = 0
  let all = []
  while (true) {
    const { data, error } = await sb
      .from('global_products')
      .select('id, ean, name, brand, category, subcategory, source_primary, is_active')
      .eq('is_active', true)
      .range(offset, offset + batch - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < batch) break
    offset += batch
  }
  return all
}

async function main() {
  console.log('KORSET CATEGORY NORMALIZATION')
  console.log('='.repeat(60))
  console.log(dryRun ? 'DRY RUN — no writes' : 'LIVE — will update database')
  if (limit) console.log(`Limit: ${limit} products`)
  console.log()

  const products = await fetchAll()
  const total = limit ? Math.min(products.length, limit) : products.length
  console.log(`Loaded ${products.length} active products\n`)

  const stats = {
    total: 0,
    pass1_directMap: 0,
    pass2_subcategoryMap: 0,
    pass3_classifyByName: 0,
    pass4_fallbackGrocery: 0,
    deactivate: 0,
    unchanged: 0,
    byCategory: {},
    bySubcategory: {},
    deactivated: [],
    unclassified: [],
    changes: [],
  }

  for (let i = 0; i < total; i++) {
    const p = products[i]
    stats.total++

    const result = normalizeCategory(p.category, p.subcategory, p.name, p.brand)

    if (result.category === DEACTIVATE) {
      stats.deactivate++
      stats.deactivated.push({ id: p.id, ean: p.ean, name: p.name, brand: p.brand, oldCategory: p.category })
      continue
    }

    const newCat = result.category
    const newSub = result.subcategory || null
    const oldCat = p.category
    const oldSub = p.subcategory

    if (!stats.byCategory[newCat]) stats.byCategory[newCat] = 0
    stats.byCategory[newCat]++
    if (newSub) {
      if (!stats.bySubcategory[newSub]) stats.bySubcategory[newSub] = 0
      stats.bySubcategory[newSub]++
    }

    if (oldCat === newCat && oldSub === newSub) {
      stats.unchanged++
      continue
    }

    const change = {
      id: p.id,
      ean: p.ean,
      name: (p.name || '').slice(0, 60),
      oldCategory: oldCat,
      oldSubcategory: oldSub,
      newCategory: newCat,
      newSubcategory: newSub,
    }

    if (GENERIC_CATEGORIES.has(oldCat) && newCat !== 'grocery') {
      stats.pass3_classifyByName++
    } else if (newCat === 'grocery' && !newSub) {
      stats.pass4_fallbackGrocery++
      stats.unclassified.push(change)
    } else {
      stats.pass1_directMap++
    }

    stats.changes.push(change)
  }

  if (!dryRun && stats.changes.length > 0) {
    console.log(`Applying ${stats.changes.length} category updates...`)
    const groups = new Map()
    for (const c of stats.changes) {
      const key = `${c.newCategory}||${c.newSubcategory || ''}`
      if (!groups.has(key)) groups.set(key, { category: c.newCategory, subcategory: c.newSubcategory || null, ids: [] })
      groups.get(key).ids.push(c.id)
    }
    console.log(`  ${groups.size} unique (category, subcategory) groups`)
    let done = 0
    for (const [, group] of groups) {
      const IDS_BATCH = 500
      for (let i = 0; i < group.ids.length; i += IDS_BATCH) {
        const ids = group.ids.slice(i, i + IDS_BATCH)
        const { error } = await sb
          .from('global_products')
          .update({ category: group.category, subcategory: group.subcategory })
          .in('id', ids)
        if (error) console.error(`  ERROR group ${group.category}/${group.subcategory}: ${error.message}`)
        done += ids.length
      }
      process.stdout.write(`  ${done}/${stats.changes.length} updated\r`)
    }
    console.log(`  ${done}/${stats.changes.length} updated    `)
  }

  console.log('\n--- RESULTS ---')
  console.log(`  Total products:              ${stats.total}`)
  console.log(`  Direct map (pass 1+2):       ${stats.pass1_directMap}`)
  console.log(`  classifyByName (pass 3):     ${stats.pass3_classifyByName}`)
  console.log(`  Fallback grocery (pass 4):   ${stats.pass4_fallbackGrocery}`)
  console.log(`  Unchanged:                   ${stats.unchanged}`)
  console.log(`  To deactivate:               ${stats.deactivate}`)

  console.log('\n--- BY NEW CATEGORY ---')
  for (const [cat, count] of Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])) {
    const label = CATEGORIES[cat]?.ru || cat
    console.log(`  ${cat.padEnd(20)} ${String(count).padStart(5)}  ${label}`)
  }

  console.log('\n--- BY NEW SUBCATEGORY ---')
  for (const [sub, count] of Object.entries(stats.bySubcategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sub.padEnd(25)} ${String(count).padStart(5)}`)
  }

  if (stats.deactivated.length > 0) {
    console.log('\n--- TO DEACTIVATE ---')
    for (const p of stats.deactivated) {
      console.log(`  ${p.ean.padEnd(18)} ${(p.name || '').slice(0, 50).padEnd(52)} [${p.oldCategory}]`)
    }
  }

  if (stats.unclassified.length > 0) {
    console.log('\n--- UNCLASSIFIED (fell to grocery/null) ---')
    for (const p of stats.unclassified.slice(0, 30)) {
      console.log(`  ${p.ean.padEnd(18)} ${p.name.slice(0, 50).padEnd(52)} [${p.oldCategory}]`)
    }
    if (stats.unclassified.length > 30) {
      console.log(`  ... and ${stats.unclassified.length - 30} more`)
    }
  }

  const OUT_DIR = path.join(__dirname, '..', 'data', 'audit')
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const report = {
    timestamp: new Date().toISOString(),
    dryRun,
    stats: {
      total: stats.total,
      directMap: stats.pass1_directMap,
      classifyByName: stats.pass3_classifyByName,
      fallbackGrocery: stats.pass4_fallbackGrocery,
      unchanged: stats.unchanged,
      deactivate: stats.deactivate,
      byCategory: stats.byCategory,
      bySubcategory: stats.bySubcategory,
    },
    deactivated: stats.deactivated,
    unclassified: stats.unclassified,
    changes: stats.changes,
  }

  const outFile = path.join(OUT_DIR, 'category-normalization.json')
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2))
  console.log(`\nReport saved → data/audit/category-normalization.json`)

  if (!dryRun && stats.deactivated.length > 0) {
    console.log('\n--- DEACTIVATING PRODUCTS ---')
    for (const p of stats.deactivated) {
      const { error } = await sb
        .from('global_products')
        .update({ is_active: false })
        .eq('id', p.id)
      if (error) {
        console.error(`  ERROR deactivating ${p.ean}: ${error.message}`)
      }
    }
    console.log(`  Deactivated ${stats.deactivated.length} products`)
  }

  console.log('\n' + '='.repeat(60))
  console.log(dryRun ? 'DRY RUN COMPLETE' : 'NORMALIZATION COMPLETE')
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
