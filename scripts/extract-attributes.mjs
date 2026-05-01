import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
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

const CHUNK_SIZE = 100

async function main() {
  const { extractAllAttributes, isValidPackagingType } = await import(
    pathToFileURL(join(__dirname, '..', 'src', 'domain', 'product', 'attributeExtractor.js')).href
  )

  console.log(`\n🧪 Attribute Extraction — ${isDryRun ? 'DRY RUN' : 'LIVE'}\n`)

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
      .select('id, name, category, halal_status, diet_tags_json')
      .eq('is_active', true)
      .range(offset, offset + 999)

    if (error) { console.error('Fetch error:', error); break }
    if (!data || data.length === 0) { hasMore = false; break }

    allProducts.push(...data)
    offset += 1000
    if (data.length < 1000) hasMore = false
  }

  console.log(`Fetched: ${allProducts.length} products\n`)

  const stats = { packaging: 0, fat_percent: 0, diet_tags_added: 0, halal_upgraded: 0, unchanged: 0 }

  const updates = []

  for (const row of allProducts) {
    const existingDietTags = row.diet_tags_json
      ? (typeof row.diet_tags_json === 'string' ? JSON.parse(row.diet_tags_json) : row.diet_tags_json)
      : []

    const attrs = extractAllAttributes({
      name: row.name,
      category: row.category,
      halalStatus: row.halal_status,
      dietTags: existingDietTags,
    })

    const hasChanges =
      attrs.packaging_type !== null ||
      attrs.fat_percent !== null ||
      (attrs.diet_tags_json !== null && attrs.diet_tags_json !== JSON.stringify(existingDietTags)) ||
      attrs.halal_status !== row.halal_status

    if (!hasChanges) { stats.unchanged++; continue }

    const fields = {}
    if (attrs.packaging_type && isValidPackagingType(attrs.packaging_type)) {
      fields.packaging_type = attrs.packaging_type
      stats.packaging++
    }
    if (attrs.fat_percent !== null) {
      fields.fat_percent = attrs.fat_percent
      stats.fat_percent++
    }
    if (attrs.diet_tags_json !== null && attrs.diet_tags_json !== JSON.stringify(existingDietTags)) {
      fields.diet_tags_json = attrs.diet_tags_json
      stats.diet_tags_added++
    }
    if (attrs.halal_status !== row.halal_status && attrs.halal_status !== 'unknown') {
      fields.halal_status = attrs.halal_status
      stats.halal_upgraded++
    }

    if (Object.keys(fields).length > 0) {
      updates.push({ id: row.id, ...fields })
    }
  }

  console.log(`  Packaging found:    ${stats.packaging}`)
  console.log(`  Fat % found:        ${stats.fat_percent}`)
  console.log(`  Diet tags added:    ${stats.diet_tags_added}`)
  console.log(`  Halal upgraded:     ${stats.halal_upgraded}`)
  console.log(`  Unchanged:         ${stats.unchanged}`)
  console.log(`  Total updates:      ${updates.length}`)

  if (isLive && updates.length > 0) {
    let applied = 0
    let failed = 0
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE)

      const ids = chunk.map((u) => u.id)
      const fieldsMap = {}
      for (const u of chunk) {
        const { id, ...fields } = u
        for (const [k, v] of Object.entries(fields)) {
          if (!fieldsMap[k]) fieldsMap[k] = new Map()
          fieldsMap[k].set(String(v), fieldsMap[k].get(String(v)) || [])
          fieldsMap[k].get(String(v)).push(id)
        }
      }

      for (const u of chunk) {
        const { id, ...fields } = u
        const { error } = await supabase
          .from('global_products')
          .update(fields)
          .eq('id', id)
        if (error) { console.error(`Update error ${id}:`, error); failed++ }
        else applied++
      }

      if ((i + CHUNK_SIZE) % 500 === 0 || i + CHUNK_SIZE >= updates.length) {
        console.log(`  Applied: ${applied}, Failed: ${failed}`)
      }
    }
    console.log(`\n  ✅ Total applied: ${applied}, Failed: ${failed}`)
  }

  console.log(`\n${isDryRun ? '🧪 DRY RUN — no changes made' : '✅ LIVE — changes applied'}\n`)
}

main().catch(console.error)
