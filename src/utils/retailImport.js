import { supabase } from './supabase.js'

const HEADER_ALIASES = {
  ean: ['ean', 'barcode', 'bar code', 'штрихкод', 'штрих код', 'штк', 'код', 'артикул'],
  price: ['price', 'цена', 'баға', 'стоимость', 'розница', 'retail price'],
  stockStatus: ['stock', 'status', 'наличие', 'остаток', 'қойма', 'статус'],
  shelfZone: ['shelf', 'полка', 'зона', 'ряд', 'сөре'],
  localName: ['name', 'название', 'тауар', 'наименование', 'product'],
}

const STOCK_MAP = new Map([
  ['in_stock', 'in_stock'],
  ['in stock', 'in_stock'],
  ['есть', 'in_stock'],
  ['в наличии', 'in_stock'],
  ['бар', 'in_stock'],
  ['low_stock', 'low_stock'],
  ['low stock', 'low_stock'],
  ['мало', 'low_stock'],
  ['аз', 'low_stock'],
  ['out_of_stock', 'out_of_stock'],
  ['out of stock', 'out_of_stock'],
  ['нет', 'out_of_stock'],
  ['нет в наличии', 'out_of_stock'],
  ['жоқ', 'out_of_stock'],
])

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function detectColumns(headerRow) {
  const normalized = headerRow.map(normalizeHeader)
  const columns = {}

  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = normalized.findIndex((header) => aliases.includes(header))
    if (index >= 0) columns[key] = index
  }

  return columns
}

function parseCsvLine(line) {
  const cells = []
  let current = ''
  let quoted = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      i++
    } else if (char === '"') {
      quoted = !quoted
    } else if ((char === ',' || char === ';' || char === '\t') && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current.trim())
  return cells
}

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine)
}

function normalizeEan(value) {
  return String(value || '').replace(/\D/g, '')
}

function parsePrice(value) {
  const normalized = String(value || '')
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed)
}

function parseStockStatus(value) {
  const normalized = normalizeHeader(value)
  return STOCK_MAP.get(normalized) || null
}

function cell(row, index) {
  if (index == null) return ''
  return row[index] ?? ''
}

function buildPreview(rows) {
  if (rows.length < 2) {
    return { rows: [], errors: [{ row: 0, message: 'Файл пустой или без строк товаров' }] }
  }

  const columns = detectColumns(rows[0])
  const errors = []

  if (columns.ean == null) errors.push({ row: 1, message: 'Не найдена колонка EAN/Штрихкод' })
  if (columns.price == null) errors.push({ row: 1, message: 'Не найдена колонка Цена/Price' })
  if (errors.length) return { rows: [], errors }

  const seen = new Set()
  const parsedRows = []

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2
    const ean = normalizeEan(cell(row, columns.ean))
    const priceKzt = parsePrice(cell(row, columns.price))
    const stockStatus = parseStockStatus(cell(row, columns.stockStatus)) || 'in_stock'
    const shelfZone = String(cell(row, columns.shelfZone) || '').trim()
    const localName = String(cell(row, columns.localName) || '').trim()

    if (!ean) {
      errors.push({ row: rowNumber, message: 'Пустой EAN' })
      return
    }
    if (ean.length < 8 || ean.length > 14) {
      errors.push({ row: rowNumber, ean, message: 'EAN должен содержать 8-14 цифр' })
      return
    }
    if (seen.has(ean)) {
      errors.push({ row: rowNumber, ean, message: 'Дубликат EAN в файле' })
      return
    }
    if (!priceKzt) {
      errors.push({ row: rowNumber, ean, message: 'Некорректная цена' })
      return
    }

    seen.add(ean)
    parsedRows.push({ rowNumber, ean, priceKzt, stockStatus, shelfZone, localName })
  })

  return { rows: parsedRows, errors }
}

export async function parseRetailImportFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv') {
    const text = await file.text()
    return buildPreview(parseCsv(text))
  }

  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
  return buildPreview(rows)
}

async function fetchExistingProducts(storeId, eans) {
  const map = new Map()
  const chunkSize = 500

  for (let i = 0; i < eans.length; i += chunkSize) {
    const chunk = eans.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('store_products')
      .select('id, ean')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .in('ean', chunk)

    if (error) throw new Error(error.message ?? error)
    ;(data || []).forEach((item) => map.set(String(item.ean), item))
  }

  return map
}

export async function applyRetailImport(storeId, rows) {
  if (!storeId) throw new Error('Store is not loaded')
  const existing = await fetchExistingProducts(
    storeId,
    rows.map((row) => row.ean)
  )

  const result = {
    updated: 0,
    skipped: [],
    failed: [],
  }

  const knownRows = rows.filter((row) => {
    if (existing.has(row.ean)) return true
    result.skipped.push({ ...row, reason: 'Товар с таким EAN не найден в каталоге магазина' })
    return false
  })

  const batchSize = 20
  for (let i = 0; i < knownRows.length; i += batchSize) {
    const batch = knownRows.slice(i, i + batchSize)
    const updates = await Promise.all(
      batch.map(async (row) => {
        const product = existing.get(row.ean)
        const payload = {
          price_kzt: row.priceKzt,
          stock_status: row.stockStatus,
          shelf_zone: row.shelfZone || null,
          updated_at: new Date().toISOString(),
        }
        const { data, error } = await supabase
          .from('store_products')
          .update(payload)
          .eq('id', product.id)
          .eq('store_id', storeId)
          .select('id')

        if (error || !data?.length) {
          return { ok: false, row, reason: error?.message || 'RLS или строка не найдена' }
        }
        return { ok: true }
      })
    )

    updates.forEach((item) => {
      if (item.ok) result.updated += 1
      else result.failed.push({ ...item.row, reason: item.reason })
    })
  }

  return result
}
