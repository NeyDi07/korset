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

const CYRILLIC_RE = /[а-яА-ЯёЁ]/

const CATEGORY_MAP = {
  'snacks': 'Снеки',
  'beverages': 'Напитки',
  'breakfasts': 'Завтраки',
  'condiments': 'Приправы',
  'dairies': 'Молочные',
  'desserts': 'Десерты',
  'chocolate': 'Шоколад',
  'candy': 'Конфеты',
  'grocery': 'Бакалея',
  'plant-based-foods-and-beverages': 'Растительная пища',
  'beverages-and-beverages-preparations': 'Напитки',
  'meat': 'Мясо',
  'seafood': 'Морепродукты',
  'spices': 'Специи',
  'sauces': 'Соусы',
  'cereals': 'Хлопья',
  'cookies': 'Печенье',
  'chips': 'Чипсы',
  'nuts': 'Орехи',
  'dried-fruits': 'Сухофрукты',
  'tea': 'Чай',
  'coffee': 'Кофе',
  'juice': 'Сок',
  'soda': 'Газировка',
  'water': 'Вода',
  'pasta': 'Макароны',
  'rice': 'Рис',
  'flour': 'Мука',
  'sugar': 'Сахар',
  'oil': 'Масло',
  'vinegar': 'Уксус',
  'honey': 'Мёд',
  'jam': 'Варенье',
  'peanut-butter': 'Арахисовая паста',
  'canned-food': 'Консервы',
  'soup': 'Супы',
  'baby-food': 'Детское питание',
  'pet-food': 'Корм для животных',
  'frozen': 'Замороженное',
  'bakery': 'Выпечка',
  'bread': 'Хлеб',
  'cheese': 'Сыр',
  'yogurt': 'Йогурт',
  'milk': 'Молоко',
  'butter': 'Масло',
  'cream': 'Сливки',
  'kefir': 'Кефир',
}

const SUBCATEGORY_HINTS = {
  'чипс': 'Чипсы',
  'chip': 'Чипсы',
  'crisp': 'Чипсы',
  'печень': 'Печенье',
  'cookie': 'Печенье',
  'biscuit': 'Печенье',
  'шоколад': 'Шоколад',
  'chocolat': 'Шоколад',
  'cacao': 'Шоколад',
  'конфет': 'Конфеты',
  'candy': 'Конфеты',
  'sweet': 'Конфеты',
  'напитк': 'Напитки',
  'drink': 'Напитки',
  'beverag': 'Напитки',
  'сок': 'Сок',
  'juice': 'Сок',
  'газиров': 'Газировка',
  'soda': 'Газировка',
  'cola': 'Газировка',
  'вод': 'Вода',
  'water': 'Вода',
  'чай': 'Чай',
  'tea': 'Чай',
  'кофе': 'Кофе',
  'coffee': 'Кофе',
  'молок': 'Молоко',
  'milk': 'Молоко',
  'кефир': 'Кефир',
  'kefir': 'Кефир',
  'йогурт': 'Йогурт',
  'yogurt': 'Йогурт',
  'сыр': 'Сыр',
  'cheese': 'Сыр',
  'масло': 'Масло',
  'butter': 'Масло',
  'oil': 'Масло',
  'сливк': 'Сливки',
  'cream': 'Сливки',
  'сахар': 'Сахар',
  'sugar': 'Сахар',
  'мука': 'Мука',
  'flour': 'Мука',
  'рис': 'Рис',
  'rice': 'Рис',
  'макарон': 'Макароны',
  'pasta': 'Макароны',
  'spaghetti': 'Макароны',
  'хлеб': 'Хлеб',
  'bread': 'Хлеб',
  'выпечк': 'Выпечка',
  'bakery': 'Выпечка',
  'суп': 'Супы',
  'soup': 'Супы',
  'noodle': 'Супы',
  'соус': 'Соусы',
  'sauce': 'Соусы',
  'ketchup': 'Соусы',
  'майонез': 'Соусы',
  'mayo': 'Соусы',
  'приправ': 'Приправы',
  'специй': 'Специи',
  'spice': 'Специи',
  'season': 'Специи',
  'орех': 'Орехи',
  'nut': 'Орехи',
  'сухофрукт': 'Сухофрукты',
  'dried fruit': 'Сухофрукты',
  'мёд': 'Мёд',
  'honey': 'Мёд',
  'варень': 'Варенье',
  'jam': 'Варенье',
  'консерв': 'Консервы',
  'canned': 'Консервы',
  'заморож': 'Замороженное',
  'frozen': 'Замороженное',
  'мяс': 'Мясо',
  'meat': 'Мясо',
  'морепродукт': 'Морепродукты',
  'seafood': 'Морепродукты',
  'fish': 'Морепродукты',
  'детск': 'Детское питание',
  'baby food': 'Детское питание',
  'корм': 'Корм для животных',
  'pet food': 'Корм для животных',
  'завтрак': 'Завтраки',
  'breakfast': 'Завтраки',
  'хлопь': 'Хлопья',
  'cereal': 'Хлопья',
  'muesli': 'Хлопья',
  'granola': 'Хлопья',
  'десерт': 'Десерты',
  'dessert': 'Десерты',
  'паст': 'Арахисовая паста',
  'peanut butter': 'Арахисовая паста',
  'уксус': 'Уксус',
  'vinegar': 'Уксус',
  'бакале': 'Бакалея',
  'grocery': 'Бакалея',
  'снек': 'Снеки',
  'snack': 'Снеки',
  'растительн': 'Растительная пища',
  'plant-based': 'Растительная пища',
  'vegan': 'Растительная пища',
}

