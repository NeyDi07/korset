const https = require('https')
const { URL } = require('url')

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

function decodeHtmlEntities(str) {
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
  return html
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<\/p>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/,(\s*,)+/g, ',')
    .replace(/^\s*,\s*/, '')
    .trim()
}

function extractProductsFromSearch(html) {
  const decoded = decodeHtmlEntities(html)

  const products = []
  const productRe = /"id"\s*:\s*(\d+).*?"article_index"\s*:\s*"([^"]*)"/g
  let m
  while ((m = productRe.exec(decoded)) !== null) {
    const startIdx = m.index
    const productBlockStart = decoded.lastIndexOf('{"id"', startIdx)
    let productBlockEnd = decoded.indexOf(',"catalog_id"', startIdx + m[0].length)
    if (productBlockEnd === -1) productBlockEnd = startIdx + 5000

    const block = decoded.substring(productBlockStart > -1 ? productBlockStart : startIdx, productBlockEnd + 2000)
    products.push({ id: m[1], articleIndex: m[2], blockStart: productBlockStart, block })
  }

  return products
}

function parseProductBlock(block) {
  const result = {}

  const nameMatch = block.match(/"name"\s*:\s*"([^"]{5,200})"/)
  if (nameMatch) result.name = nameMatch[1]

  const brandMatch = block.match(/"brand_name"\s*:\s*"([^"]*)"/)
  if (brandMatch) result.brand = brandMatch[1]

  const countryMatch = block.match(/"manufacturer_country"\s*:\s*"([^"]*)"/)
  if (countryMatch) result.country = countryMatch[1]

  const priceMatch = block.match(/"price_actual"\s*:\s*(\d+)/)
  if (priceMatch) result.price = parseInt(priceMatch[1])

  const oldPriceMatch = block.match(/"price_previous"\s*:\s*(\d+)/)
  if (oldPriceMatch) result.oldPrice = parseInt(oldPriceMatch[1])

  const imageMatch = block.match(/"image"\s*:\s*"([^"]+)"/)
  if (imageMatch) result.image = imageMatch[1]

  const tabText2Match = block.match(/"tab_text_2"\s*:\s*"([\s\S]*?)","measure"/)
    || block.match(/"tab_text_2"\s*:\s*"([\s\S]*?)","weight_avg"/)
    || block.match(/"tab_text_2"\s*:\s*"([\s\S]*?)","price_actual"/)
  if (tabText2Match) {
    const raw = tabText2Match[1]
    const clean = stripHtml(raw)
    result.tab_text_2_raw = raw.substring(0, 300)
    result.tab_text_2_clean = clean.substring(0, 500)

    const compMatch = clean.match(/Состав\s*[:：]\s*([\s\S]*?)(?:\.|,|\n|$)/i)
    if (compMatch) result.composition = compMatch[1].trim()

    const protMatch = clean.match(/белки\s*[:：]?\s*(\d+[,.]?\d*)\s*г/i)
    const fatMatch = clean.match(/жиры\s*[:：]?\s*(\d+[,.]?\d*)\s*г/i)
    const carbMatch = clean.match(/углеводы\s*[:：]?\s*(\d+[,.]?\d*)\s*г/i)
    const kcalMatch = clean.match(/(\d+)\s*ккал/i) || clean.match(/энергетическ\w*\s*ценность\s*[:：]?\s*(\d+)/i)
    if (kcalMatch || protMatch) {
      result.kbju = {
        energy_kcal: kcalMatch ? parseFloat(kcalMatch[1]) : null,
        protein_100g: protMatch ? parseFloat(protMatch[1].replace(',', '.')) : null,
        fat_100g: fatMatch ? parseFloat(fatMatch[1].replace(',', '.')) : null,
        carbohydrates_100g: carbMatch ? parseFloat(carbMatch[1].replace(',', '.')) : null,
      }
    }
  }

  const halalMatch = block.match(/халал|halal/i)
  if (halalMatch) result.halal = true

  const descMatch = block.match(/"description"\s*:\s*"([^"]{10,})"/)
  if (descMatch) result.description = descMatch[1]

  const infoMatch = block.match(/"information"\s*:\s*"([^"]{10,})"/)
  if (infoMatch) result.information = stripHtml(infoMatch[1]).substring(0, 200)

  return result
}

