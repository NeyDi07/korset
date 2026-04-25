import { supabase } from './supabase.js'
import {
  buildRetailImportPreview,
  buildRetailImportTemplateRows,
  parseCsv,
  partitionRetailImportRows,
} from './retailImportCore.js'

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function toCsv(rows) {
  return rows
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\n')
}

export async function downloadRetailImportTemplate(format = 'csv') {
  const rows = buildRetailImportTemplateRows()

  if (format === 'xlsx') {
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, sheet, 'Import')
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    downloadBlob(
      new globalThis.Blob([output], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      'korset-import-template.xlsx'
    )
    return
  }

  downloadBlob(
    new globalThis.Blob([`\uFEFF${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' }),
    'korset-import-template.csv'
  )
}

export function downloadUnknownEansReport(rows) {
  const exportRows = [
    ['EAN', 'Цена', 'Наличие', 'Полка', 'Название', 'Причина'],
    ...rows.map((row) => [
      row.ean,
      row.priceKzt,
      row.stockStatus,
      row.shelfZone,
      row.localName,
      row.reason,
    ]),
  ]

  downloadBlob(
    new globalThis.Blob([`\uFEFF${toCsv(exportRows)}`], { type: 'text/csv;charset=utf-8' }),
    'korset-unknown-ean-report.csv'
  )
}

export async function parseRetailImportFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv') {
    const text = await file.text()
    return buildRetailImportPreview(parseCsv(text))
  }

  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
  return buildRetailImportPreview(rows)
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

  const { knownRows, unknownRows } = partitionRetailImportRows(rows, existing)
  const result = {
    updated: 0,
    skipped: unknownRows,
    unknownRows,
    failed: [],
  }

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
