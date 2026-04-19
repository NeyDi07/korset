const https = require('https')
const { URL } = require('url')
const fs = require('fs')

function httpReq(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        ...headers,
      },
    }, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
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
}

async function main() {
  console.log('=== Step 1: Fetch main page, look for product URL patterns ===')
  const main = await httpReq('https://arbuz.kz/ru/almaty/')
  console.log('Main page status:', main.status, 'size:', main.body.length)

  const decoded = decodeHtml(main.body)

  const allUrls = []
  const urlRe = /https?:\/\/arbuz\.kz\/ru\/almaty\/([^\s"<>]+)/g
  let m
  while ((m = urlRe.exec(decoded)) !== null) {
    allUrls.push(m[1])
  }
  const uniquePaths = [...new Set(allUrls)]
  console.log('All unique arbuz paths:', uniquePaths.length)
  uniquePaths.forEach(p => console.log('  /ru/almaty/' + p))

  const nextIdx = decoded.indexOf('__NEXT_DATA__')
  if (nextIdx > -1) {
    console.log('\n__NEXT_DATA__ found at pos:', nextIdx)
    const start = decoded.indexOf('{', nextIdx)
    const end = decoded.indexOf('</script>', start)
    if (start > -1 && end > -1) {
      const jsonStr = decoded.substring(start, end)
      try {
        const nd = JSON.parse(jsonStr)
        console.log('buildId:', nd.buildId)
        console.log('page:', nd.page)
        console.log('query:', JSON.stringify(nd.query))
        if (nd.props?.pageProps) {
          console.log('pageProps keys:', Object.keys(nd.props.pageProps))
        }
      } catch (e) {
        console.log('Parse error, first 500:', jsonStr.substring(0, 500))
      }
    }
  }

  const nuxtIdx = decoded.indexOf('__NUXT__')
  if (nuxtIdx > -1) console.log('\n__NUXT__ found at pos:', nuxtIdx)

  console.log('\n=== Step 2: Try product detail URL patterns ===')
  const milkaId = 235473
  const paths = [
    `/ru/almaty/product/${milkaId}/`,
    `/ru/almaty/products/${milkaId}/`,
    `/ru/almaty/item/${milkaId}/`,
    `/ru/almaty/grocery/${milkaId}/`,
    `/ru/almaty/catalog/${milkaId}/`,
    `/ru/almaty/p/${milkaId}/`,
    `/ru/almaty/goods/${milkaId}/`,
    `/ru/almaty/catalog/product/${milkaId}/`,
    `/ru/almaty/catalog/item-${milkaId}/`,
    `/ru/almaty/shop/${milkaId}/`,
    `/ru/almaty/buy/${milkaId}/`,
    `/ru/almaty/grocery/product-${milkaId}/`,
    `/ru/almaty/food/${milkaId}/`,
    `/ru/almaty/catalogue/${milkaId}/`,
  ]

  for (const p of paths) {
    const r = await httpReq('https://arbuz.kz' + p)
    const sizeInfo = r.status === 200 ? `size:${r.body.length} comp:${r.body.includes('Состав')} kbju:${r.body.includes('белки')}` : ''
    console.log(`  ${p} -> ${r.status} ${sizeInfo}`)
    if (r.status === 200) {
      console.log('    FIRST HIT! Size:', r.body.length)
      const hasComp = r.body.includes('Состав') || r.body.includes('состав')
      const hasKbju = r.body.includes('белки') || r.body.includes('ккал')
      console.log('    Composition:', hasComp, 'КБЖУ:', hasKbju)
      break
    }
  }

  console.log('\n=== Step 3: Search in saved HTML for product link patterns ===')
  const searchHtml = fs.readFileSync('data/arbuz-enrich', { encoding: 'utf-8', flag: 'r' }).length > 0
  console.log('data/arbuz-enrich dir exists:', fs.existsSync('data/arbuz-enrich'))

  const productBlockStart = decoded.indexOf('"id":235473')
  if (productBlockStart > -1) {
    const block = decoded.substring(productBlockStart, productBlockStart + 3000)
    console.log('\nMilka product block (3000 chars):')
    console.log(block)
  }

  console.log('\n=== Step 4: Look for JSON data blocks in HTML ===')
  const scriptDataRe = /window\.__[A-Z_]+\s*=\s*(\{[\s\S]*?\});/g
  let sm
  while ((sm = scriptDataRe.exec(main.body)) !== null) {
    console.log(`  window.${sm[0].substring(7, 30)}... length: ${sm[1].length}`)
  }

  const jsonDataRe = /"products"\s*:\s*\[/g
  let jm
  while ((jm = jsonDataRe.exec(decoded)) !== null) {
    console.log(`  "products" array at pos ${jm.index}`)
    const arrStart = jm.index
    const preview = decoded.substring(arrStart, arrStart + 200)
    console.log(`    Preview: ${preview}`)
  }

  console.log('\n=== Step 5: Look for catalog/product slug in data ===')
  const slugRe = /"(?:slug|seo_url|canonical|product_url)"\s*:\s*"([^"]+)"/g
  let slm
  while ((slm = slugRe.exec(decoded)) !== null) {
    console.log(`  slug: ${slm[1]}`)
  }

  const categoryRe = /"category_name"\s*:\s*"([^"]+)"/g
  let cm
  const categories = []
  while ((cm = categoryRe.exec(decoded)) !== null) {
    categories.push(cm[1])
  }
  console.log('Categories found:', [...new Set(categories)].slice(0, 10))
}

main().catch(console.error)
