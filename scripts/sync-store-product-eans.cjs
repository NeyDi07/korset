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

  const { data: rows, error } = await supabase
    .from('store_products')
    .select('id, ean, store_id, global_product_id, global_products!inner(ean, name)')
    .eq('is_active', true)

  if (error) {
    console.error('Fetch error:', error.message)
    process.exit(1)
  }

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

  if (dryRun) {
    console.log('Run with --live to apply changes.')
    return
  }

  let updated = 0
  let failed = 0

  for (const r of fakeEanMismatches) {
    const { error: updateError } = await supabase
      .from('store_products')
      .update({ ean: r.global_products.ean })
      .eq('id', r.id)

    if (updateError) {
      console.error(`  FAIL: ${r.ean} → ${r.global_products.ean}: ${updateError.message}`)
      failed++
    } else {
      updated++
    }

    if (updated % 100 === 0) {
      console.log(`  Progress: ${updated}/${fakeEanMismatches.length}`)
    }
  }

  console.log(`\nFake EAN sync complete: ${updated} updated, ${failed} failed`)

  if (otherMismatches.length > 0) {
    console.log(
      `\n⚠️ ${otherMismatches.length} non-fake mismatches skipped. Review manually if needed.`
    )
  }
}

const live = process.argv.includes('--live')
syncStoreProductEans(!live)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
