require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { createClient } = require('@supabase/supabase-js')
const { classifyBarcode } = require('./validate-ean.cjs')
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

;(async () => {
  const all = []
  for (let page = 0; page < 20; page++) {
    const { data: ch } = await sb
      .from('global_products')
      .select('id,ean,ingredients_raw,allergens_json,diet_tags_json,halal_status,nutriments_json,alternate_eans,source_primary')
      .eq('is_active', true)
      .order('id')
      .range(page * 999, (page + 1) * 999 - 1)
    if (!ch || !ch.length) break
    all.push(...ch)
    if (ch.length < 999) break
  }
  const T = all.length
  if (T === 0) { console.log('No products'); return }

  const real = all.filter(p => p.ean && classifyBarcode(p.ean).valid)
  const fake = all.filter(p => p.ean && (p.ean.startsWith('arbuz_') || p.ean.startsWith('kaspi_') || p.ean.startsWith('korzinavdom_')))
  const noEan = all.filter(p => !p.ean)
  const hasIng = all.filter(p => p.ingredients_raw && String(p.ingredients_raw).trim().length > 3)
  const hasAlg = all.filter(p => p.allergens_json && (Array.isArray(p.allergens_json) ? p.allergens_json.length > 0 : Object.keys(p.allergens_json).length > 0))
  const hasHal = all.filter(p => p.halal_status && p.halal_status !== 'unknown')
  const hasNutr = all.filter(p => p.nutriments_json && (typeof p.nutriments_json === 'object') && Object.keys(p.nutriments_json).length > 0)
  const hasDiet = all.filter(p => p.diet_tags_json && (Array.isArray(p.diet_tags_json) ? p.diet_tags_json.length > 0 : Object.keys(p.diet_tags_json).length > 0))
  const fakeAlt = all.filter(p => {
    if (!p.ean || (!p.ean.startsWith('arbuz_') && !p.ean.startsWith('kaspi_') && !p.ean.startsWith('korzinavdom_'))) return false
    return p.alternate_eans && p.alternate_eans.some(e => classifyBarcode(e).valid)
  })
  const realIng = real.filter(p => p.ingredients_raw && String(p.ingredients_raw).trim().length > 3)
  const bySrc = {}; all.forEach(p => { const s = p.source_primary || 'none'; bySrc[s] = (bySrc[s] || 0) + 1 })

  const p = v => (v / T * 100).toFixed(1) + '%'
  console.log('═══════════════════════════════════════')
  console.log('   ПОЛНАЯ СТАТИСТИКА global_products')
  console.log('═══════════════════════════════════════')
  console.log('')
  console.log('Всего продуктов:', T)
  console.log('')
  console.log('── EAN ШТРИХКОДЫ ──')
  console.log('Реальный EAN (сканируется):', real.length, p(real))
  console.log('Фейковый EAN (не сканируется):', fake.length, p(fake))
  console.log('  arbuz_:', all.filter(x => x.ean?.startsWith('arbuz_')).length)
  console.log('  kaspi_:', all.filter(x => x.ean?.startsWith('kaspi_')).length)
  console.log('  korzinavdom_:', all.filter(x => x.ean?.startsWith('korzinavdom_')).length)
  console.log('Без EAN:', noEan.length)
  console.log('')
  console.log('Фейк + GTIN в alternate:', fakeAlt.length)
  console.log('→ После резолвера реальных EAN:', real.length + fakeAlt.length, p(real.length + fakeAlt.length))
  console.log('')
  console.log('── СОСТАВ / КОНТЕНТ ──')
  console.log('С составом (ingredients_raw):', hasIng.length, p(hasIng))
  console.log('Без состава:', T - hasIng.length, p(T - hasIng))
  console.log('С аллергенами (allergens_json):', hasAlg.length, p(hasAlg))
  console.log('С халяль-статусом:', hasHal.length, p(hasHal))
  console.log('С нутриентами (nutriments_json):', hasNutr.length, p(hasNutr))
  console.log('С диет-тегами (diet_tags_json):', hasDiet.length, p(hasDiet))
  console.log('')
  console.log('── СКАН + СОСТАВ ──')
  console.log('Реальный EAN + есть состав:', realIng.length, p(realIng))
  console.log('Реальный EAN + нет состава:', real.length - realIng.length)
  console.log('Фейк EAN + есть состав:', fake.filter(x => x.ingredients_raw && String(x.ingredients_raw).trim().length > 3).length)
  console.log('')
  console.log('── ИСТОЧНИК ДАННЫХ ──')
  Object.entries(bySrc).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => console.log('  ' + s + ':', c, p(c)))
})()
