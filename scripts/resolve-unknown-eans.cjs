#!/usr/bin/env node
// resolve-unknown-eans.cjs — server-side enrichment cascade for staged unknown EANs
// Pipeline: global_products match → NPC → Arbuz → USDA → OFF → AI
// Usage: node scripts/resolve-unknown-eans.cjs [--limit=N] [--store=STORE_ID] [--dry-run]

const fs = require('fs')
const path = require('path')
const https = require('https')
const { URL } = require('url')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const NPC_API_KEY = process.env.NPC_API_KEY
const USDA_API_KEY = process.env.USDA_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const DELAY_MS = 350
const ARBUZ_CONSUMER_NAME = 'arbuz-kz.web.mobile'
const ARBUZ_CONSUMER_KEY = '20I2OMoyCQ9BGQH7TimHCbErGuEjhLfj'
const ARBUZ_API_BASE = 'https://arbuz.kz/api/v1'
const ARBUZ_TOKEN_TTL = 10 * 60 * 1000

let _arbuzToken = { token: null, expires: 0 }

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function httpReq(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const reqOpts = {
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...headers },
      timeout: 20000,
    }
    const req = https.request(reqOpts, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

function parseArgs() {
  const args = process.argv.slice(2)
  const result = { dryRun: false, limit: 50, storeId: null }
  for (const arg of args) {
    if (arg === '--dry-run') result.dryRun = true
    else if (arg.startsWith('--limit=')) result.limit = parseInt(arg.split('=')[1], 10)
    else if (arg.startsWith('--store=')) result.storeId = arg.split('=')[1]
  }
  return result
}

async function npcSearch(query, size = 5) {
  const data = JSON.stringify({ query, page: 1, size })
  const url = new URL('https://nationalcatalog.kz/gw/search/api/v1/search')
  const r = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname, port: 443, path: url.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-API-KEY': NPC_API_KEY,
      },
      timeout: 15000,
    }, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }) }
        catch { resolve({ status: res.statusCode, body: null }) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(data)
    req.end()
  })

  if (r.status !== 200 || !r.body) return []
  return r.body.items || []
}

async function arbuzSearch(query) {
  if (!_arbuzToken.token || Date.now() >= _arbuzToken.expires) {
    const authR = await httpReq('POST', ARBUZ_API_BASE + '/auth/token', {}, {
      consumer: ARBUZ_CONSUMER_NAME, key: ARBUZ_CONSUMER_KEY,
    })
    if (authR.status !== 200) return []
    try {
      const json = JSON.parse(authR.body)
      _arbuzToken = { token: json.data?.token, expires: Date.now() + ARBUZ_TOKEN_TTL }
    } catch { return [] }
  }

  const r = await httpReq('GET',
    ARBUZ_API_BASE + '/shop/search?query=' + encodeURIComponent(query) + '&size=5',
    { Authorization: 'Bearer ' + _arbuzToken.token }
  )
  if (r.status !== 200) return []
  try {
    const json = JSON.parse(r.body)
    return json.data?.items || []
  } catch { return [] }
}

async function usdaSearch(query) {
  if (!USDA_API_KEY) return null
  const r = await httpReq('GET',
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=1`
  )
  if (r.status !== 200) return null
  try {
    const json = JSON.parse(r.body)
    return json.foods?.[0] || null
  } catch { return null }
}

async function offSearch(ean) {
  const r = await httpReq('GET', `https://world.openfoodfacts.org/api/v2/product/${ean}.json`)
  if (r.status !== 200) return null
  try {
    const json = JSON.parse(r.body)
    return json.product || null
  } catch { return null }
}

function extractEanFromNpc(item) {
  if (item.gtin) return item.gtin
  const attrs = item.attributes || []
  const eanAttr = attrs.find(a => (a.code === 'gtin' || a.code === 'ean13') && a.value)
  return eanAttr?.value || null
}

function extractNameFromNpc(item) {
  return item.nameRu || item.nameKk || item.nameEn || ''
}

function extractIngredientsFromArbuz(item) {
  return item.ingredients || item.ingredientsText || null
}

function buildGlobalProductFromNpc(item, ean) {
  const name = extractNameFromNpc(item)
  const attrs = item.attributes || []
  const brandAttr = attrs.find(a => a.code === 'brand' && a.value)
  const brand = brandAttr?.valueRu || brandAttr?.value || null
  const countryAttr = attrs.find(a => a.code === 'country' && a.value)
  const country = countryAttr?.valueRu || countryAttr?.value || null

  return {
    ean, name, name_kz: item.nameKk || null, brand, country_of_origin: country,
    source_primary: 'npc', is_active: true,
    data_quality_score: 0,
  }
}

async function upsertGlobalProduct(sb, product) {
  const { data, error } = await sb
    .from('global_products')
    .upsert(product, { onConflict: 'ean' })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('  upsert global_products error:', error.message)
    return null
  }
  return data?.id || null
}

