import localProducts from '../../data/products.json'
import { supabase } from '../../utils/supabase.js'
import { enrichProductAI } from '../../services/ai.js'
import { normalizeName } from './nameNormalizer.js'
import { getGlobalProductByEan, getStoreCatalogProductByEan } from '../../utils/storeCatalog.js'
import {
  buildLocalScanHistoryEntry,
  appendLocalScanHistory,
  getCurrentHistoryOwnerKey,
} from '../../utils/localHistory.js'
import { loadPrivacySettings } from '../../utils/privacySettings.js'
import {
  getOrCreateDeviceId,
  getOrCreateSessionId,
  getOrCreateClientToken,
  resolveCurrentInternalUserId,
} from '../../utils/userIdentity.js'
import { getProductFromIndexedDB, addPendingScan } from '../../utils/offlineDB.js'
import {
  normalizeDemoProduct,
  normalizeGlobalProduct,
  normalizeCacheProduct,
  normalizeOFFProduct,
  coerceProductEntity,
} from './normalizers.js'
import { isUuid, parseRouteProductRef } from './model.js'

// ─── Session EAN cache (в памяти, сбрасывается при обновлении страницы) ──────
const _eanCache = new Map()
const EAN_CACHE_TTL_MS = 5 * 60 * 1000

// ─── Catalog freshness (выставляется StoreContext после warm-up) ──────────────
let _catalogCachedAt = 0
let _catalogWarmedStoreId = null
const CATALOG_ONLINE_TTL_MS = 60 * 60 * 1000

export function notifyCatalogWarmed(storeId) {
  _catalogCachedAt = Date.now()
  _catalogWarmedStoreId = storeId || null
}

const demoProducts = localProducts.map(normalizeDemoProduct)
const demoById = new Map(demoProducts.map((product) => [product.demoId, product]))
const demoByEan = new Map(demoProducts.map((product) => [product.ean, product]))

export function getDemoProductById(id) {
  return id ? demoById.get(id) || null : null
}

export function getDemoProductByEan(ean) {
  return ean ? demoByEan.get(String(ean)) || null : null
}

export function getAllDemoProducts() {
  return demoProducts.slice()
}

export function getDemoProductForEntity(product) {
  if (!product) return null
  return (
    getDemoProductById(product.demoId || product.id) || getDemoProductByEan(product.ean) || null
  )
}

async function findStoreProduct(ean, storeId) {
  try {
    if (storeId) {
      const { data: gpData } = await supabase
        .from('store_products')
        .select(
          'id, ean, price_kzt, shelf_zone, shelf_position, local_name, local_sku, stock_status, global_product_id, store_id, is_active, global_products!inner(*)'
        )
        .eq('store_id', storeId)
        .eq('is_active', true)
        .eq('global_products.is_active', true)
        .eq('global_products.ean', ean)
        .maybeSingle()

      if (gpData?.global_products) {
        return normalizeGlobalProduct(gpData.global_products, {
          storeProductId: gpData.id,
          priceKzt: gpData.price_kzt || null,
          shelf: [gpData.shelf_zone, gpData.shelf_position].filter(Boolean).join(' / ') || null,
          stockStatus: gpData.stock_status || null,
        })
      }
    }

    let query = supabase
      .from('store_products')
      .select(
        'id, ean, price_kzt, shelf_zone, shelf_position, local_name, local_sku, stock_status, global_product_id, store_id, is_active'
      )
      .eq('ean', ean)
      .eq('is_active', true)

    if (storeId) query = query.eq('store_id', storeId)

    const { data, error } = await query.maybeSingle()
    if (data?.global_product_id) {
      const { data: globalRow, error: globalError } = await supabase
        .from('global_products')
        .select('*')
        .eq('id', data.global_product_id)
        .eq('is_active', true)
        .maybeSingle()

      if (globalRow) {
        return normalizeGlobalProduct(globalRow, {
          storeProductId: data.id,
          priceKzt: data.price_kzt || null,
          shelf: [data.shelf_zone, data.shelf_position].filter(Boolean).join(' / ') || null,
          stockStatus: data.stock_status || null,
        })
      }
    }

    if (storeId) {
      const { data: altStoreData } = await supabase
        .from('store_products')
        .select(
          'id, ean, price_kzt, shelf_zone, shelf_position, stock_status, global_product_id, global_products!inner(*)'
        )
        .eq('store_id', storeId)
        .eq('is_active', true)
        .contains('global_products.alternate_eans', [ean])
        .maybeSingle()

      if (altStoreData?.global_products) {
        return normalizeGlobalProduct(altStoreData.global_products, {
          storeProductId: altStoreData.id,
          priceKzt: altStoreData.price_kzt || null,
          shelf:
            [altStoreData.shelf_zone, altStoreData.shelf_position].filter(Boolean).join(' / ') ||
            null,
          stockStatus: altStoreData.stock_status || null,
        })
      }
    }

    return null
  } catch {
    return null
  }
}