const args = process.argv.slice(2)
let dryRun = false
let limit = null

for (const arg of args) {
  if (arg === '--dry-run') dryRun = true
  if (arg.startsWith('--limit=')) limit = parseInt(arg.split('=')[1], 10)
}

function resolveRussianCategory(product) {
  if (product.category && CYRILLIC_RE.test(product.category)) {
    return product.category
  }

  if (product.category && !CYRILLIC_RE.test(product.category)) {
    const lower = product.category.toLowerCase()
    for (const [eng, rus] of Object.entries(CATEGORY_MAP)) {
      if (lower === eng || lower.includes(eng)) {
        return rus
      }
    }
  }

  if (product.categories_tags_json && Array.isArray(product.categories_tags_json)) {
    for (const tag of product.categories_tags_json) {
      const lower = String(tag).toLowerCase()
      for (const [eng, rus] of Object.entries(CATEGORY_MAP)) {
        if (lower === eng || lower.includes(eng)) {
          return rus
        }
      }
    }
  }

  const searchable = [
    product.name || '',
    product.brand || '',
  ].join(' ').toLowerCase()

  for (const [hint, rus] of Object.entries(SUBCATEGORY_HINTS)) {
    if (searchable.includes(hint.toLowerCase())) {
      return rus
    }
  }

  return null
}

function isCategoryEnglish(category) {
  return category && !CYRILLIC_RE.test(category)
}

async function fetchEnglishProducts(select, limitN) {
  const batch = 1000
  let offset = 0
  let all = []
  while (true) {
    const query = sb
      .from('global_products')
      .select(select)
      .eq('is_active', true)
      .range(offset, offset + batch - 1)

    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) break

    const english = data.filter(p => p.name && !CYRILLIC_RE.test(p.name))
    all = all.concat(english)

    if (limitN && all.length >= limitN) {
      all = all.slice(0, limitN)
      break
    }

    if (data.length < batch) break
    offset += batch
  }
  return all
}

async function main() {
  console.log('KORSET CATEGORY PREFIX FIX')
  console.log('='.repeat(60))
  if (dryRun) console.log('DRY RUN — no writes')
  if (limit) console.log(`Limit: ${limit} products`)
  console.log()

  const OUT_DIR = path.join(__dirname, '..', 'data', 'audit')
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const selectCols = 'id,ean,name,brand,category,categories_tags_json,subcategory,source_primary,needs_review'

  console.log('Fetching English-name products...')
  const products = await fetchEnglishProducts(selectCols, limit)
  console.log(`Found ${products.length} English-name products\n`)

  const stats = {
    totalEnglish: products.length,
    categoriesMapped: 0,
    namesUpdated: 0,
    categoriesUpdated: 0,
    unmapped: [],
    updated: [],
  }

  for (const p of products) {
    const russianCategory = resolveRussianCategory(p)

    if (!russianCategory) {
      stats.unmapped.push({
        id: p.id,
        ean: p.ean,
        name: p.name,
        brand: p.brand,
        category: p.category,
        categories_tags_json: p.categories_tags_json,
      })
      continue
    }

    stats.categoriesMapped++

    const newName = `${russianCategory} — ${p.name}`
    const updates = { name: newName, needs_review: true }
    let categoryUpdated = false

    if (isCategoryEnglish(p.category)) {
      updates.category = russianCategory
      categoryUpdated = true
      stats.categoriesUpdated++
    }

    stats.updated.push({
      id: p.id,
      ean: p.ean,
      oldName: p.name,
      newName,
      oldCategory: p.category,
      newCategory: categoryUpdated ? russianCategory : p.category,
      categorySource: p.category && CYRILLIC_RE.test(p.category) ? 'existing' : 'mapped',
    })

    if (!dryRun) {
      const { error } = await sb
        .from('global_products')
        .update(updates)
        .eq('id', p.id)
      if (error) {
        console.error(`  ERROR updating ${p.ean}: ${error.message}`)
        continue
      }
    }

    stats.namesUpdated++
  }

  console.log('\n--- RESULTS ---')
  console.log(`  Total English names:     ${stats.totalEnglish}`)
  console.log(`  Categories mapped:       ${stats.categoriesMapped}`)
  console.log(`  Names updated:           ${stats.namesUpdated}`)
  console.log(`  Category fields updated: ${stats.categoriesUpdated}`)
  console.log(`  Unmapped (manual):       ${stats.unmapped.length}`)

  if (dryRun && stats.updated.length > 0) {
    console.log('\n--- SAMPLE CHANGES (dry-run) ---')
    const sample = stats.updated.slice(0, 20)
    for (const c of sample) {
      console.log(`  ${c.ean}: "${c.oldName}" → "${c.newName}"  [cat: ${c.oldCategory} → ${c.newCategory}]`)
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    dryRun,
    stats: {
      totalEnglish: stats.totalEnglish,
      categoriesMapped: stats.categoriesMapped,
      namesUpdated: stats.namesUpdated,
      categoriesUpdated: stats.categoriesUpdated,
      unmappedCount: stats.unmapped.length,
    },
    updated: stats.updated,
    unmapped: stats.unmapped,
  }

  const outFile = path.join(OUT_DIR, 'category-prefix.json')
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2))
  console.log(`\nSaved → data/audit/category-prefix.json`)

  console.log('\n' + '='.repeat(60))
  console.log(dryRun ? 'DRY RUN COMPLETE' : 'CATEGORY PREFIX FIX COMPLETE')
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
