require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data', 'kaspi')

async function main() {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const rawData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, '01_chocolate-bars_raw.json'), 'utf8'))
  const products = rawData.products.filter(p => !p.error)

  console.log(`Total products in raw data: ${products.length}`)
  console.log(`With composition: ${products.filter(p => p.composition).length}`)
  console.log(`With nutrition: ${products.filter(p => p.nutritionPer100).length}`)

  let updated = 0, notFound = 0, errors = 0

  for (const p of products) {
    if (!p.composition && !p.nutritionPer100 && !p.storageConditions && !p.shelfLife) continue

    const { data: rows } = await sb
      .from('global_products')
      .select('id, ean, ingredients_raw, nutriments_json, data_quality_score')
      .contains('tags_json', { kaspi_code: p.kaspiCode })
      .limit(1)

    const existing = rows?.[0]
    if (!existing) {
      const { data: rows2 } = await sb
        .from('global_products')
        .select('id, ean, ingredients_raw, nutriments_json, data_quality_score')
        .eq('ean', `kaspi_${p.kaspiCode}`)
        .maybeSingle()
      if (!rows2) { notFound++; continue }
    }

    const row = existing || (await sb.from('global_products').select('id, ean, ingredients_raw, nutriments_json, data_quality_score').eq('ean', `kaspi_${p.kaspiCode}`).maybeSingle()).data
    if (!row) { notFound++; continue }

    const updateData = { updated_at: new Date().toISOString() }
    let changed = false

    if (!row.ingredients_raw && p.composition) {
      updateData.ingredients_raw = p.composition.substring(0, 2000)
      changed = true
    }
    if (p.nutritionPer100) {
      const n = {}
      if (p.nutritionPer100.kcal) n.kcal = p.nutritionPer100.kcal
      if (p.nutritionPer100.protein) n.protein = p.nutritionPer100.protein
      if (p.nutritionPer100.fat) n.fat = p.nutritionPer100.fat
      if (p.nutritionPer100.carbs) n.carbs = p.nutritionPer100.carbs
      if (Object.keys(n).length > 0 && !row.nutriments_json) {
        updateData.nutriments_json = n
        changed = true
      }
    }

    let score = 0
    if (p.name) score += 15
    if (p.brand) score += 15
    if (p.composition) score += 20
    if (p.nutritionPer100) score += 15
    if (p.images?.length > 0) score += 15
    if (p.weight) score += 5
    if (p.countryOfOrigin) score += 5
    if (p.shelfLife) score += 5
    if (p.priceKzt) score += 5
    if (score > (row.data_quality_score || 0)) {
      updateData.data_quality_score = Math.min(100, score)
      changed = true
    }

    if (changed) {
      const { error } = await sb.from('global_products').update(updateData).eq('id', row.id)
      if (error) { console.error(`ERR ${row.ean}: ${error.message}`); errors++ }
      else { updated++; process.stdout.write('+') }
    }
  }

  console.log(`\n\nUpdated: ${updated}, Not found: ${notFound}, Errors: ${errors}`)

  const { count: total } = await sb.from('global_products').select('*', { count: 'exact', head: true })
  const { count: withComp } = await sb.from('global_products').select('*', { count: 'exact', head: true }).not('ingredients_raw', 'is', null)
  console.log(`Total: ${total}, With composition: ${withComp}`)
}

main()