async function main() {
  const queries = ['milka шоколад', 'ряженка', 'сок добрый']

  for (const q of queries) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`QUERY: "${q}"`)
    console.log('='.repeat(60))

    const r = await httpGet('https://arbuz.kz/ru/almaty/?q=' + encodeURIComponent(q))
    if (r.status !== 200) {
      console.log('Search failed:', r.status)
      continue
    }

    const decoded = decodeHtmlEntities(r.body)

    const products = []
    const productRe = /"id"\s*:\s*(\d+),"created_at"[^]*?"article_index"\s*:\s*"([^"]*)"[^]*?"brand_name"\s*:\s*"([^"]*)"[^]*?"name"\s*:\s*"([^"]+)"/g
    let m
    while ((m = productRe.exec(decoded)) !== null) {
      products.push({ id: m[1], articleIndex: m[2], brand: m[3], name: m[4] })
    }

    console.log(`Found ${products.length} products`)
    if (products.length === 0) {
      const simpleRe = /"id"\s*:\s*(\d+).*?"name"\s*:\s*"([^"]{5,100})"/g
      while ((m = simpleRe.exec(decoded)) !== null) {
        products.push({ id: m[1], name: m[2] })
      }
      console.log(`Simple regex found ${products.length}`)
    }

    const withComp = []
    const withKbju = []
    const withHalal = []

    for (const p of products.slice(0, 10)) {
      const idIdx = decoded.indexOf(`"id":${p.id}`)
      if (idIdx === -1) { continue }

      const blockEnd = decoded.indexOf('"catalog_id"', idIdx + 100)
      const block = decoded.substring(idIdx, blockEnd > -1 ? blockEnd + 2000 : idIdx + 8000)

      const parsed = parseProductBlock(block)
      const hasComp = !!parsed.composition || !!parsed.tab_text_2_clean
      const hasKbju = !!parsed.kbju
      const hasHalal = !!parsed.halal

      if (hasComp) withComp.push(p.id)
      if (hasKbju) withKbju.push(p.id)
      if (hasHalal) withHalal.push(p.id)

      console.log(`\n  #${p.id} ${p.brand || '?'} — ${(p.name || '?').substring(0, 40)}`)
      console.log(`    price: ${parsed.price || '-'}₸ | comp: ${!!parsed.composition} | tab_text_2: ${!!parsed.tab_text_2_clean} | kbju: ${hasKbju} | halal: ${hasHalal}`)
      if (parsed.composition) console.log(`    composition: ${parsed.composition.substring(0, 80)}...`)
      if (parsed.tab_text_2_clean) console.log(`    tab_text_2: ${parsed.tab_text_2_clean.substring(0, 120)}...`)
      if (parsed.kbju) console.log(`    КБЖУ: ${parsed.kbju.energy_kcal}kcal P:${parsed.kbju.protein_100g} F:${parsed.kbju.fat_100g} C:${parsed.kbju.carbohydrates_100g}`)
    }

    console.log(`\n  SUMMARY for "${q}": ${products.length} products, ${withComp.length} with composition, ${withKbju.length} with КБЖУ, ${withHalal.length} with halal`)
  }

  console.log('\n\n=== FIND PRODUCT DETAIL URL ===')
  const r = await httpGet('https://arbuz.kz/ru/almaty/?q=' + encodeURIComponent('milka'))
  const decoded = decodeHtmlEntities(r.body)

  const slugPatterns = [...decoded.matchAll(/"slug"\s*:\s*"([^"]+)"/g)]
  console.log(`slug fields found: ${slugPatterns.length}`)
  slugPatterns.slice(0, 5).forEach((m, i) => console.log(`  ${i}: ${m[1]}`))

  const urlPatterns = [...decoded.matchAll(/"url"\s*:\s*"([^"]+)"/g)]
  console.log(`url fields found: ${urlPatterns.length}`)
  urlPatterns.slice(0, 10).forEach((m, i) => console.log(`  ${i}: ${m[1]}`))

  const linkPatterns = [...decoded.matchAll(/"link"\s*:\s*"([^"]+)"/g)]
  console.log(`link fields found: ${linkPatterns.length}`)
  linkPatterns.slice(0, 10).forEach((m, i) => console.log(`  ${i}: ${m[1]}`))

  const permalinkPatterns = [...decoded.matchAll(/"permalink"\s*:\s*"([^"]+)"/g)]
  console.log(`permalink fields found: ${permalinkPatterns.length}`)

  const catalogIdMatch = decoded.match(/"catalog_id"\s*:\s*(\d+)/g)
  const uniqueCatalogIds = [...new Set((catalogIdMatch || []).map(m => m.match(/\d+/)[0]))]
  console.log(`Unique catalog_ids: ${uniqueCatalogIds.length}`, uniqueCatalogIds.slice(0, 10))

  const hrefPatterns = [...decoded.matchAll(/href="\/ru\/almaty\/([^"]+)"/g)]
  console.log(`\nhref paths: ${hrefPatterns.length}`)
  const uniquePaths = [...new Set(hrefPatterns.map(m => m[1]))]
  uniquePaths.slice(0, 30).forEach(p => console.log(`  /ru/almaty/${p}`))
}

main().catch(console.error)
