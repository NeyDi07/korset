/**
 * Update existing Kaspi products in DB with composition from re-downloaded data
 * (HTML fallback now gives 33% composition vs 8% before)
 */

const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const DATA_DIR = path.join(__dirname, '..', 'data', 'kaspi')

async function main() {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const rawFile = path.join(DATA_DIR, '01_chocolate-bars_raw.json')
  const rawData = JSON.parse(fs.readFileSync(rawFile, 'utf8'))
  const products = rawData.products.filter(p => !p.error && p.composition)

  console.log(`Products with composition: ${products.length}`)

  let updated = 0, skipped = 0, errors = 0

  for (const p of products) {
    const ean = `kaspi_${p.kaspiCode}`

    const { data: existing } = await sb
      .from('global_products')
      .select('id, ingredients_raw, composition, data_quality_score')
      .eq('ean', ean)
      .maybeSingle()

    if (!existing) {
      skipped++
      continue
    }

    const updateData = {}
    let changed = false

    if (!existing.ingredients_raw && p.composition) {
      updateData.ingredients_raw = p.composition.substring(0, 2000)
      changed = true
    }

    if (p.nutritionPer100) {
      const nutriments = {}
      if (p.nutritionPer100.kcal) nutriments.kcal = p.nutritionPer100.kcal
      if (p.nutritionPer100.protein) nutriments.protein = p.nutritionPer100.protein
      if (p.nutritionPer100.fat) nutriments.fat = p.nutritionPer100.fat
      if (p.nutritionPer100.carbs) nutriments.carbs = p.nutritionPer100.carbs

      if (Object.keys(nutriments).length > 0) {
        updateData.nutriments_json = nutriments
        changed = true
      }
    }

    if (!existing.data_quality_score || existing.data_quality_score < 30) {
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
      updateData.data_quality_score = Math.min(100, score)
      changed = true
    }

    if (changed) {
      updateData.updated_at = new Date().toISOString()
      const { error } = await sb.from('global_products').update(updateData).eq('id', existing.id)
      if (error) {
        console.error(`Error updating ${ean}: ${error.message}`)
        errors++
      } else {
        updated++
      }
    } else {
      skipped++
    }
  }

  const { count: totalGP } = await sb.from('global_products').select('*', { count: 'exact', head: true })
  const { count: withComp } = await sb.from('global_products').select('*', { count: 'exact', head: true }).not('ingredients_raw', 'is', null)

  console.log(`\n=== Done! ===`)
  console.log(`Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`)
  console.log(`Total global_products: ${totalGP}`)
  console.log(`With composition (ingredients_raw): ${withComp}`)
}

main()
