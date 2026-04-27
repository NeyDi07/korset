const WEIGHT_UNITS = ['г', 'гр', 'кг', 'грамм', 'килограмм', 'g', 'kg']
const VOLUME_UNITS = ['мл', 'л', 'миллилитр', 'литр', 'ml', 'l', 'L']
const PIECES_UNITS = [
  'шт',
  'дана',
  'данасы',
  'пак',
  'саше',
  'таблеток',
  'капсул',
  'порций',
  'пакетиков',
  'pcs',
]

const UNIT_BOUNDARY = '(?![a-zA-Zа-яёА-ЯЁ0-9])'

const ALL_UNITS_RE =
  '(\\d+[.,]?\\d*)\\s*(килограмм|миллилитр|литр|грамм|данасы|таблеток|капсул|порций|пакетиков|кг|мл|гр|дана|пак|шт|саше|г|л|kg|ml|pcs|g|l|L)' +
  UNIT_BOUNDARY

const BARE_UNITS_RE = '(?:^|[\\s,;])(кг|л)\\s*$'

const PERCENT_RE = /\d+[.,]?\d*\s*%/g

const UNIT_TYPE_MAP = {}
const GARBAGE_QUANTITY = new Set(['вес', 'weight', 'весовой', '-'])
for (const u of WEIGHT_UNITS) UNIT_TYPE_MAP[u] = 'weight'
for (const u of VOLUME_UNITS) UNIT_TYPE_MAP[u] = 'volume'
for (const u of PIECES_UNITS) UNIT_TYPE_MAP[u] = 'pieces'

const CANONICAL_UNIT = {
  г: 'г',
  гр: 'г',
  кг: 'кг',
  грамм: 'г',
  килограмм: 'кг',
  g: 'г',
  kg: 'кг',
  мл: 'мл',
  л: 'л',
  миллилитр: 'мл',
  литр: 'л',
  ml: 'мл',
  l: 'л',
  L: 'л',
  шт: 'шт',
  дана: 'шт',
  данасы: 'шт',
  пак: 'пак',
  саше: 'саше',
  таблеток: 'таблеток',
  капсул: 'капсул',
  порций: 'порций',
  пакетиков: 'пакетиков',
  pcs: 'шт',
}

export function parseQuantityTokens(text) {
  if (!text || typeof text !== 'string') return null

  let tail = text.slice(-60)
  tail = tail.replace(PERCENT_RE, ' ')

  const tokens = []

  const numRe = new RegExp(ALL_UNITS_RE, 'gi')
  let m
  while ((m = numRe.exec(tail)) !== null) {
    const rawNum = m[1].replace(',', '.')
    const num = Number(rawNum)
    if (!Number.isFinite(num) || num <= 0) continue
    const rawUnit = m[2].toLowerCase()
    const canonical = CANONICAL_UNIT[rawUnit]
    if (!canonical) continue
    const unitType = UNIT_TYPE_MAP[rawUnit]
    if (!unitType) continue

    const isWeightByWeight = false
    const dup = tokens.some(
      (t) => t.value === num && t.unit === canonical && t.unitType === unitType
    )
    if (!dup) {
      tokens.push({ value: num, unit: canonical, unitType, isWeightByWeight })
    }
  }

  if (tokens.length === 0) {
    const bareRe = new RegExp(BARE_UNITS_RE, 'i')
    const bareMatch = tail.match(bareRe)
    if (bareMatch) {
      const rawUnit = bareMatch[1].toLowerCase()
      const canonical = CANONICAL_UNIT[rawUnit]
      const unitType = UNIT_TYPE_MAP[rawUnit]
      if (canonical && unitType) {
        tokens.push({ value: null, unit: canonical, unitType, isWeightByWeight: true })
      }
    }
  }

  return tokens.length > 0 ? tokens : null
}

export function normalizeQuantityString(str) {
  if (!str || typeof str !== 'string') return null
  const trimmed = str.trim()
  if (GARBAGE_QUANTITY.has(trimmed.toLowerCase())) return null

  const tokens = parseQuantityTokens(trimmed)
  if (tokens && tokens.length > 0 && !tokens[0].isWeightByWeight) {
    return tokens.map((t) => `${String(t.value).replace('.', ',')} ${t.unit}`).join(', ')
  }

  return trimmed
}

function pickPrimary(tokens) {
  if (!tokens || tokens.length === 0) return null
  const weightOrVolume = tokens.find((t) => t.unitType === 'weight' || t.unitType === 'volume')
  return weightOrVolume || tokens[0]
}

function pickPieces(tokens, primary) {
  if (!tokens || tokens.length <= 1) return null
  if (primary && primary.unitType === 'pieces') return null
  return tokens.find((t) => t.unitType === 'pieces') || null
}

