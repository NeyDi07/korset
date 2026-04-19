const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
const OUT_DIR = path.join(__dirname, '..', 'data', 'audit')

const CYRILLIC_RE = /[а-яА-ЯёЁ]/

async function fetchAll(select, opts = {}) {
  const batch = 1000
  let offset = 0
  let all = []
  while (true) {
    const { data, error } = await sb
      .from('global_products')
      .select(select)
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

async function countActive() {
  const { count, error } = await sb
    .from('global_products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
  if (error) throw error
  return count
}

async function countByColumn(column) {
  const { data, error } = await sb.rpc('exec_sql', {}).catch(() => ({ data: null }))
  const rows = await sb
    .from('global_products')
    .select(column)
    .eq('is_active', true)
  if (rows.error) throw rows.error
  const map = {}
  for (const r of rows.data) {
    const val = r[column] ?? '(null)'
    map[val] = (map[val] || 0) + 1
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1])
}

async function main() {
  console.log('KORSET CATALOG AUDIT')
  console.log('='.repeat(60))

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const total = await countActive()
  console.log(`\nTotal active products: ${total}`)

  const products = await fetchAll('id,ean,name,brand,source_primary,category,image_source,ingredients_raw,name_kz,nutriments_json,needs_review')
  console.log(`Loaded ${products.length} products for analysis`)

  const bySource = {}
  const byImageSource = {}
  const byCategory = {}
  let englishNames = 0
  let englishIngredients = 0
  let emptyNameKz = 0
  let noIngredients = 0
  let noNutriments = 0
  let needsReviewCount = 0

  const englishNameProducts = []
  const englishIngredientProducts = []

  for (const p of products) {
    bySource[p.source_primary ?? '(null)'] = (bySource[p.source_primary ?? '(null)'] || 0) + 1
    byImageSource[p.image_source ?? '(null)'] = (byImageSource[p.image_source ?? '(null)'] || 0) + 1

    if (p.category) {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1
    } else {
      byCategory['(null)'] = (byCategory['(null)'] || 0) + 1
    }

    if (p.name && !CYRILLIC_RE.test(p.name)) {
      englishNames++
      if (englishNameProducts.length < 100) {
        englishNameProducts.push({
          id: p.id,
          ean: p.ean,
          name: p.name,
          brand: p.brand,
          source_primary: p.source_primary,
          category: p.category,
        })
      }
    }

    if (p.ingredients_raw && !CYRILLIC_RE.test(p.ingredients_raw)) {
      englishIngredients++
      if (englishIngredientProducts.length < 100) {
        englishIngredientProducts.push({
          id: p.id,
          ean: p.ean,
          name: p.name,
          brand: p.brand,
          source_primary: p.source_primary,
          ingredients_raw: p.ingredients_raw,
        })
      }
    }

    if (!p.name_kz) emptyNameKz++
    if (!p.ingredients_raw) noIngredients++
    if (!p.nutriments_json || Object.keys(p.nutriments_json).length === 0) noNutriments++
    if (p.needs_review) needsReviewCount++
  }

  console.log('\n--- BY SOURCE PRIMARY ---')
  for (const [k, v] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${v}`)
  }

  console.log('\n--- BY IMAGE SOURCE ---')
  for (const [k, v] of Object.entries(byImageSource).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${v}`)
  }

  console.log('\n--- TOP 20 CATEGORIES ---')
  const topCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 20)
  for (const [k, v] of topCats) {
    console.log(`  ${k.padEnd(35)} ${v}`)
  }

  console.log('\n--- QUALITY GAPS ---')
  console.log(`  English-only names:          ${englishNames} / ${products.length} (${(englishNames / products.length * 100).toFixed(1)}%)`)
  console.log(`  English-only ingredients:    ${englishIngredients} / ${products.length} (${(englishIngredients / products.length * 100).toFixed(1)}%)`)
  console.log(`  Empty name_kz:               ${emptyNameKz} / ${products.length} (${(emptyNameKz / products.length * 100).toFixed(1)}%)`)
  console.log(`  No ingredients_raw:          ${noIngredients} / ${products.length} (${(noIngredients / products.length * 100).toFixed(1)}%)`)
  console.log(`  No nutriments_json:          ${noNutriments} / ${products.length} (${(noNutriments / products.length * 100).toFixed(1)}%)`)
  console.log(`  needs_review = true:         ${needsReviewCount} / ${products.length} (${(needsReviewCount / products.length * 100).toFixed(1)}%)`)

  fs.writeFileSync(
    path.join(OUT_DIR, 'english-names.json'),
    JSON.stringify(englishNameProducts, null, 2)
  )
  console.log(`\nSaved ${englishNameProducts.length} English-name products → data/audit/english-names.json`)

  fs.writeFileSync(
    path.join(OUT_DIR, 'english-ingredients.json'),
    JSON.stringify(englishIngredientProducts, null, 2)
  )
  console.log(`Saved ${englishIngredientProducts.length} English-ingredient products → data/audit/english-ingredients.json`)

  console.log('\n' + '='.repeat(60))
  console.log('AUDIT COMPLETE')
}

main().catch(err => {
  console.error('Audit failed:', err)
  process.exit(1)
})
