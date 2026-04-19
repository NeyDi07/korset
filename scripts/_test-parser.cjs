const path = require('path')
const { parseHTMLSpecs } = require(path.join(__dirname, 'parse-kaspi-html.cjs'))

const KASPI_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Referer': 'https://kaspi.kz/',
}

async function main() {
  const codes = ['120746248', '101152789', '102219552']
  for (const code of codes) {
    const url = `https://kaspi.kz/shop/p/-${code}/?c=750000000`
    const r = await fetch(url, { headers: KASPI_HEADERS, signal: AbortSignal.timeout(15000) })
    const html = await r.text()
    const specs = parseHTMLSpecs(html)
    console.log(`\n=== ${code} ===`)
    console.log(`Fields: ${Object.keys(specs).length}`)
    for (const [k, v] of Object.entries(specs)) {
      const marker = k === 'Состав' ? ' <<<< СОСТАВ!' : ''
      console.log(`  ${k}: ${String(v).substring(0, 120)}${marker}`)
    }
  }
}

main()
