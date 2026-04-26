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

function similarity(a, b) {
  if (!a || !b) return 0
  a = a.toLowerCase().replace(/[^\wа-яё]/gi, '')
  b = b.toLowerCase().replace(/[^\wа-яё]/gi, '')
  const words = a.split(/\s+/).filter(w => w.length > 2)
  if (words.length === 0) return 0
  let matched = 0
  for (const w of words) { if (b.includes(w)) matched++ }
  return matched / words.length
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('═══════════════════════════════════════════')
  console.log('  BARCODE DATABASE SEARCH (UPCitemdb)')
  console.log('  Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE')
  console.log('═══════════════════════════════════════════')

  const { data: fake1 } = await sb.from('global_products').select('id,ean,name,brand,source_primary').eq('is_active', true).like('ean', 'arbuz_%')
  const { data: fake3 } = await sb.from('global_products').select('id,ean,name,brand,source_primary').eq('is_active', true).like('ean', 'korzinavdom_%')
  const fake = [...fake1, ...fake3]
  console.log('Fake EAN products:', fake.length)

  const { data: realAll } = await sb.from('global_products').select('ean').eq('is_active', true).not('ean', 'like', 'arbuz_%').not('ean', 'like', 'kaspi_%').not('ean', 'like', 'korzinavdom_%')
  const existingEans = new Set(realAll.map(p => p.ean))

  let found = 0
  let applied = 0
  let notFound = 0

  for (let i = 0; i < fake.length; i++) {
    const p = fake[i]
    const brandPart = (p.brand || '').replace(/[^\wа-яА-ЯёЁ]/g, ' ').replace(/\s+/g, ' ').trim()
    const nameWords = ((p.name || '').substring(0, 50)).replace(/[^\wа-яА-ЯёЁ]/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(w => w.length > 2).slice(0, 4)

    const queries = []
    if (brandPart.length > 2) {
      const engBrand = brandPart.replace(/[а-яА-ЯёЁ]/g, '').trim()
      if (engBrand.length > 2) queries.push(engBrand + ' ' + nameWords.filter(w => !/[а-яА-ЯёЁ]/.test(w)).join(' '))
      queries.push(brandPart)
    }

    let ean = null

    for (const q of queries) {
      if (ean || !q || q.trim().length < 3) break
      try {
        const encoded = encodeURIComponent(q.substring(0, 60))
        const r = await httpGet('https://api.upcitemdb.com/prod/trgsearch?s=' + encoded + '&type=2&match_mode=1')
        if (r && r.items && r.items.length > 0) {
          for (const item of r.items) {
            if (item.ean && isScannable(item.ean) && !existingEans.has(item.ean)) {
              const itemName = (item.title || '').toLowerCase()
              const pBrand = (p.brand || '').toLowerCase()
              const brandWord = pBrand.split(/\s+/)[0]
              if (brandWord && itemName.includes(brandWord.split(/[^a-zа-яё]/i)[0])) {
                ean = item.ean
                break
              }
            }
          }
        }
      } catch {}
      await sleep(800)
    }

    if (ean) {
      found++
      if (!DRY_RUN) {
        const { error } = await sb.from('global_products').update({ ean }).eq('id', p.id)
        if (error) {
          if (error.message.includes('duplicate key')) existingEans.add(ean)
          console.log('  ERR ' + p.ean + ' → ' + ean + ': ' + error.message)
        } else {
          applied++
          existingEans.add(ean)
        }
      }
    } else {
      notFound++
    }

    process.stdout.write('\r  [' + (i + 1) + '/' + fake.length + '] Found: ' + found + ' | Applied: ' + applied + ' | Not found: ' + notFound + '   ')
  }

  console.log('')
  console.log('')
  console.log('═══════════════════════════════════════')
  console.log('  RESULT')
  console.log('═══════════════════════════════════════')
  console.log('Found:', found, '| Applied:', applied, '| Not found:', notFound)

  const { count: realNow } = await sb.from('global_products').select('*', { count: 'exact', head: true }).eq('is_active', true).not('ean', 'like', 'arbuz_%').not('ean', 'like', 'kaspi_%').not('ean', 'like', 'korzinavdom_%')
  const { count: totalNow } = await sb.from('global_products').select('*', { count: 'exact', head: true }).eq('is_active', true)
  console.log('Coverage: ' + realNow + '/' + totalNow + ' (' + (realNow / totalNow * 100).toFixed(1) + '%)')
}

main().catch(e => { console.error(e); process.exit(1) })
