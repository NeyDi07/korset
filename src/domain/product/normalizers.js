import { getImageUrl } from '../../utils/imageUrl.js'
import {
  createEmptyProduct,
  normalizeStringArray,
  normalizeNutrition,
  normalizeManufacturer,
  normalizeSpecs,
  normalizeHalalStatus,
  normalizeNutriscore,
  parseJson,
  withProductImage,
} from './model.js'
import { enrichQuantity } from '../../utils/parseQuantity.js'
import { OFF_ALLERGEN_MAP as CANONICAL_OFF_MAP } from '../../constants/allergens.js'

// Используем единственный источник истины (allergens.js) — раньше здесь был
// УСТАРЕВШИЙ дубликат, который маппил OFF-теги в legacy ID:
//   • 'en:nuts'        → 'nuts'      (а должно tree_nuts)        — пользователи с аллергией на орехи получали safe
//   • 'en:crustaceans' → 'shellfish' (а должно crustaceans)      — пользователи с аллергией на ракообразные тоже
//   • 6 ТР ТС аллергенов вообще не покрывались (mollusks/sesame/celery/mustard/lupin/sulfites)
// В сумме >50% обязательных аллергенов терялось при импорте из OpenFoodFacts.
// Дополнения локальные:
const OFF_ALLERGEN_MAP = {
  ...CANONICAL_OFF_MAP,
  'en:soy': 'soy', // alias для en:soybeans (встречается в старых дампах OFF)
}

export function normalizeGlobalProduct(row, storeOverlay = null) {
  const product = enrichQuantity(
    createEmptyProduct({
      source: storeOverlay ? 'store' : 'global',
      id: row.id,
      ean: row.ean,
      alternateEans: normalizeStringArray(parseJson(row.alternate_eans, [])),
      name: row.name,
      nameKz: row.name_kz || null,
      brand: row.brand,
      category: row.category || 'grocery',
      subcategory: row.subcategory || null,
      quantity: row.quantity || null,
      group: row.group || null,
      images: Array.isArray(row.images) ? row.images : parseJson(row.images, []),
      image: getImageUrl(row.image_url) || null,
      description: row.description || null,
      ingredients: row.ingredients_raw || null,
      ingredientsKz: row.ingredients_kz || null,
      allergens: normalizeStringArray(parseJson(row.allergens_json, [])),
      dietTags: normalizeStringArray(parseJson(row.diet_tags_json, [])),
      tags: normalizeStringArray(parseJson(row.tags_json, [])),
      additivesTags: normalizeStringArray(parseJson(row.additives_tags_json, [])),
      traces: normalizeStringArray(parseJson(row.traces_json, [])),
      categoriesTags: normalizeStringArray(parseJson(row.categories_tags_json, [])),
      halalStatus: row.halal_status,
      packagingType: row.packaging_type || null,
      fatPercent: row.fat_percent ?? null,
      nutritionPer100: normalizeNutrition(row.nutriments_json),
      alcohol100g: row.alcohol_100g ?? null,
      saturatedFat100g: row.saturated_fat_100g ?? null,
      novaGroup: row.nova_group ?? null,
      imageIngredientsUrl: row.image_ingredients_url || null,
      imageNutritionUrl: row.image_nutrition_url || null,
      manufacturer: normalizeManufacturer(row.manufacturer, row.country_of_origin),
      specs: normalizeSpecs(row.specs_json),
      priceKzt: storeOverlay?.priceKzt ?? null,
      shelf: storeOverlay?.shelf ?? null,
      stockStatus: storeOverlay?.stockStatus ?? null,
      nutriscore: row.nutriscore,
      qualityScore: row.data_quality_score ?? null,
      sourceConfidence: row.source_confidence ?? null,
      sourceMeta: {
        globalProductId: row.id,
        storeProductId: storeOverlay?.storeProductId || null,
        cacheId: null,
        externalSource: row.source_primary || null,
        isVerified: Boolean(row.is_verified),
        needsReview: Boolean(row.needs_review),
        qualityScore: row.data_quality_score ?? null,
        aiEnriched: row.source_primary === 'ai_enriched',
        lastUpdatedAt: row.updated_at || row.created_at || null,
      },
    })
  )
  return withProductImage(product)
}

