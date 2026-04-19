const https = require('https')

const NPC_API_KEY = 't5_R3gcpKlSkt4Xz86p7txkiw-vHW6Cwqw4-7eP68KM'
const NPC_BASE = 'https://nationalcatalog.kz/gw'

function npcSearch(query, pageSize) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, page: 1, size: pageSize })
    const url = new URL('/gw/search/api/v1/search', 'https://nationalcatalog.kz')
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-API-KEY': NPC_API_KEY,
      },
    }
    const req = https.request(options, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) })
        } catch (_) {
          resolve({ status: res.statusCode, body: body.substring(0, 500) })
        }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

const TEST_QUERIES = [
  'Milka Alpenmilch',
  'Milka Oreo',
  'Ritter Sport миндаль',
  'Ritter Sport Praline',
  'KINDER шоколад',
  'KINDER Bueno',
  'Schogetten шоколад',
  'Победа шоколад',
  'Bucheron шоколад',
  "O'Zera шоколад",
  'Alpen Gold молочный',
  'Alpen Gold фундук',
  'KitKat молочный',
  'KitKat тёмный',
  "Hershey's молочный",
  'Спартак шоколад',
  'NA MEDU орехи',
  'NA MEDU шоколад',
  'Lindt Excellence',
  'Ferrero Raffaello',
]

async function main() {
  console.log('KÖRSET — NPC Search API Test')
  console.log(`Testing ${TEST_QUERIES.length} queries`)
  console.log('')

  const results = []
  let foundCount = 0
  let gtinCount = 0
  let ntinCount = 0

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const q = TEST_QUERIES[i]
    try {
      const r = await npcSearch(q, 2)
      if (r.status !== 200) {
        console.log(`#${i + 1} ${q.padEnd(25)} | ERROR: HTTP ${r.status}`)
        results.push({ query: q, error: `HTTP ${r.status}` })
        continue
      }

      const data = r.body
      const total = data.pageInfo?.totalSize || 0
      const items = data.items || []
      const first = items[0]

      if (!first) {
        console.log(`#${i + 1} ${q.padEnd(25)} | 0 results`)
        results.push({ query: q, found: false })
        continue
      }

      foundCount++
      const gtin = first.gtin
      const ntin = first.ntin
      const nameRu = first.nameRu || '-'
      const attrs = first.attributes || []
      const attrMap = {}
      for (const a of attrs) {
        if (a.value) attrMap[a.code] = { nameRu: a.nameRu, value: a.value, valueRu: a.valueRu }
      }

      if (gtin) gtinCount++
      if (ntin) ntinCount++

      const gtinStr = gtin || '-'
      const ntinStr = ntin || '-'
      const brand = attrMap.brand?.valueRu || attrMap.brand?.value || '-'
      const country = attrMap.country?.valueRu || '-'

      console.log(`#${i + 1} ${q.padEnd(25)} | total:${String(total).padStart(5)} | GTIN:${gtinStr.padEnd(15)} | NTIN:${ntinStr.padEnd(15)} | ${nameRu.substring(0, 35)} | brand:${brand} | country:${country}`)

      results.push({
        query: q,
        found: true,
        total,
        gtin,
        ntin,
        nameRu,
        id: first.id,
        fullCategoryCode: first.fullCategoryCode,
        categoryNameRuL1: first.categoryNameRuL1,
        categoryNameRuL4: first.categoryNameRuL4,
        attributes: attrMap,
        allItemsCount: items.length,
      })
    } catch (e) {
      console.log(`#${i + 1} ${q.padEnd(25)} | ERROR: ${e.message}`)
      results.push({ query: q, error: e.message })
    }

    await new Promise(r => setTimeout(r, 350))
  }

  console.log('')
  console.log('=== SUMMARY ===')
  console.log(`Total queries: ${TEST_QUERIES.length}`)
  console.log(`Found: ${foundCount}/${TEST_QUERIES.length} (${(foundCount / TEST_QUERIES.length * 100).toFixed(0)}%)`)
  console.log(`With GTIN: ${gtinCount}/${TEST_QUERIES.length}`)
  console.log(`With NTIN: ${ntinCount}/${TEST_QUERIES.length}`)
  console.log('')

  const fs = require('fs')
  const path = require('path')
  const outDir = path.join(__dirname, '..', 'data', 'ean-test')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'npc-results.json')
  fs.writeFileSync(outFile, JSON.stringify({ testedAt: new Date().toISOString(), results, stats: { total: TEST_QUERIES.length, found: foundCount, gtinCount, ntinCount } }, null, 2))
  console.log(`Saved: ${outFile}`)
}

main().catch(e => { console.error(e); process.exit(1) })
