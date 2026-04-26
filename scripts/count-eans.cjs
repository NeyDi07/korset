require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function main() {
  const { count: total } = await sb.from('global_products').select('*', { count: 'exact', head: true }).eq('is_active', true)

  const { count: arbuzFake } = await sb.from('global_products').select('*', { count: 'exact', head: true }).eq('is_active', true).like('ean', 'arbuz_%')
  const { count: kaspiFake } = await sb.from('global_products').select('*', { count: 'exact', head: true }).eq('is_active', true).like('ean', 'kaspi_%')
  const { count: kvFake } = await sb.from('global_products').select('*', { count: 'exact', head: true }).eq('is_active', true).like('ean', 'korzinavdom_%')
  const { count: realEan } = await sb.from('global_products').select('*', { count: 'exact', head: true }).eq('is_active', true).not('ean', 'is.null').not('ean', 'eq', '').not('ean', 'like', 'arbuz_%').not('ean', 'like', 'kaspi_%').not('ean', 'like', 'korzinavdom_%')

  console.log('Total active:', total)
  console.log('Fake arbuz_:', arbuzFake)
  console.log('Fake kaspi_:', kaspiFake)
  console.log('Fake korzinavdom_:', kvFake)
  console.log('Real EAN:', realEan)
  console.log('Need real EAN:', total - realEan)
}

main().catch(e => console.error(e))
