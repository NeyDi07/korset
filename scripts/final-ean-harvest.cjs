const path = require('path')
const https = require('https')
const { URL } = require('url')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const { classifyBarcode } = require('./validate-ean.cjs')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const NPC_API_KEY = process.env.NPC_API_KEY
const DRY_RUN = process.argv.includes('--dry-run')

function httpPost(urlStr, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const url = new URL(urlStr)
    const options = {
      hostname: url.hostname, port: 443,
      path: url.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-API-KEY': NPC_API_KEY,
      },
    }
    const req = https.request(options, res => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => { try { resolve(JSON.parse(body)) } catch { resolve(null) } })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); resolve(null) })
    req.write(data)
    req.end()
  })
}

function isScannable(ean) {
  const info = classifyBarcode(ean)
  if (!info.valid) return false
  const pre = ean.substring(0, 3)
  if (pre >= '020' && pre <= '029') return false
  if (pre >= '040' && pre <= '049') return false
  if (pre >= '200' && pre <= '299') return false
  return true
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('═══════════════════════════════════════════')
  console.log('  FINAL EAN HARVESTER (NPC + OFF)')
  console.log('  Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE')
  console.log('═══════════════════════════════════════════')

  const { data: fake1 } = await sb.from('global_products').select('id,ean,name,brand,source_primary').eq('is_active', true).like('ean', 'arbuz_%')
  const { data: fake2 } = await sb.from('global_products').select('id,ean,name,brand,source_primary').eq('is_active', true).like('ean', 'kaspi_%')
  const { data: fake3 } = await sb.from('global_products').select('id,ean,name,brand,source_primary').eq('is_active', true).like('ean', 'korzinavdom_%')
  const fake = [...fake1, ...fake2, ...fake3].filter(p => p.brand && p.brand.length > 1)
  console.log('Fake EAN with brand:', fake.length)

  const { data: realAll } = await sb.from('global_products').select('ean').eq('is_active', true).not('ean', 'like', 'arbuz_%').not('ean', 'like', 'kaspi_%').not('ean', 'like', 'korzinavdom_%')
  const existingEans = new Set(realAll.map(p => p.ean))

  let found = 0
  let applied = 0
  let notFound = 0
  const notFoundList = []

  for (let i = 0; i < fake.length; i++) {
    const p = fake[i]
    const query = (p.brand + ' ' + (p.name || '').substring(0, 50)).replace(/[^\wа-яА-ЯёЁ]/g, ' ').replace(/\s+/g, ' ').trim()

    let ean = null

    // NPC search: 2 queries (full + brand-only)
    const queries = [
      query.substring(0, 80),
      p.brand.substring(0, 80),
    ]

    for (const q of queries) {
      if (ean) break
      try {
        const r = await httpPost('https://nationalcatalog.kz/gw/search/api/v1/search', { query: q, page: 1, size: 10 })
        if (r && r.items && r.items.length > 0) {
          for (const item of r.items) {
            const gtin = item.gtin
            if (gtin && gtin !== '-' && isScannable(gtin) && !existingEans.has(gtin)) {
              const nameRu = (item.nameRu || '').toLowerCase()
              const pName = (p.name || '').toLowerCase()
              const pBrand = (p.brand || '').toLowerCase()
              let score = 0
              if (nameRu.includes(pBrand)) score += 10
              const words = pName.split(/\s+/).filter(w => w.length > 2)
              for (const w of words) { if (nameRu.includes(w)) score += 3 }
              if (score >= 10) {
                ean = gtin
                break
              }
            }
          }
        }
      } catch {}
      await sleep(200)
    }

    if (ean) {
      found++
      if (!DRY_RUN) {
        const { error } = await sb.from('global_products').update({ ean }).eq('id', p.id)
        if (error) {
          if (error.message.includes('duplicate key')) {
            existingEans.add(ean)
          }
          console.log('  ERR ' + p.ean + ' → ' + ean + ': ' + error.message)
        } else {
          applied++
          existingEans.add(ean)
        }
      }
    } else {
      notFound++
      notFoundList.push(p)
    }

    process.stdout.write('\r  [' + (i + 1) + '/' + fake.length + '] Found: ' + found + ' | Applied: ' + applied + ' | Not found: ' + notFound + '   ')
  }

  console.log('')
  console.log('')
  console.log('═══════════════════════════════════════')
  console.log('  RESULT')
  console.log('═══════════════════════════════════════')
  console.log('Found:', found, '| Applied:', applied, '| Not found:', notFound)
  console.log('')

  console.log('── NOT FOUND (for manual lookup) ──')
  notFoundList.forEach(p => console.log('  ' + p.ean + ' | ' + p.brand + ' | ' + (p.name || '').substring(0, 45)))

  const { count: realNow } = await sb.from('global_products').select('*', { count: 'exact', head: true }).eq('is_active', true).not('ean', 'like', 'arbuz_%').not('ean', 'like', 'kaspi_%').not('ean', 'like', 'korzinavdom_%')
  const { count: totalNow } = await sb.from('global_products').select('*', { count: 'exact', head: true }).eq('is_active', true)
  console.log('')
  console.log('Coverage: ' + realNow + '/' + totalNow + ' (' + (realNow / totalNow * 100).toFixed(1) + '%)')
}

main().catch(e => { console.error(e); process.exit(1) })