const KZ_UNIT = {
  шт: 'дана',
  таблеток: 'таблетка',
  капсул: 'капсула',
  порций: 'порция',
  пакетиков: 'пакет',
}

export function enrichQuantity(product) {
  if (!product) return product

  let tokens = null
  let source = null

  const dbNorm = normalizeQuantityString(product.quantity)
  if (dbNorm && typeof dbNorm === 'string') {
    tokens = parseQuantityTokens(dbNorm)
    if (tokens) source = 'db'
  }

  if (!tokens && product.name) {
    tokens = parseQuantityTokens(product.name)
    if (tokens) source = 'name'
  }

  if (!tokens && product.nameKz) {
    tokens = parseQuantityTokens(product.nameKz)
    if (tokens) source = 'nameKz'
  }

  if (!tokens && product.specs?.weight) {
    const wNorm = normalizeQuantityString(product.specs.weight)
    if (wNorm && typeof wNorm === 'string') {
      tokens = parseQuantityTokens(wNorm)
      if (tokens) source = 'specs'
    }
  }

  if (!tokens) {
    product.quantityParsed = null
    return product
  }

  const primary = pickPrimary(tokens)
  const pieces = pickPieces(tokens, primary)

  product.quantityParsed = {
    value: primary.value,
    unit: primary.unit,
    unitType: primary.unitType,
    isWeightByWeight: primary.isWeightByWeight || false,
    pieces: pieces ? pieces.value : null,
    piecesUnit: pieces ? pieces.unit : null,
    source,
  }

  return product
}

export function formatQuantityDisplay(quantityParsed, lang) {
  if (!quantityParsed) return null
  const { value, unit, isWeightByWeight, pieces, piecesUnit } = quantityParsed

  if (isWeightByWeight) {
    return lang === 'kz' ? 'кг үшін' : 'за кг'
  }

  const displayUnit = lang === 'kz' && KZ_UNIT[unit] ? KZ_UNIT[unit] : unit
  const valueStr = value != null ? String(value).replace('.', ',') : ''
  let main = `${valueStr} ${displayUnit}`

  if (pieces != null) {
    const pu = lang === 'kz' && KZ_UNIT[piecesUnit] ? KZ_UNIT[piecesUnit] : piecesUnit
    const pStr = String(pieces).replace('.', ',')
    main += ` (${pStr} ${pu})`
  }

  return main
}

export function getDisplayQuantity(product, lang) {
  if (!product) return null
  if (product.quantityParsed) {
    return formatQuantityDisplay(product.quantityParsed, lang)
  }
  return product.quantity || product.specs?.weight || null
}

export function parseQuantity(quantityStr) {
  if (!quantityStr) return null
  const tokens = parseQuantityTokens(String(quantityStr))
  if (!tokens || tokens.length === 0) return null
  const primary = pickPrimary(tokens)
  return {
    num: primary.value,
    unit: primary.unit,
    isWeight: primary.unitType === 'weight',
    isVolume: primary.unitType === 'volume',
    isPieces: primary.unitType === 'pieces',
    isWeightByWeight: primary.isWeightByWeight || false,
  }
}

export function computePricePerUnit(priceKzt, quantityParsed) {
  if (!priceKzt) return null

  let q
  if (quantityParsed && typeof quantityParsed === 'object' && 'unitType' in quantityParsed) {
    q = quantityParsed
  } else if (typeof quantityParsed === 'string' || typeof quantityParsed === 'number') {
    const parsed = parseQuantity(String(quantityParsed))
    if (!parsed) return null
    q = {
      value: parsed.num,
      unit: parsed.unit,
      unitType: parsed.isWeight ? 'weight' : parsed.isVolume ? 'volume' : 'pieces',
      isWeightByWeight: parsed.isWeightByWeight,
    }
  } else {
    return null
  }

  if (q.isWeightByWeight) {
    return { perUnit: Math.round(priceKzt), unitSuffix: 'кг' }
  }

  const { value, unit, unitType } = q
  if (!value || value <= 0) return null

  if (unitType === 'weight') {
    if (unit === 'кг') {
      return { per100: Math.round(priceKzt / value / 10), suffix: '100 г' }
    }
    return { per100: Math.round((priceKzt / value) * 100), suffix: '100 г' }
  }

  if (unitType === 'volume') {
    if (unit === 'л') {
      return { per100: Math.round(priceKzt / value / 10), suffix: '100 мл' }
    }
    return { per100: Math.round((priceKzt / value) * 100), suffix: '100 мл' }
  }

  if (unitType === 'pieces') {
    return { perUnit: Math.round(priceKzt / value), unitSuffix: 'шт' }
  }

  return null
}
