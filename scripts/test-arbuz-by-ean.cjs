const https = require('https')
const { URL } = require('url')

function httpReq(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9',
      },
    }, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

function decodeHtml(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

function stripHtml(html) {
  return html.replace(/<br\s*\/?>/gi, ', ').replace(/<\/p>/gi, ', ').replace(/<[^>]+>/g, '').trim()
}

function extractProductByBarcode(decoded, barcode) {
  const barcodeIdx = decoded.indexOf('"barcode":"' + barcode + '"')
  if (barcodeIdx === -1) {
    const artIdx = decoded.indexOf('"article_index":"' + barcode + '"')
    if (artIdx === -1) return null
    const start = decoded.lastIndexOf('{"id"', artIdx)
    const end = findProductEnd(decoded, artIdx)
    return tryParseProductJson(decoded, start, end)
  }

  const start = decoded.lastIndexOf('{"id"', barcodeIdx)
  const end = findProductEnd(decoded, barcodeIdx)
  return tryParseProductJson(decoded, start, end)
}

function findProductEnd(decoded, fromIdx) {
  let depth = 0
  for (let i = fromIdx; i < decoded.length && i < fromIdx + 10000; i++) {
    if (decoded[i] === '{') depth++
    if (decoded[i] === '}') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return fromIdx + 5000
}

function tryParseProductJson(decoded, startIdx, endIdx) {
  if (startIdx === -1) return null
  const jsonStr = decoded.substring(startIdx, endIdx)
  try {
    const p = JSON.parse(jsonStr)
    return p
  } catch (e) {
    const braceStart = jsonStr.indexOf('{')
    const braceEnd = jsonStr.lastIndexOf('}')
    if (braceStart > -1 && braceEnd > -1) {
      try {
        return JSON.parse(jsonStr.substring(braceStart, braceEnd + 1))
      } catch (e2) {
        return null
      }
    }
    return null
  }
}

function parseProduct(p) {
  const result = {
    id: p.id,
    name: p.name,
    brand: p.brand_name,
    country: p.manufacturer_country,
    barcode: p.barcode || p.article_index,
    price: p.price_actual || null,
    image: p.image || null,
    composition: null,
    nutrition: null,
    halal: false,
    dietPreferences: null,
    storageConditions: null,
    shelfLifeDays: p.shelf_life_days || null,
  }

  if (p.ingredients) {
    result.composition = stripHtml(p.ingredients).replace(/,\s*,/g, ',').replace(/^\s*,/, '').trim()
  }

  if (p.nutrition) {
    try {
      const n = typeof p.nutrition === 'string' ? JSON.parse(p.nutrition) : p.nutrition
      result.nutrition = {
        energy_kcal: n.kcal ? parseFloat(n.kcal) : null,
        protein_100g: n.protein ? parseFloat(n.protein) : null,
        fat_100g: n.fats ? parseFloat(n.fats) : null,
        carbohydrates_100g: n.carbs ? parseFloat(n.carbs) : null,
      }
    } catch (e) {}
  }

  if (p.diet_preferences) {
    try {
      const dp = typeof p.diet_preferences === 'string' ? JSON.parse(p.diet_preferences) : p.diet_preferences
      result.dietPreferences = dp
    } catch (e) {}
  }

  if (p.information) {
    const info = stripHtml(p.information).toLowerCase()
    if (info.includes('халал') || info.includes('halal')) result.halal = true
  }
  if (result.composition) {
    const lc = result.composition.toLowerCase()
    if (lc.includes('халал') || lc.includes('halal')) result.halal = true
  }

  if (p.storage_conditions) {
    result.storageConditions = stripHtml(p.storage_conditions).substring(0, 200)
  }

  return result
}

async function main() {
  const testEans = [
    { ean: '7622210694331', name: 'Milka шоколад' },
    { ean: '4870211882186', name: 'Хлеб Зернышко' },
    { ean: '5449000000996', name: 'Coca-Cola' },
    { ean: '4820024790017', name: 'Ряженка' },
    { ean: '4607025392408', name: 'Добрый сок' },
  ]

  let found = 0, compFound = 0, nutFound = 0, halalFound = 0

  for (const { ean, name } of testEans) {
    console.log(`\n--- ${name} (${ean}) ---`)
    const r = await httpReq('https://arbuz.kz/ru/almaty/?q=' + encodeURIComponent(ean))
    if (r.status !== 200) {
      console.log('Search failed:', r.status)
      continue
    }

    const decoded = decodeHtml(r.body)
    const p = extractProductByBarcode(decoded, ean)
    if (!p) {
      console.log('Product not found by barcode')
      const artIdx = decoded.indexOf(ean)
      if (artIdx > -1) console.log('  But EAN string found at pos', artIdx)
      continue
    }

    const parsed = parseProduct(p)
    found++
    if (parsed.composition) compFound++
    if (parsed.nutrition) nutFound++
    if (parsed.halal) halalFound++

    console.log(`  Name: ${parsed.brand} — ${parsed.name}`)
    console.log(`  Price: ${parsed.price}₸ | Country: ${parsed.country}`)
    console.log(`  Composition: ${parsed.composition ? parsed.composition.substring(0, 100) + '...' : 'NONE'}`)
    console.log(`  Nutrition: ${parsed.nutrition ? JSON.stringify(parsed.nutrition) : 'NONE'}`)
    console.log(`  Halal: ${parsed.halal} | DietPrefs: ${JSON.stringify(parsed.dietPreferences)}`)
    console.log(`  ShelfLife: ${parsed.shelfLifeDays} days | Storage: ${(parsed.storageConditions || '-').substring(0, 60)}`)

    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\n=== SUMMARY ===`)
  console.log(`Found: ${found}/${testEans.length}`)
  console.log(`Composition: ${compFound}`)
  console.log(`Nutrition: ${nutFound}`)
  console.log(`Halal: ${halalFound}`)
}

main().catch(console.error)
