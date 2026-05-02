import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const isLive = process.argv.includes('--live')
const isDryRun = !isLive

const envPath = join(__dirname, '..', '.env.local')
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  try {
    const envContent = readFileSync(envPath, 'utf8')
    for (const line of envContent.split('\n')) {
      const [key, ...rest] = line.split('=')
      if (!key || key.startsWith('#')) continue
      const val = rest.join('=').trim()
      if (key === 'SUPABASE_URL') process.env.SUPABASE_URL = val
      if (key === 'SUPABASE_SERVICE_KEY') process.env.SUPABASE_SERVICE_KEY = val
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') process.env.SUPABASE_SERVICE_KEY = val
    }
  } catch {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY — check .env.local')
    process.exit(1)
  }
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

const CHUNK_SIZE = 200

async function main() {
  const { normalizeName } = await import(
    pathToFileURL(join(__dirname, '..', 'src', 'domain', 'product', 'nameNormalizer.js')).href
  )

  console.log(`\n🧪 Name Normalization — ${isDryRun ? 'DRY RUN' : 'LIVE'}\n`)

  const { count, error: countErr } = await supabase
    .from('global_products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  if (countErr) { console.error('Count error:', countErr); process.exit(1) }
  console.log(`Active products: ${count}`)

  const allProducts = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('global_products')
      .select('id, ean, name, brand')
      .eq('is_active', true)
      .range(offset, offset + 999)

    if (error) { console.error('Fetch error:', error); break }
    if (!data || data.length === 0) { hasMore = false; break }

    allProducts.push(...data)
    offset += 1000
    if (data.length < 1000) hasMore = false
  }

  console.log(`Fetched: ${allProducts.length} products\n`)

  const stats = {
    total: allProducts.length,
    changed: 0,
    allCapsFixed: 0,
    packagingRemoved: 0,
    fatPercentFormatted: 0,
    weightFormatted: 0,
    doubleWeightRemoved: 0,
    longTrimmed: 0,
    unchanged: 0,
  }

  const updates = []
  const samples = []

  for (const row of allProducts) {
    if (!row.name) { stats.unchanged++; continue }

    const newName = normalizeName(row.name, { brand: row.brand })

    if (newName === row.name) {
      stats.unchanged++
      continue
    }

    stats.changed++
    updates.push({ id: row.id, ean: row.ean, oldName: row.name, newName })

    const oldUpper = row.name.toUpperCase()
    const newNotUpper = newName !== newName.toUpperCase()
    if (oldUpper === row.name && newNotUpper) stats.allCapsFixed++

    if (/[КНВРТ]|ТБА|Т\/Б|Ж\/Б|ЖБ|П\/Б|ПБ|ПЭТ|ПЕТ|П\/Э|ТБ|С\/Б|СТБ|СТ\.Б/.test(row.name) &&
        !/[КНВРТ]|ТБА|Т\/Б|Ж\/Б|ЖБ|П\/Б|ПБ|ПЭТ|ПЕТ|П\/Э|ТБ|С\/Б|СТБ|СТ\.Б/.test(newName)) {
      stats.packagingRemoved++
    }

    if (/(\d+[.,]?\d?)\s*%/.test(row.name)) stats.fatPercentFormatted++

    if (/\d+ГР|\d+гр|\d+Л\b|\d+л\b|\d+МЛ|\d+мл|\d+КГ|\d+кг|\d+ШТ|\d+шт/.test(row.name)) {
      stats.weightFormatted++
    }

    if (newName.length < row.name.length - 5) stats.doubleWeightRemoved++
    if (row.name.length > 80 && newName.length <= 80) stats.longTrimmed++

    if (samples.length < 20) {
      samples.push({ ean: row.ean, before: row.name, after: newName })
    }
  }

  console.log(`  Total:              ${stats.total}`)
  console.log(`  Changed:            ${stats.changed}`)
  console.log(`  Unchanged:          ${stats.unchanged}`)
  console.log(`  ALL CAPS fixed:     ${stats.allCapsFixed}`)
  console.log(`  Packaging removed:  ${stats.packagingRemoved}`)
  console.log(`  Fat % formatted:    ${stats.fatPercentFormatted}`)
  console.log(`  Weight formatted:   ${stats.weightFormatted}`)
  console.log(`  Double weight rm:   ${stats.doubleWeightRemoved}`)
  console.log(`  Long names trimmed: ${stats.longTrimmed}`)

  console.log(`\n📝 Sample changes:\n`)
  for (const s of samples) {
    console.log(`  ${s.ean}`)
    console.log(`    BEFORE: ${s.before}`)
    console.log(`    AFTER:  ${s.after}`)
  }

  const auditDir = join(__dirname, '..', 'data', 'audit')
  try { mkdirSync(auditDir, { recursive: true }) } catch {}
  const reportPath = join(auditDir, 'name-normalization.json')
  const report = {
    timestamp: new Date().toISOString(),
    mode: isDryRun ? 'dry-run' : 'live',
    stats,
    totalUpdates: updates.length,
    samples,
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n📄 Report saved: ${reportPath}`)

  if (isLive && updates.length > 0) {
    let applied = 0
    let failed = 0

    const { error: rpcTestErr } = await supabase.rpc('batch_update_product_names', { p_updates: [] })
    const useRpc = !rpcTestErr || !rpcTestErr.message.includes('Could not find')

    if (useRpc) {
      console.log(`\n📝 Applying ${updates.length} updates via batch RPC...`)
      const BATCH = 50
      for (let i = 0; i < updates.length; i += BATCH) {
        const chunk = updates.slice(i, i + BATCH)
        const payload = chunk.map(u => ({ id: u.id, name: u.newName }))
        const { error } = await supabase.rpc('batch_update_product_names', { p_updates: payload })
        if (error) { console.error(`  RPC error:`, error.message); failed += chunk.length }
        else applied += chunk.length
        if ((i + BATCH) % 500 === 0 || i + BATCH >= updates.length) {
          console.log(`  Progress: ${applied}/${updates.length} (${Math.round(applied / updates.length * 100)}%)`)
        }
      }
    } else {
      console.log(`\n📝 Applying ${updates.length} updates (grouped by name)...`)
      const grouped = new Map()
      for (const u of updates) {
        if (!grouped.has(u.newName)) grouped.set(u.newName, [])
        grouped.get(u.newName).push(u.id)
      }

      let grp = 0
      for (const [newName, ids] of grouped) {
        grp++
        const { error } = await supabase.from('global_products').update({ name: newName }).in('id', ids)
        if (error) { failed += ids.length; console.error(`  Err:`, error.message) }
        else applied += ids.length
        if (grp % 200 === 0 || grp === grouped.size) {
          console.log(`  Progress: ${applied}/${updates.length} (${Math.round(applied / updates.length * 100)}%) — ${grp}/${grouped.size} groups`)
        }
      }
    }

    console.log(`\n  ✅ Applied: ${applied}, Failed: ${failed}`)
  }

  console.log(`\n${isDryRun ? '🧪 DRY RUN — no changes made' : '✅ LIVE — changes applied'}\n`)
}

main().catch(console.error)