async function findGlobalProductByEan(ean) {
  try {
    const { data, error } = await supabase
      .from('global_products')
      .select('*')
      .eq('ean', ean)
      .eq('is_active', true)
      .maybeSingle()

    if (data) return normalizeGlobalProduct(data)

    const { data: altData, error: altError } = await supabase
      .from('global_products')
      .select('*')
      .contains('alternate_eans', [ean])
      .eq('is_active', true)
      .maybeSingle()

    if (altError || !altData) return null
    return normalizeGlobalProduct(altData)
  } catch {
    return null
  }
}

async function findGlobalProductById(id) {
  try {
    const { data, error } = await supabase
      .from('global_products')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !data) return null
    return normalizeGlobalProduct(data)
  } catch {
    return null
  }
}

async function findCacheProduct(ean) {
  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('external_product_cache')
      .select('*')
      .eq('ean', ean)
      .or(`ttl_expires_at.is.null,ttl_expires_at.gt.${now}`)
      .maybeSingle()

    if (error || !data) return null

    // Atomic increment via RPC (migration 018) — нет race read-modify-write.
    supabase
      .rpc('increment_cache_scan_count', { p_ean: ean })
      .then(() => {})
      .catch(() => {})

    return normalizeCacheProduct(data)
  } catch {
    return null
  }
}

