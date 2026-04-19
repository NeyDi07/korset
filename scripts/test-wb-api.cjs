const https = require('https')
const url = new URL('https://search.wb.ru/search/v6/search?curr=RUB&dest=-1257786&locale=ru&query=%D0%9C%D0%B0%D0%BA%D1%84%D0%B0+%D1%80%D0%B8%D1%81&resultset=catalog&sort=popular&page=1')
const req = https.get({
  hostname: url.hostname,
  path: url.pathname + url.search,
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Accept': '*/*',
    'Origin': 'https://www.wildberries.ru',
    'Referer': 'https://www.wildberries.ru/',
  },
}, res => {
  let d = ''
  res.on('data', c => { d += c })
  res.on('end', () => {
    try {
      const j = JSON.parse(d)
      const prods = j?.data?.products || []
      console.log('WB v6:', prods.length, 'products')
      prods.slice(0, 5).forEach(p => console.log(p.id, p.name?.substring(0, 40), p.barcode || p.ean || 'no-ean'))
    } catch {
      console.log('WB v6:', res.statusCode, d.substring(0, 200))
    }
  })
})
req.on('error', e => console.log(e.message))