export function normalizeCacheProduct(row) {
  const product = enrichQuantity(
    createEmptyProduct({
      source: 'cache',
      ean: row.ean,
      name: row.normalized_name || `Товар ${row.ean}`,
      brand: row.normalized_brand || null,
      category: row.normalized_category || null,
      quantity: row.normalized_quantity || null,
      images: row.image_url ? [getImageUrl(row.image_url)] : [],
      description: row.normalized_description || null,
      ingredients: row.normalized_ingredients || null,
      allergens: normalizeStringArray(parseJson(row.normalized_allergens_json, [])),
      dietTags: normalizeStringArray(parseJson(row.normalized_diet_tags_json, [])),
      additivesTags: normalizeStringArray(parseJson(row.normalized_additives_tags_json, [])),
      traces: normalizeStringArray(parseJson(row.normalized_traces_json, [])),
      nutritionPer100: normalizeNutrition(row.normalized_nutriments_json),
      novaGroup: row.nova_group ?? null,
      nutriscore: row.nutriscore,
      sourceMeta: {
        globalProductId: row.global_product_id || null,
        storeProductId: null,
        cacheId: row.id || null,
        externalSource: row.source || 'openfoodfacts',
        isVerified: false,
        needsReview: true,
        qualityScore: null,
        aiEnriched: false,
        lastUpdatedAt: row.updated_at || row.cached_at || null,
      },
    })
  )
  return withProductImage(product)
}

// @deprecated — OFF removed; kept for reference only
function _normalizeOFFProduct_UNUSED(ean, product, enrichment = null) {
  const allergens = [
    ...new Set(
      (product.allergens_tags || product.allergens_hierarchy || [])
        .map((item) => OFF_ALLERGEN_MAP[item])
        .filter(Boolean)
    ),
  ]
  const traces = [
    ...new Set((product.traces_tags || []).map((item) => OFF_ALLERGEN_MAP[item]).filter(Boolean)),
  ]
  const labels = product.labels_tags || []
  const dietTags = []
  if (labels.some((label) => /vegan/i.test(label))) dietTags.push('vegan')
  if (labels.some((label) => /vegetarian/i.test(label))) dietTags.push('vegetarian')
  if (labels.some((label) => /halal/i.test(label))) dietTags.push('halal')
  if (labels.some((label) => /gluten.free/i.test(label))) dietTags.push('gluten_free')
  const additivesTags = (product.additives_tags || []).map((t) => t.replace(/^en:/, ''))

  const base = createEmptyProduct({
    source: 'off',
    ean,
    name:
      (
        product.product_name_ru ||
        product.product_name ||
        product.product_name_en ||
        product.product_name_kk ||
        ''
      ).trim() || `Товар ${ean}`,
    brand: (product.brands || '').trim() || null,
    quantity: product.quantity || null,
    images: product.image_front_url ? [product.image_front_url] : [],
    ingredients: product.ingredients_text_ru || product.ingredients_text || null,
    allergens,
    traces,
    additivesTags,
    categoriesTags: product.categories_tags || [],
    dietTags,
    halalStatus: labels.some((label) => /halal/i.test(label)) ? 'yes' : 'unknown',
    nutritionPer100: normalizeNutrition(product.nutriments || {}),
    novaGroup: product.nova_group ?? null,
    imageIngredientsUrl: product.image_ingredients_url || null,
    imageNutritionUrl: product.image_nutrition_url || null,
    nutriscore: product.nutriscore_grade,
    description: enrichment?.description || null,
    sourceMeta: {
      globalProductId: null,
      storeProductId: null,
      cacheId: null,
      externalSource: 'openfoodfacts',
      isVerified: false,
      needsReview: true,
      qualityScore: null,
      aiEnriched: Boolean(enrichment),
      lastUpdatedAt: null,
    },
  })

  const enriched = createEmptyProduct({
    ...base,
    description: enrichment?.description || base.description,
    ingredients: enrichment?.ingredients || base.ingredients,
    allergens: enrichment?.allergens?.length ? enrichment.allergens : base.allergens,
    dietTags: enrichment?.dietTags?.length
      ? [...new Set([...base.dietTags, ...enrichment.dietTags])]
      : base.dietTags,
    sourceMeta: {
      ...base.sourceMeta,
      aiEnriched: Boolean(enrichment),
    },
  })

  return withProductImage(enrichQuantity(enriched))
}

export function coerceProductEntity(productLike) {
  if (!productLike) return null
  if (productLike.canonicalId && productLike.sourceMeta)
    return withProductImage(enrichQuantity(createEmptyProduct(productLike)))

  const hasGlobalShape =
    productLike.ean &&
    ('halalStatus' in productLike ||
      'nutritionPer100' in productLike ||
      'sourceMeta' in productLike ||
      'qualityScore' in productLike)
  if (hasGlobalShape) return withProductImage(enrichQuantity(createEmptyProduct(productLike)))

  if (productLike.normalized_name || productLike.normalized_nutriments_json)
    return normalizeCacheProduct(productLike)
  if (productLike.ingredients_raw || productLike.halal_status || productLike.nutriments_json)
    return normalizeGlobalProduct(productLike)

  return withProductImage(enrichQuantity(createEmptyProduct(productLike)))
}