async function fetchFromOFFViaProxy(ean) {
  try {
    const response = await fetch(`/api/off?ean=${encodeURIComponent(ean)}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return null
    const json = await response.json()
    if (!json?.product) return null
    return json.product
  } catch {
    return null
  }
}

async function enrichProduct(product) {
  try {
    const enrichment = await enrichProductAI({ name: product.name, brand: product.brand })
    if (!enrichment) return product
    return coerceProductEntity({
      ...product,
      description: enrichment.description || product.description,
      ingredients: enrichment.ingredients || product.ingredients,
      allergens: enrichment.allergens?.length ? enrichment.allergens : product.allergens,
      dietTags: enrichment.dietTags?.length
        ? [...new Set([...(product.dietTags || []), ...enrichment.dietTags])]
        : product.dietTags,
      sourceMeta: {
        ...product.sourceMeta,
        aiEnriched: true,
      },
    })
  } catch {
    return product
  }
}

async function saveToCache(product, rawPayload = {}) {
  try {
    // Through SECURITY DEFINER RPC (migration 018) — обходит RLS-deny для anon.
    // Раньше прямой upsert от anon всегда падал на RLS → кэш не работал.
    await supabase.rpc('upsert_external_cache', {
      p_ean: product.ean,
      p_source: product.sourceMeta?.externalSource || 'openfoodfacts',
      p_normalized_name: normalizeName(product.name, { brand: product.brand }) || null,
      p_normalized_brand: product.brand || null,
      p_normalized_description: product.description || null,
      p_normalized_category: product.category || null,
      p_normalized_quantity: product.quantity || null,
      p_normalized_ingredients: product.ingredients || null,
      p_normalized_allergens: product.allergens || [],
      p_normalized_diet_tags: product.dietTags || [],
      p_normalized_additives_tags: product.additivesTags || [],
      p_normalized_traces: product.traces || [],
      p_normalized_nutriments: product.nutritionPer100 || {},
      p_image_url: product.image || null,
      p_nutriscore: product.nutriscore || null,
      p_nova_group: product.novaGroup || null,
      p_raw_payload: rawPayload || {},
    })
  } catch {
    // silent: кэш — оптимизация, не блокер
  }
}

async function logMissingProduct(ean, storeId) {
  if (!storeId) return // RPC требует store_id, без него нет смысла в метрике "upset магазина".
  try {
    // Atomic INSERT/INCREMENT via RPC (migration 018) — раньше упсерт сбрасывал
    // scan_count = 1 на каждом повторном скане → дашборд недосчитывал хиты.
    await supabase.rpc('increment_missing_scan_count', { p_ean: ean, p_store_id: storeId })
  } catch {
    // silent
  }
}

async function persistLocalHistory(product, foundStatus, storeId) {
  const privacy = loadPrivacySettings()
  if (!privacy.localHistoryEnabled) return
  if (!product?.ean) return
  const ownerKey = await getCurrentHistoryOwnerKey()
  const entry = buildLocalScanHistoryEntry(product, foundStatus, storeId)
  if (!entry) return
  appendLocalScanHistory(ownerKey, entry)
}

async function logScan({ ean, foundStatus, product, storeId, fitResult }) {
  const privacy = loadPrivacySettings()
  if (!privacy.analyticsEnabled) return

  const globalProductId =
    product?.sourceMeta?.globalProductId || (isUuid(product?.id) ? product.id : null)
  const storeProductId = product?.sourceMeta?.storeProductId || null

  const clientToken = getOrCreateClientToken()

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      const internalUserId = await resolveCurrentInternalUserId({ ensureRow: false })
      await addPendingScan({
        ean,
        found_status: foundStatus,
        global_product_id: globalProductId,
        store_product_id: storeProductId,
        store_id: storeId || null,
        user_id: internalUserId,
        device_id: getOrCreateDeviceId(),
        session_id: getOrCreateSessionId(),
        client_token: clientToken,
        fit_result: fitResult ?? null,
        fit_reasons_json: [],
        app_version: '1.0',
        scanned_at: new Date().toISOString(),
      })
    } catch {
      /* IndexedDB unavailable, scan logged to localHistory only */
    }
    return
  }

  try {
    const internalUserId = await resolveCurrentInternalUserId({ ensureRow: true })
    const { error } = await supabase.from('scan_events').insert({
      ean,
      found_status: foundStatus,
      global_product_id: globalProductId,
      store_product_id: storeProductId,
      store_id: storeId || null,
      user_id: internalUserId,
      fit_result: fitResult ?? null,
      device_id: getOrCreateDeviceId(),
      session_id: getOrCreateSessionId(),
      client_token: clientToken,
      app_version: '1.0',
    })
    if (error) console.error('logScan error', error)
  } catch (error) {
    console.error('logScan error', error)
  }
}

async function finalizeResolvedProduct(
  product,
  { ean, foundStatus, storeId, fitResult, logScan: shouldLog }
) {
  if (!shouldLog) return product

  // Fire-and-forget: не блокируем навигацию на аналитике
  Promise.allSettled([
    persistLocalHistory(product, foundStatus, storeId),
    logScan({ ean, foundStatus, product, storeId, fitResult }),
  ]).catch(() => {})

  return product
}

// ─── Один RPC-вызов вместо 2-4 последовательных Supabase-запросов ────────────
async function findProductViaRPC(ean, storeId) {
  try {
    const { data, error } = await supabase.rpc('fn_resolve_product_by_ean', {
      p_ean: ean,
      p_store_id: storeId || null,
    })
    if (error) return { _rpcUnavailable: true } // migration 026 не применена → fallback
    if (!data) return null
    const storeOverlay = data._sp_id
      ? {
          storeProductId: data._sp_id,
          priceKzt: data._sp_price_kzt || null,
          shelf: [data._sp_shelf_zone, data._sp_shelf_position].filter(Boolean).join(' / ') || null,
          stockStatus: data._sp_stock_status || null,
        }
      : null
    return normalizeGlobalProduct(data, storeOverlay)
  } catch {
    return { _rpcUnavailable: true }
  }
}

// ─── Внутренняя реализация резолвера (без session-кэша — он в обёртке ниже) ──
async function _resolveProductByEanImpl(normalizedEan, storeId, options) {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

  try {
    const cachedProduct = await getProductFromIndexedDB(normalizedEan)
    if (cachedProduct) {
      const coerced = coerceProductEntity({
        ...cachedProduct,
        source: cachedProduct.source || 'offline_cache',
        sourceMeta: {
          ...(cachedProduct.sourceMeta || {}),
          fromCache: true,
        },
      })
      const catalogFresh =
        _catalogWarmedStoreId === storeId && Date.now() - _catalogCachedAt < CATALOG_ONLINE_TTL_MS
      if (isOffline || catalogFresh) {
        return finalizeResolvedProduct(coerced, {
          ean: normalizedEan,
          foundStatus: cachedProduct.storeProductId ? 'found_store' : 'found_global',
          storeId: cachedProduct.store_id || storeId,
          fitResult: options.fitResult,
          logScan: options.logScan,
        })
      }
    }
  } catch {
    /* IndexedDB unavailable, proceed with network cascade */
  }

  if (storeId) {
    const localStoreProduct = coerceProductEntity(
      getStoreCatalogProductByEan(storeId, normalizedEan)
    )
    if (localStoreProduct) {
      return finalizeResolvedProduct(localStoreProduct, {
        ean: normalizedEan,
        foundStatus: 'found_store',
        storeId,
        fitResult: options.fitResult,
        logScan: options.logScan,
      })
    }
  }

  // Primary: единый RPC (migration 026) — заменяет findStoreProduct + findGlobalProductByEan
  const rpcResult = await findProductViaRPC(normalizedEan, storeId)
  if (rpcResult && !rpcResult._rpcUnavailable) {
    return finalizeResolvedProduct(rpcResult, {
      ean: normalizedEan,
      foundStatus: rpcResult.source === 'store' ? 'found_store' : 'found_global',
      storeId,
      fitResult: options.fitResult,
      logScan: options.logScan,
    })
  }

  // Fallback: прямые запросы (если migration 026 ещё не применена)
  if (rpcResult?._rpcUnavailable) {
    if (storeId) {
      const storeProduct = await findStoreProduct(normalizedEan, storeId)
      if (storeProduct) {
        return finalizeResolvedProduct(storeProduct, {
          ean: normalizedEan,
          foundStatus: 'found_store',
          storeId,
          fitResult: options.fitResult,
          logScan: options.logScan,
        })
      }
    }
    const globalProduct = await findGlobalProductByEan(normalizedEan)
    if (globalProduct) {
      return finalizeResolvedProduct(globalProduct, {
        ean: normalizedEan,
        foundStatus: 'found_global',
        storeId,
        fitResult: options.fitResult,
        logScan: options.logScan,
      })
    }
  }

  const demoProduct = coerceProductEntity(
    getGlobalProductByEan(normalizedEan) || getDemoProductByEan(normalizedEan)
  )
  if (demoProduct) {
    return finalizeResolvedProduct(demoProduct, {
      ean: normalizedEan,
      foundStatus: 'found_global',
      storeId,
      fitResult: options.fitResult,
      logScan: options.logScan,
    })
  }

  if (isOffline) {
    if (options.logScan) {
      await Promise.allSettled([
        logScan({
          ean: normalizedEan,
          foundStatus: 'not_found',
          product: null,
          storeId,
          fitResult: options.fitResult,
        }),
        logMissingProduct(normalizedEan, storeId),
      ])
    }
    return null
  }

  const cachedProduct = await findCacheProduct(normalizedEan)
  if (cachedProduct) {
    return finalizeResolvedProduct(cachedProduct, {
      ean: normalizedEan,
      foundStatus: 'found_cache',
      storeId,
      fitResult: options.fitResult,
      logScan: options.logScan,
    })
  }

  const offProductRaw = await fetchFromOFFViaProxy(normalizedEan)
  if (offProductRaw) {
    let product = normalizeOFFProduct(normalizedEan, offProductRaw)
    product = await enrichProduct(product)
    await saveToCache(product, offProductRaw)
    return finalizeResolvedProduct(product, {
      ean: normalizedEan,
      foundStatus: 'found_off',
      storeId,
      fitResult: options.fitResult,
      logScan: options.logScan,
    })
  }

  if (options.logScan) {
    await Promise.allSettled([
      logScan({
        ean: normalizedEan,
        foundStatus: 'not_found',
        product: null,
        storeId,
        fitResult: options.fitResult,
      }),
      logMissingProduct(normalizedEan, storeId),
    ])
  }

  return null
}

// ─── Публичный резолвер: session EAN cache → _resolveProductByEanImpl ─────────
export async function resolveProductByEan(ean, storeId = null, options = {}) {
  const normalizedEan = String(ean || '').trim()
  if (!normalizedEan) return null

  const cacheKey = `${normalizedEan}:${storeId || ''}`
  const hit = _eanCache.get(cacheKey)
  if (hit && Date.now() - hit.ts < EAN_CACHE_TTL_MS) {
    if (options.logScan) {
      const fs = hit.product?.source === 'store' ? 'found_store' : 'found_global'
      Promise.allSettled([
        persistLocalHistory(hit.product, fs, storeId),
        logScan({
          ean: normalizedEan,
          foundStatus: fs,
          product: hit.product,
          storeId,
          fitResult: options.fitResult,
        }),
      ]).catch(() => {})
    }
    return hit.product
  }

  const product = await _resolveProductByEanImpl(normalizedEan, storeId, options)
  if (product) _eanCache.set(cacheKey, { product, ts: Date.now() })
  return product
}

export async function resolveProductByRef(ref = {}, storeId = null) {
  const routeRef =
    ref.canonicalId && !ref.id && !ref.ean && !ref.demoId
      ? parseRouteProductRef(ref.canonicalId)
      : ref

  const demoId = routeRef.demoId || null
  const globalId = routeRef.id && isUuid(routeRef.id) ? routeRef.id : null
  const ean = routeRef.ean || null

  if (demoId) {
    const demoProduct = getDemoProductById(demoId)
    if (demoProduct) return demoProduct
  }

  if (globalId) {
    const globalProduct = await findGlobalProductById(globalId)
    if (globalProduct) return globalProduct
  }

  if (ean) {
    return resolveProductByEan(ean, storeId, { logScan: false })
  }

  if (routeRef.canonicalId) {
    const parsed = parseRouteProductRef(routeRef.canonicalId)
    if (parsed.demoId) {
      const demoProduct = getDemoProductById(parsed.demoId)
      if (demoProduct) return demoProduct
    }
    if (parsed.id) {
      const globalProduct = await findGlobalProductById(parsed.id)
      if (globalProduct) return globalProduct
    }
    if (parsed.ean) {
      return resolveProductByEan(parsed.ean, storeId, { logScan: false })
    }
  }

  return null
}

export async function hydrateProductsFromScanRows(rows) {
  return hydrateProductRefs(
    rows.map((row) => ({ ...row, scannedAt: row.scanned_at || row.created_at || null }))
  )
}

export async function hydrateProductsFromFavoriteRows(rows) {
  return hydrateProductRefs(
    rows.map((row) => ({ ...row, favoredAt: row.added_at || row.created_at || null }))
  )
}

async function hydrateProductRefs(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []

  const uniqueRefs = []
  const seenKeys = new Set()
  for (const row of rows) {
    const key = row.ean || row.global_product_id || row.id
    if (!key || seenKeys.has(key)) continue
    seenKeys.add(key)
    uniqueRefs.push(row)
  }

  const globalIds = [...new Set(uniqueRefs.map((row) => row.global_product_id).filter(Boolean))]
  const eans = [...new Set(uniqueRefs.map((row) => row.ean).filter(Boolean))]

  const globalById = new Map()
  const globalByEan = new Map()
  const cacheByEan = new Map()

  if (globalIds.length) {
    const { data } = await supabase.from('global_products').select('*').in('id', globalIds)
    for (const row of data || []) {
      const product = normalizeGlobalProduct(row)
      globalById.set(row.id, product)
      if (row.ean) globalByEan.set(row.ean, product)
    }
  }

  const missingGlobalEans = eans.filter((ean) => !globalByEan.has(ean))
  if (missingGlobalEans.length) {
    const { data } = await supabase.from('global_products').select('*').in('ean', missingGlobalEans)
    for (const row of data || []) {
      const product = normalizeGlobalProduct(row)
      globalById.set(row.id, product)
      if (row.ean) globalByEan.set(row.ean, product)
    }
  }

  const missingCacheEans = eans.filter((ean) => !globalByEan.has(ean) && !demoByEan.has(ean))
  if (missingCacheEans.length) {
    const { data } = await supabase
      .from('external_product_cache')
      .select('*')
      .in('ean', missingCacheEans)
    for (const row of data || []) {
      cacheByEan.set(row.ean, normalizeCacheProduct(row))
    }
  }

  return uniqueRefs.map((row) => {
    let product = null
    if (row.global_product_id && globalById.has(row.global_product_id))
      product = globalById.get(row.global_product_id)
    if (!product && row.ean && globalByEan.has(row.ean)) product = globalByEan.get(row.ean)
    if (!product && row.ean) product = coerceProductEntity(getGlobalProductByEan(row.ean)) || null
    if (!product && row.ean && demoByEan.has(row.ean)) product = demoByEan.get(row.ean)
    if (!product && row.ean && cacheByEan.has(row.ean)) product = cacheByEan.get(row.ean)
    if (!product && row.ean)
      product = coerceProductEntity({ ean: row.ean, name: `Товар ${row.ean}`, source: 'unknown' })
    if (!product && row.global_product_id)
      product = coerceProductEntity({
        id: row.global_product_id,
        name: 'Неизвестный товар',
        source: 'unknown',
      })

    return {
      ...product,
      scanDate: row.scannedAt ? new Date(row.scannedAt) : null,
      favDate: row.favoredAt ? new Date(row.favoredAt) : null,
    }
  })
}
