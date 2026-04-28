import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function syncStoreProductEans(dryRun = true) {
  console.log(`\n${dryRun ? '[DRY RUN]' : '[LIVE]'} Syncing store_products.ean → global_products.ean\n`)

  let allRows = []
  let page = 0
  const PAGE_SIZE = 1000
  while (true) {
    const { data: rows, error } = await supabase
      .from('store_products')
      .select('id, ean, store_id, global_product_id, global_products!inner(ean, name)')
      .eq('is_active', true)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) {
      console.error('Fetch error:', error.message)
      process.exit(1)
    }

    allRows.push(...rows)
    if (rows.length < PAGE_SIZE) break
    page++
  }

  const rows = allRows

  const mismatches = rows.filter((r) => r.ean !== r.global_products.ean)

  console.log(`Total store_products (active): ${rows.length}`)
  console.log(`EAN mismatches: ${mismatches.length}\n`)

  if (mismatches.length === 0) {
    console.log('All EANs are already in sync!')
    return
  }

  const fakeEanMismatches = mismatches.filter(
    (r) => r.ean.startsWith('arbuz_') || r.ean.startsWith('kaspi_') || r.ean.startsWith('korzinavdom_')
  )
  const otherMismatches = mismatches.filter(
    (r) =>
      !r.ean.startsWith('arbuz_') &&
      !r.ean.startsWith('kaspi_') &&
      !r.ean.startsWith('korzinavdom_')
  )

  console.log(`Fake EAN mismatches (arbuz_/kaspi_/korzinavdom_ → real): ${fakeEanMismatches.length}`)
  console.log(`Other mismatches: ${otherMismatches.length}\n`)

  if (fakeEanMismatches.length > 0) {
    console.log('--- Fake EAN → Real EAN ---')
    for (const r of fakeEanMismatches.slice(0, 30)) {
      console.log(`  ${r.ean} → ${r.global_products.ean}  (${r.global_products.name?.slice(0, 50)})`)
    }
    if (fakeEanMismatches.length > 30) {
      console.log(`  ... and ${fakeEanMismatches.length - 30} more`)
    }
    console.log()
  }

  if (otherMismatches.length > 0) {
    console.log('--- Other EAN changes ---')
    for (const r of otherMismatches.slice(0, 20)) {
      console.log(`  ${r.ean} → ${r.global_products.ean}  (${r.global_products.name?.slice(0, 50)})`)
    }
    if (otherMismatches.length > 20) {
      console.log(`  ... and ${otherMismatches.length - 20} more`)
    }
    console.log()
  }

  const eanIndexByStore = new Map()
  for (const r of rows) {
    const key = `${r.store_id}:${r.ean}`
    eanIndexByStore.set(key, r)
  }

  const toUpdate = []
  const toDeactivate = []

  for (const r of fakeEanMismatches) {
    const realEan = r.global_products.ean
    const existingKey = `${r.store_id}:${realEan}`
    const existing = eanIndexByStore.get(existingKey)
    if (existing && existing.id !== r.id) {
      toDeactivate.push({ ...r, duplicateDetected: false })
    } else {
      toUpdate.push(r)
    }
  }

  console.log(`\n--- ACTION PLAN ---`)
  console.log(`  Update EAN:           ${toUpdate.length}`)
  console.log(`  Deactivate duplicates: ${toDeactivate.length}`)

  if (dryRun) {
    if (toDeactivate.length > 0) {
      console.log(`\n--- DUPLICATES TO DEACTIVATE ---`)
      for (const r of toDeactivate.slice(0, 15)) {
        console.log(`  ${r.ean} → ${r.global_products.ean} already exists in store ${r.store_id}  (${r.global_products.name?.slice(0, 40)})`)
      }
      if (toDeactivate.length > 15) console.log(`  ... and ${toDeactivate.length - 15} more`)
    }
    console.log('\nRun with --live to apply changes.')
    return
  }

  let updated = 0
  let deactivated = 0
  let failed = 0

  const BATCH = 100
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH)
    const updates = batch.map((r) => ({
      id: r.id,
      ean: r.global_products.ean,
    }))

    let batchOk = 0
    let batchFail = 0
    for (const u of updates) {
      const { error: updateError } = await supabase
        .from('store_products')
        .update({ ean: u.ean })
        .eq('id', u.id)

      if (updateError) {
        if (updateError.code === '23505') {
          toDeactivate.push({ ...toUpdate.find((r) => r.id === u.id), duplicateDetected: true })
          batchFail++
        } else {
          console.error(`  FAIL: ${u.id}: ${updateError.message}`)
          batchFail++
        }
      } else {
        batchOk++
      }
    }
    updated += batchOk
    failed += batchFail
    console.log(`  Update progress: ${Math.min(i + BATCH, toUpdate.length)}/${toUpdate.length} (ok:${batchOk} fail:${batchFail})`)
  }

  const extraDeactivated = toDeactivate.filter((r) => r.duplicateDetected)
  const allDeactivate = [...toDeactivate.filter((r) => !r.duplicateDetected), ...extraDeactivated]
  const uniqueDeactivateIds = [...new Set(allDeactivate.map((r) => r.id))]

  for (let i = 0; i < uniqueDeactivateIds.length; i += BATCH) {
    const batchIds = uniqueDeactivateIds.slice(i, i + BATCH)
    const { error: deactError } = await supabase
      .from('store_products')
      .update({ is_active: false })
      .in('id', batchIds)

    if (deactError) {
      console.error(`  FAIL deactivate batch: ${deactError.message}`)
      failed += batchIds.length
    } else {
      deactivated += batchIds.length
    }
    console.log(`  Deactivate progress: ${Math.min(i + BATCH, uniqueDeactivateIds.length)}/${uniqueDeactivateIds.length}`)
  }

  console.log(`\nFake EAN sync complete:`)
  console.log(`  EANs updated:     ${updated}`)
  console.log(`  Duplicates deactivated: ${deactivated}`)
  console.log(`  Failed:           ${failed}`)

  if (otherMismatches.length > 0 && !dryRun) {
    console.log(`\n--- DEACTIVATING ${otherMismatches.length} NON-FAKE MISMATCHES ---`)
    let otherOk = 0
    let otherFail = 0
    for (let i = 0; i < otherMismatches.length; i += BATCH) {
      const ids = otherMismatches.slice(i, i + BATCH).map((r) => r.id)
      const { error: deactError } = await supabase
        .from('store_products')
        .update({ is_active: false })
        .in('id', ids)

      if (deactError) {
        console.error(`  FAIL: ${deactError.message}`)
        otherFail += ids.length
      } else {
        otherOk += ids.length
      }
      console.log(`  Progress: ${Math.min(i + BATCH, otherMismatches.length)}/${otherMismatches.length}`)
    }
    console.log(`Non-fake mismatches deactivated: ${otherOk}, failed: ${otherFail}`)
  } else if (otherMismatches.length > 0) {
    console.log(`\n⚠️ ${otherMismatches.length} non-fake mismatches will be DEACTIVATED with --live.`)
  }
}

const live = process.argv.includes('--live')
syncStoreProductEans(!live)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
