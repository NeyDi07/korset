require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const NON_FOOD_KEYWORDS = [
  'сотейник', 'сковород', 'кастрюл', 'тарелк', 'кружк', 'бокал', 'фужер',
  'микроволнов', 'печь ava', 'чайник ', 'кофеварк', 'блендер', 'мультивар',
  'утюг', 'пылесос', 'стиральн', 'телевизор', 'ноутбук',
  'колготк', 'сандали', 'обувь', 'куртк', 'рубашк', 'футболк', 'джинсы', 'пальто',
  'полотенце', 'шампунь', 'гель для душ', 'дезодорант', 'зубн', 'подгузник', 'прокладк',
  'вставка в паллет', 'штамп', 'набор для лица', 'маска для вол',
  'ковш ', 'доска раздел', 'нож кух',
  'корм для собак', 'корм для кошек', 'влажный корм',
  'наполнитель для', 'лоток ',
  'сандалии', 'кроссовк', 'тапочк',
  'губк', 'щетк', 'венчик', 'терк', 'скалк', 'шпатель',
  'подарочный набор', 'набор подароч',
]

async function audit() {
  const BATCH = 500
  let offset = 0
  const all = []
  while (true) {
    const { data } = await sb
      .from('global_products')
      .select('id, ean, name, brand, category, source_primary, is_active, quantity, image_url')
      .eq('is_active', true)
      .range(offset, offset + BATCH - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < BATCH) break
    offset += BATCH
  }
  console.log('Total active products:', all.length)

  // 1. NON-FOOD
  const nonFood = all.filter((p) => {
    const n = (p.name || '').toLowerCase()
    return NON_FOOD_KEYWORDS.some((k) => n.includes(k.toLowerCase()))
  })
  console.log('\n=== NON-FOOD PRODUCTS ===')
  console.log('Count:', nonFood.length)
  for (const p of nonFood) {
    const cat = (p.category || '').slice(0, 28).padEnd(30)
    const src = (p.source_primary || '').padEnd(14)
    const name = (p.name || '').slice(0, 52)
    console.log(' ', p.ean.padEnd(15), cat, src, name)
  }

  // 2. FAKE EAN
  const fakeEan = all.filter(
    (p) => p.ean.startsWith('arbuz_') || p.ean.startsWith('kaspi_') || p.ean.startsWith('korzinavdom_')
  )
  console.log('\n=== FAKE EANs (still in global_products) ===')
  console.log('Count:', fakeEan.length)

  // 3. ENGLISH CATEGORIES
  const engCat = all.filter(
    (p) => p.category && !/[а-яёА-ЯЁ]/.test(p.category) && p.category !== 'grocery'
  )
  console.log('\n=== ENGLISH CATEGORIES ===')
  const engCatCounts = {}
  for (const p of engCat) engCatCounts[p.category] = (engCatCounts[p.category] || 0) + 1
  for (const [c, n] of Object.entries(engCatCounts).sort((a, b) => b[1] - a[1]))
    console.log(' ', n, c)

  // 4. NO IMAGE
  const noImage = all.filter((p) => !p.image_url)
  console.log('\n=== NO IMAGE ===')
  console.log('Count:', noImage.length, '/', all.length, '=', ((noImage.length / all.length) * 100).toFixed(1) + '%')

  // 5. GARBAGE QUANTITY
  const GARBAGE = ['вес', 'weight', 'весовой', '-']
  const garbageQty = all.filter((p) => p.quantity && GARBAGE.includes(p.quantity.trim().toLowerCase()))
  console.log('\n=== GARBAGE QUANTITY VALUES ===')
  const qtyCounts = {}
  for (const p of garbageQty) qtyCounts[p.quantity] = (qtyCounts[p.quantity] || 0) + 1
  for (const [v, n] of Object.entries(qtyCounts).sort((a, b) => b[1] - a[1]))
    console.log(' ', n, '"' + v + '"')

  // 6. SOURCE PRIMARY DISTRIBUTION
  console.log('\n=== SOURCE PRIMARY DISTRIBUTION ===')
  const srcCounts = {}
  for (const p of all) srcCounts[p.source_primary || 'null'] = (srcCounts[p.source_primary || 'null'] || 0) + 1
  for (const [s, n] of Object.entries(srcCounts).sort((a, b) => b[1] - a[1]))
    console.log(' ', n, s)

  // 7. CATEGORY IS FOOD BUT NAME IS NON-FOOD (NPC mismatch)
  const npcNonFood = nonFood.filter((p) => p.source_primary === 'npc')
  console.log('\n=== NPC-SOURCED NON-FOOD ===')
  console.log('Count:', npcNonFood.length)

  // 8. PET FOOD (корм для животных — technically food but not for humans)
  const petFood = all.filter((p) => {
    const n = (p.name || '').toLowerCase()
    return n.includes('корм для') || n.includes('влажный корм') || n.includes('сухой корм') || n.includes('полнорац')
  })
  console.log('\n=== PET FOOD ===')
  console.log('Count:', petFood.length)
  for (const p of petFood.slice(0, 10)) {
    console.log(' ', p.ean.padEnd(15), (p.category || '').slice(0, 30).padEnd(32), (p.name || '').slice(0, 55))
  }
  if (petFood.length > 10) console.log('  ... and', petFood.length - 10, 'more')
}

audit().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
