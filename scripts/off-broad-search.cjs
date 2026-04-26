const path = require('path')
const https = require('https')
const { URL } = require('url')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const { classifyBarcode } = require('./validate-ean.cjs')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.argv.includes('--dry-run')

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const options = {
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method: 'GET',
      headers: { 'User-Agent': 'Korset/1.0' },
    }
    const req = https.request(options, res => {
      let b = ''
      res.on('data', c => b += c)
      res.on('end', () => { try { resolve(JSON.parse(b)) } catch { resolve(null) } })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); resolve(null) })
    req.end()
  })
}

function isScannable(ean) {
  const info = classifyBarcode(ean)
  if (!info.valid) return false
  const pre = ean.substring(0, 3)
  if (pre >= '020' && pre <= '029') return false
  if (pre >= '040' && pre <= '049') return false
  return true
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function extractKeywords(name, brand) {
  const stopWords = new Set(['с', 'в', 'и', 'на', 'из', 'по', 'для', 'без', 'от', 'к', 'за', 'о', 'не', 'но', 'а', 'the', 'and', 'with', 'from', 'for', 'in'])
  const combined = ((brand || '') + ' ' + (name || '')).toLowerCase()
  return combined
    .replace(/[^\wа-яё]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 5)
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('═══════════════════════════════════════════')
  console.log('  OFF BROAD SEARCH v2 (keyword-based)')
  console.log('  Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE')
  console.log('═══════════════════════════════════════════')

  const { data: fake1 } = await sb.from('global_products').select('id,ean,name,brand,source_primary').eq('is_active', true).like('ean', 'arbuz_%')
  const { data: fake2 } = await sb.from('global_products').select('id,ean,name,brand,source_primary').eq('is_active', true).like('ean', 'kaspi_%')
  const { data: fake3 } = await sb.from('global_products').select('id,ean,name,brand,source_primary').eq('is_active', true).like('ean', 'korzinavdom_%')
  const fake = [...fake1, ...fake2, ...fake3]
  console.log('Fake EAN products:', fake.length)

  const { data: realAll } = await sb.from('global_products').select('ean').eq('is_active', true).not('ean', 'like', 'arbuz_%').not('ean', 'like', 'kaspi_%').not('ean', 'like', 'korzinavdom_%')
  const existingEans = new Set(realAll.map(p => p.ean))

  let found = 0
  let applied = 0
  let dupFound = 0
  let notFound = 0
  const notFoundList = []

  for (let i = 0; i < fake.length; i++) {
    const p = fake[i]
    const keywords = extractKeywords(p.name, p.brand)
    if (keywords.length < 1) {
      notFound++
      notFoundList.push(p)
      continue
    }

    const queries = []

    if (keywords.length >= 2) {
      queries.push(keywords.slice(0, 3).join(' '))
    }
    queries.push(keywords[0])

    if (p.brand && p.brand.trim().length > 1) {
      const brandClean = p.brand.replace(/[^\wа-яА-ЯёЁ]/g, ' ').replace(/\s+/g, ' ').trim()
      queries.push(brandClean)
    }

    let ean = null

    for (const q of queries) {
      if (ean) break
      try {
        const encoded = encodeURIComponent(q.substring(0, 60))
        const r = await httpGet('https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encoded + '&search_simple=1&action=process&json=1&page_size=30')
        if (r && r.products && r.products.length > 0) {
          for (const prod of r.products) {
            const code = prod.code
            if (!code || code.length < 8 || !isScannable(code)) continue

            const offName = ((prod.product_name || '') + ' ' + (prod.product_name_ru || '') + ' ' + (prod.brands || '')).toLowerCase()
            const pName = (p.name || '').toLowerCase()
            const pBrand = (p.brand || '').toLowerCase()

            let score = 0
            const brandWord = pBrand.split(/\s+/)[0]
            if (brandWord && offName.includes(brandWord)) score += 10
            const words = pName.split(/\s+/).filter(w => w.length > 2)
            for (const w of words) { if (offName.includes(w)) score += 3 }

            if (score >= 10) {
              if (existingEans.has(code)) {
                dupFound++
                ean = 'DUP:' + code
              } else {
                ean = code
              }
              break
            }
          }
        }
      } catch {}
      await sleep(700)
    }

    if (ean && !ean.startsWith('DUP:')) {
      found++
      if (!DRY_RUN) {
        const { error } = await sb.from('global_products').update({ ean }).eq('id', p.id)
        if (error) {
          if (error.message.includes('duplicate key')) {
            existingEans.add(ean)
            dupFound++
          }
          console.log('  ERR ' + p.ean + ' → ' + ean + ': ' + error.message)
        } else {
          applied++
          existingEans.add(ean)
        }
      }
    } else if (ean && ean.startsWith('DUP:')) {
      // Already handled above
    } else {
      notFound++
      notFoundList.push(p)
    }

    process.stdout.write('\r  [' + (i + 1) + '/' + fake.length + '] Found: ' + found + ' | Applied: ' + applied + ' | Dup: ' + dupFound + ' | Not found: ' + notFound + '   ')
  }

  console.log('')
  console.log('')
  console.log('═══════════════════════════════════════')
  console.log('  RESULT')
  console.log('═══════════════════════════════════════')
  console.log('Found:', found, '| Applied:', applied, '| Dup existing:', dupFound, '| Not found:', notFound)

  const { count: realNow } = await sb.from('global_products').select('*', { count: 'exact', head: true }).eq('is_active', true).not('ean', 'like', 'arbuz_%').not('ean', 'like', 'kaspi_%').not('ean', 'like', 'korzinavdom_%')
  const { count: totalNow } = await sb.from('global_products').select('*', { count: 'exact', head: true }).eq('is_active', true)
  const fakeNow = totalNow - realNow
  console.log('Coverage: ' + realNow + '/' + totalNow + ' (' + (realNow / totalNow * 100).toFixed(1) + '%)')
  console.log('Still fake:', fakeNow)

  if (notFoundList.length > 0 && notFoundList.length <= 100) {
    console.log('')
    console.log('── STILL NOT FOUND ──')
    notFoundList.forEach(p => console.log('  ' + p.ean + ' | ' + (p.brand || '—') + ' | ' + (p.name || '').substring(0, 45)))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
