import { supabase } from './supabase.js'
import { parseJson } from '../domain/product/model.js'
import { enrichQuantity } from './parseQuantity.js'

function cloneProduct(product) {
  return product ? JSON.parse(JSON.stringify(product)) : null
}

function getAllKnownEans(product) {
  const eans = [
    product?.ean,
    ...(Array.isArray(product?.alternateEans) ? product.alternateEans : []),
    ...(Array.isArray(product?.alternate_eans) ? product.alternate_eans : []),
  ]
  return [...new Set(eans.filter(Boolean).map(String))]
}

function matchesProductEan(product, ean) {
  if (!product || !ean) return false
  return getAllKnownEans(product).includes(String(ean))
}

function applyStoreOverlay(product, overlay = null, storeSlug = null) {
  if (!product) return null
  const next = cloneProduct(product)
  const priceKzt = overlay?.priceKzt ?? null
  const shelf = overlay?.shelf ?? null
  const stockStatus = overlay?.stockStatus ?? null
  const isStoreProduct = Boolean(storeSlug && overlay)

  return {
    ...next,
    priceKzt,
    shelf,
    stockStatus,
    isStoreProduct,
    storeSlug: storeSlug || null,
    canonicalId: next.ean || next.id,
    image: next.image || next.images?.[0] || null,
  }
}

export function getGlobalDemoProducts() {
  return []
}

export function getStoreCatalogProducts(storeSlug) {
  return []
}

export function getGlobalProductByEan(_ean) {
  return null
}

export function getStoreCatalogProductByEan(_storeSlug, _ean) {
  return null
}

export function getAnyKnownProductByRef(_ref, _storeSlug = null) {
  return null
}

export function getProductByEan(ean, storeSlug = null) {
  return getAnyKnownProductByRef(ean, storeSlug)
}

export function isStoreCatalogProduct(storeSlug, ean) {
  return Boolean(getStoreCatalogProductByEan(storeSlug, ean))
}

export function getAllKnownEansForProduct(product) {
  return getAllKnownEans(product)
}

export async function getStoreCatalogProductsFromDB(storeId) {
  if (!storeId) return []
  const { data, error } = await supabase
    .from('store_products')
    .select(
      `
      *,
      global_products (
         id, ean, name, name_kz, brand, category, subcategory,
         quantity, image_url, images, ingredients_raw, ingredients_kz,
          description, allergens_json, diet_tags_json, halal_status,
          packaging_type, fat_percent,
          additives_tags_json, traces_json, categories_tags_json, tags_json,
         nutriments_json, alcohol_100g, saturated_fat_100g, nova_group,
         image_ingredients_url, image_nutrition_url,
         manufacturer, country_of_origin, specs_json,
         nutriscore, data_quality_score, source_primary, source_confidence,
         is_verified, needs_review, group, alternate_eans
      )
    `
    )
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((sp) =>
    enrichQuantity({
      id: sp.id,
      storeProductId: sp.id,
      storeId: sp.store_id,
      ean: sp.global_products?.ean || sp.ean,
      priceKzt: sp.price_kzt || null,
      stockStatus: sp.stock_status,
      shelfZone: sp.shelf_zone,
      shelfPosition: sp.shelf_position,
      isPromoted: sp.is_promoted,
      localName: sp.local_name,
      localSku: sp.local_sku,
      name: sp.global_products?.name || sp.local_name || sp.ean,
      nameKz: sp.global_products?.name_kz || null,
      brand: sp.global_products?.brand || null,
      category: sp.global_products?.category || null,
      subcategory: sp.global_products?.subcategory || null,
      quantity: sp.global_products?.quantity || null,
      group: sp.global_products?.group || null,
      image: sp.global_products?.image_url || sp.global_products?.images?.[0] || null,
      imageUrl: sp.global_products?.image_url || null,
      images: parseJson(sp.global_products?.images, []),
      description: sp.global_products?.description || null,
      ingredients: sp.global_products?.ingredients_raw || null,
      ingredientsKz: sp.global_products?.ingredients_kz || null,
      allergens: parseJson(sp.global_products?.allergens_json, []),
      dietTags: parseJson(sp.global_products?.diet_tags_json, []),
      tags: parseJson(sp.global_products?.tags_json, []),
      additivesTags: parseJson(sp.global_products?.additives_tags_json, []),
      traces: parseJson(sp.global_products?.traces_json, []),
      categoriesTags: parseJson(sp.global_products?.categories_tags_json, []),
      nutritionPer100: parseJson(sp.global_products?.nutriments_json, null),
      alcohol100g: sp.global_products?.alcohol_100g ?? null,
      saturatedFat100g: sp.global_products?.saturated_fat_100g ?? null,
      novaGroup: sp.global_products?.nova_group ?? null,
      imageIngredientsUrl: sp.global_products?.image_ingredients_url || null,
      imageNutritionUrl: sp.global_products?.image_nutrition_url || null,
      manufacturer: sp.global_products?.manufacturer
        ? { name: sp.global_products.manufacturer, country: sp.global_products.country_of_origin }
        : null,
      specs: parseJson(sp.global_products?.specs_json, null),
      halalStatus: sp.global_products?.halal_status || 'unknown',
      packagingType: sp.global_products?.packaging_type || null,
      fatPercent: sp.global_products?.fat_percent ?? null,
      nutriscore: sp.global_products?.nutriscore || null,
      qualityScore: sp.global_products?.data_quality_score ?? 0,
      sourceConfidence: sp.global_products?.source_confidence ?? null,
      sourcePrimary: sp.global_products?.source_primary || null,
      isVerified: sp.global_products?.is_verified || false,
      needsReview: sp.global_products?.needs_review || false,
      isStoreProduct: true,
      canonicalId: sp.ean,
      alternateEans: parseJson(sp.global_products?.alternate_eans, []),
    })
  )
}
