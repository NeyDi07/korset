import { ALLERGEN_NAMES } from './profile.js'
import products from '../data/products.json'

/**
 * Returns { fits: bool, reasons: [{type, text}] }
 */
export function checkProductFit(product, profile) {
  const reasons = []

  // Halal check
  const halalOn = profile.religion?.includes('halal') || profile.halalOnly
  if (halalOn && product.halal === 'no') {
    reasons.push({ type: 'fail', text: 'Не является халал' })
  }

  // Allergen check
  if (profile.allergens?.length > 0) {
    const found = (product.allergens || []).filter((a) => profile.allergens.includes(a))
    found.forEach((a) => reasons.push({ type: 'fail', text: `Содержит аллерген: ${ALLERGEN_NAMES[a] || a}` }))
  }

  // Diet goals check
  const dietGoals = profile.dietGoals || []
  const sugarFreeOn = dietGoals.includes('sugar_free') || profile.sugarFree
  if (sugarFreeOn) {
    if ((product.dietTags || []).includes('contains_sugar')) {
      reasons.push({ type: 'fail', text: 'Содержит добавленный сахар' })
    }
  }

  if (dietGoals.includes('dairy_free') && (product.dietTags || []).includes('contains_dairy')) {
    reasons.push({ type: 'fail', text: 'Содержит молочные продукты' })
  }
  if (dietGoals.includes('gluten_free') && (product.dietTags || []).includes('contains_gluten')) {
    reasons.push({ type: 'fail', text: 'Содержит глютен' })
  }
  if (
    dietGoals.includes('vegan') &&
    ((product.dietTags || []).includes('contains_dairy') ||
      (product.allergens || []).includes('eggs') ||
      (product.allergens || []).includes('milk'))
  ) {
    reasons.push({ type: 'fail', text: 'Не подходит для веганов' })
  }

  const fits = reasons.length === 0

  // Positive reasons (keep short)
  if (fits) {
    if (halalOn && product.halal === 'yes') reasons.push({ type: 'pass', text: 'Халал ✓' })

    if (profile.allergens?.length > 0) {
      const found = (product.allergens || []).filter((a) => profile.allergens.includes(a))
      if (found.length === 0) reasons.push({ type: 'pass', text: 'Без ваших аллергенов ✓' })
    }

    if (sugarFreeOn && ((product.dietTags || []).includes('sugar_free') || (product.dietTags || []).includes('no_sugar'))) {
      reasons.push({ type: 'pass', text: 'Без сахара ✓' })
    }

    if ((product.qualityScore || 0) >= 85) reasons.push({ type: 'pass', text: `Качество: ${product.qualityScore}/100` })

    if (reasons.length === 0) reasons.push({ type: 'pass', text: 'Соответствует вашим предпочтениям' })
  }

  return { fits, reasons: reasons.slice(0, 3) }
}

/**
 * Returns up to 3 alternatives that fit the profile.
 * MVP rule: prefer similar items (family/subtype) rather than random products.
 */
export function getAlternatives(product, profile) {
  if (!product) return []

  const candidates = products.filter((p) => {
    if (p.id === product.id) return false
    const { fits } = checkProductFit(p, profile)
    return fits
  })

  const sameFamily = candidates.filter((p) => p.family && product.family && p.family === product.family)
  const sameSubtype = sameFamily.filter((p) => p.subtype && product.subtype && p.subtype === product.subtype)

  let pool = []
  if (sameSubtype.length >= 2) pool = sameSubtype
  else if (sameFamily.length >= 2) pool = sameFamily
  else {
    // fallback to category
    const sameCategory = candidates.filter((p) => p.category === product.category)
    const others = candidates.filter((p) => p.category !== product.category)
    pool = [...sameCategory, ...others]
  }

  // Sort by priority
  if (profile.priority === 'price') {
    pool.sort((a, b) => (a.priceKzt || 0) - (b.priceKzt || 0))
  } else if (profile.priority === 'balanced') {
    pool.sort((a, b) => {
      const sa = (a.qualityScore || 0) / Math.max(1, (a.priceKzt || 0) / 1000)
      const sb = (b.qualityScore || 0) / Math.max(1, (b.priceKzt || 0) / 1000)
      return sb - sa
    })
  } else {
    pool.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
  }

  return pool.slice(0, 3).map((p) => ({
    ...p,
    whyFits: buildWhyFits(p, profile, product),
  }))
}

function buildWhyFits(product, profile, base) {
  const dietGoals = profile.dietGoals || []
  const sugarFreeOn = dietGoals.includes('sugar_free') || profile.sugarFree

  if (base?.family && product.family === base.family) {
    if (base?.subtype && product.subtype === base.subtype) return 'Похожий товар в этой категории'
    return 'Похожая категория товара'
  }
  if (profile.halalOnly && product.halal === 'yes') return 'Халал ✓'
  if (sugarFreeOn && ((product.dietTags || []).includes('sugar_free') || (product.dietTags || []).includes('no_sugar'))) return 'Без сахара ✓'
  if (profile.priority === 'price') return 'Дешевле — выгоднее'
  if (profile.priority === 'balanced') return 'Хороший баланс цены и качества'
  return `Качество ${product.qualityScore || 0}/100`
}

export function formatPrice(kzt) {
  return (kzt || 0).toLocaleString('ru-RU') + ' ₸'
}

export const CATEGORY_LABELS = {
  grocery: 'Продукты',
  electronics: 'Электроника',
  diy: 'Стройматериалы',
}

export const CATEGORY_LABELS_SHORT = {
  grocery: 'Продукты',
  electronics: 'Электроника',
  diy: 'Стройка',
}