async function createStoreProduct(sb, storeId, ean, globalProductId, staging) {
  const { data, error } = await sb
    .from('store_products')
    .upsert({
      store_id: storeId, ean, global_product_id: globalProductId,
      price_kzt: staging.price_kzt, stock_status: staging.stock_status || 'in_stock',
      shelf_zone: staging.shelf_zone || null, is_active: true,
    }, { onConflict: 'store_id,ean' })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('  upsert store_products error:', error.message)
    return null
  }
  return data?.id || null
}

async function markStagingResolved(sb, stagingId, globalProductId, method, storeProductId) {
  const { error } = await sb
    .from('unknown_ean_staging')
    .update({
      status: 'resolved',
      resolved_global_product_id: globalProductId,
      resolution_result: { method, store_product_id: storeProductId },
      updated_at: new Date().toISOString(),
    })
    .eq('id', stagingId)

  if (error) console.error('  update staging error:', error.message)
}

async function markStagingFailed(sb, stagingId, reason) {
  const { error } = await sb
    .from('unknown_ean_staging')
    .update({
      status: 'failed',
      resolution_result: { reason },
      updated_at: new Date().toISOString(),
    })
    .eq('id', stagingId)

  if (error) console.error('  update staging error:', error.message)
}

async function markStagingEnriching(sb, stagingId) {
  await sb
    .from('unknown_ean_staging')
    .update({ status: 'enriching', updated_at: new Date().toISOString() })
    .eq('id', stagingId)
}

