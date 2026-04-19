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
  const code = '120746248'
  const url = `https://kaspi.kz/shop/p/-${code}/?c=750000000`
  const r = await fetch(url, { headers: KASPI_HEADERS, signal: AbortSignal.timeout(15000) })
  const text = await r.text()

  const idx = text.indexOf('specifications-list')
  if (idx < 0) { console.log('No specifications-list found'); return }
  
  const block = text.substring(idx, idx + 5000)
  console.log('Specifications block (5000 chars):')
  console.log(block)
}

main()
