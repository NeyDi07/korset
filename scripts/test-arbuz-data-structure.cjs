const https = require('https')
const { URL } = require('url')
const fs = require('fs')
const path = require('path')

function httpReq(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        ...headers,
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

async function main() {
  console.log('=== Searching for Milka by EAN (7622210694331) ===')
  const r = await httpReq('https://arbuz.kz/ru/almaty/?q=7622210694331')
  console.log('Status:', r.status, 'Size:', r.body.length)

  const outDir = path.join(__dirname, '..', 'data', 'arbuz-debug')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  fs.writeFileSync(path.join(outDir, 'search-milka-raw.html'), r.body)
  const decoded = decodeHtml(r.body)
  fs.writeFileSync(path.join(outDir, 'search-milka-decoded.html'), decoded)

  const milkaIdx = decoded.indexOf('"article_index":"7622210694331"')
  if (milkaIdx === -1) {
    console.log('Milka by article_index not found!')
    const altIdx = decoded.indexOf('7622210694331')
    if (altIdx > -1) {
      console.log('Found 7622210694331 at pos', altIdx)
      console.log('Context:', decoded.substring(altIdx - 100, altIdx + 200))
    }
    return
  }

  console.log('Milka article_index found at pos:', milkaIdx)

  const productStart = decoded.lastIndexOf('{"id"', milkaIdx)
  const productEnd = decoded.indexOf(',"is_active"', milkaIdx)

  console.log('Product block start:', productStart, 'end (is_active):', productEnd)

  const blockLen = (productEnd > -1 ? productEnd + 2000 : milkaIdx + 5000) - productStart
  const block = decoded.substring(productStart > -1 ? productStart : milkaIdx - 500, milkaIdx + 5000)
  console.log('Product block length:', block.length)

  fs.writeFileSync(path.join(outDir, 'milka-product-block.json'), block)

  console.log('\n=== Looking for key fields in product block ===')
  const fields = ['tab_text_2', 'tab_text_1', 'composition', 'ingredients', 'description', 'information', 'nutrients', 'attributes', 'characteristics', 'storage_conditions', 'weight_avg', 'weight_min', 'measure', 'is_halal', 'halal']
  for (const f of fields) {
    const idx = block.indexOf('"' + f + '"')
    if (idx > -1) {
      const value = block.substring(idx, idx + 200)
      console.log(`  ${f}: found at ${idx} -> ${value.substring(0, 150)}`)
    }
  }

  console.log('\n=== Full product block (first 3000 chars) ===')
  console.log(block.substring(0, 3000))

  console.log('\n=== Tab text fields analysis ===')
  const tabTextRe = /"tab_text_(\d)"\s*:\s*"([\s\S]*?)","tab/g
  let tm
  while ((tm = tabTextRe.exec(block)) !== null) {
    console.log(`\ntab_text_${tm[1]} (first 500 chars):`)
    const content = tm[2].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\r\n/g, '\n')
    console.log(content.substring(0, 500))
  }

  const tabText2AltRe = /"tab_text_2"\s*:\s*"([\s\S]*?)","(?:measure|weight|price|storage)/
  const tab2m = tabText2AltRe.exec(block)
  if (tab2m) {
    console.log('\n=== tab_text_2 (alternative regex, first 800 chars) ===')
    const content = tab2m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\r\n/g, '\n')
    console.log(content.substring(0, 800))
  }

  console.log('\n=== Search for "Состав" in full decoded HTML ===')
  const compIdx = decoded.indexOf('Состав')
  if (compIdx > -1) {
    console.log('First "Состав" at pos:', compIdx)
    console.log('Context:', decoded.substring(compIdx - 50, compIdx + 200))
  }

  console.log('\n=== Now search by product name ===')
  const r2 = await httpReq('https://arbuz.kz/ru/almaty/?q=' + encodeURIComponent('Milka шоколад'))
  console.log('Name search status:', r2.status, 'size:', r2.body.length)
  const decoded2 = decodeHtml(r2.body)

  const milkaId2 = decoded2.indexOf('"id":235473')
  if (milkaId2 > -1) {
    const pStart = decoded2.lastIndexOf('{"id"', milkaId2)
    const pBlock = decoded2.substring(pStart > -1 ? pStart : milkaId2 - 500, milkaId2 + 5000)
    const tab2Idx = pBlock.indexOf('tab_text_2')
    console.log('tab_text_2 in name-search block:', tab2Idx)
    if (tab2Idx > -1) {
      console.log('tab_text_2 context:', pBlock.substring(tab2Idx, tab2Idx + 300))
    }
  } else {
    console.log('Product 235473 not found in name search')
  }

  const compOcc = [...decoded2.matchAll(/Состав/g)]
  console.log('Состав occurrences in name search:', compOcc.length)
}

main().catch(console.error)