async function main() {
  const opts = parseArgs()

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('SUPABASE_URL/SERVICE_ROLE_KEY not set in .env.local')
    process.exit(1)
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  let query = sb
    .from('unknown_ean_staging')
    .select('id, store_id, ean, local_name, price_kzt, stock_status, shelf_zone')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(opts.limit)

  if (opts.storeId) query = query.eq('store_id', opts.storeId)

  const { data: stagings, error } = await query

  if (error) { console.error('DB error:', error); process.exit(1) }
  if (!stagings?.length) { console.log('No pending unknown EANs to resolve'); return }

  console.log(`Found ${stagings.length} pending unknown EANs`)

  let resolved = 0, enriched = 0, failed = 0

  for (let i = 0; i < stagings.length; i++) {
    const s = stagings[i]
    const label = `[${i + 1}/${stagings.length}] EAN=${s.ean} "${(s.local_name || '').substring(0, 30)}"`
    process.stdout.write(`${label}... `)

    if (opts.dryRun) {
      console.log('DRY RUN')
      continue
    }

    await markStagingEnriching(sb, s.id)

    const { data: existing } = await sb
      .from('global_products')
      .select('id')
      .eq('ean', s.ean)
      .eq('is_active', true)
      .maybeSingle()

    if (existing) {
      const spId = await createStoreProduct(sb, s.store_id, s.ean, existing.id, s)
      if (spId) {
        await markStagingResolved(sb, s.id, existing.id, 'global_products_match', spId)
        resolved++
        console.log(`RESOLVED (existing global_product)`)
      } else {
        await markStagingFailed(sb, s.id, 'store_products insert failed')
        failed++
        console.log('FAILED (store_products insert)')
      }
      await sleep(DELAY_MS)
      continue
    }

    let globalId = null
    let source = null
    let productData = null

    if (NPC_API_KEY && s.local_name) {
      try {
        const items = await npcSearch(s.local_name.substring(0, 80))
        if (items.length > 0) {
          const best = items[0]
          const npcEan = extractEanFromNpc(best)
          if (npcEan && npcEan.length >= 8) {
            productData = buildGlobalProductFromNpc(best, s.ean)
            productData.ean = s.ean
            source = 'npc'
          }
        }
      } catch (e) {
        console.error(`NPC error: ${e.message}`)
      }
      await sleep(DELAY_MS)
    }

    if (!productData) {
      try {
        const arbuzItems = await arbuzSearch(s.local_name || s.ean)
        if (arbuzItems.length > 0) {
          const item = arbuzItems[0]
          const ingredients = extractIngredientsFromArbuz(item)
          productData = {
            ean: s.ean, name: s.local_name || item.name || `Товар ${s.ean}`,
            brand: item.brand || null, ingredients_raw: ingredients,
            calories_100g: item.nutrition?.calories || null,
            proteins_100g: item.nutrition?.proteins || null,
            fats_100g: item.nutrition?.fats || null,
            carbohydrates_100g: item.nutrition?.carbohydrates || null,
            image_url: item.image || null,
            source_primary: 'arbuz', is_active: true,
          }
          source = 'arbuz'
        }
      } catch (e) {
        console.error(`Arbuz error: ${e.message}`)
      }
      await sleep(DELAY_MS)
    }

    if (!productData && USDA_API_KEY && s.local_name) {
      try {
        const usdaFood = await usdaSearch(s.local_name.substring(0, 80))
        if (usdaFood) {
          productData = {
            ean: s.ean, name: s.local_name || usdaFood.description || `Товар ${s.ean}`,
            source_primary: 'usda', is_active: true,
          }
          const nutrients = usdaFood.foodNutrients || []
          for (const n of nutrients) {
            if (n.nutrientName?.includes('Energy')) productData.calories_100g = Math.round(n.value || 0)
            if (n.nutrientName?.includes('Protein')) productData.proteins_100g = n.value || null
            if (n.nutrientName?.includes('Total lipid')) productData.fats_100g = n.value || null
            if (n.nutrientName?.includes('Carbohydrate')) productData.carbohydrates_100g = n.value || null
          }
          source = 'usda'
        }
      } catch (e) {
        console.error(`USDA error: ${e.message}`)
      }
      await sleep(DELAY_MS)
    }

    if (!productData) {
      try {
        const offProduct = await offSearch(s.ean)
        if (offProduct?.product_name) {
          productData = {
            ean: s.ean, name: offProduct.product_name,
            brand: offProduct.brands || null,
            ingredients_raw: offProduct.ingredients_text || null,
            image_url: offProduct.image_url || null,
            source_primary: 'openfoodfacts', is_active: true,
          }
          source = 'openfoodfacts'
        }
      } catch (e) {
        console.error(`OFF error: ${e.message}`)
      }
      await sleep(DELAY_MS)
    }

    if (productData) {
      globalId = await upsertGlobalProduct(sb, productData)
      if (globalId) {
        const spId = await createStoreProduct(sb, s.store_id, s.ean, globalId, s)
        if (spId) {
          await markStagingResolved(sb, s.id, globalId, `${source}_enrichment`, spId)
          enriched++
          console.log(`ENRICHED via ${source}`)
        } else {
          await markStagingFailed(sb, s.id, 'store_products insert failed after enrichment')
          failed++
          console.log('FAILED (store_products after enrichment)')
        }
      } else {
        await markStagingFailed(sb, s.id, 'global_products upsert failed')
        failed++
        console.log('FAILED (global_products upsert)')
      }
    } else {
      await markStagingFailed(sb, s.id, 'no source found')
      failed++
      console.log('NOT FOUND (all sources exhausted)')
    }
  }

  console.log(`\n══════════════════════════════════════`)
  console.log(`Resolved (existing): ${resolved}`)
  console.log(`Enriched (new):      ${enriched}`)
  console.log(`Failed:              ${failed}`)
  console.log(`Total processed:     ${stagings.length}`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
