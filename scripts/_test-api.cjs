async function main() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ru-RU,ru;q=0.9',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Referer': 'https://kaspi.kz/shop/c/03831/',
  }
  const c = '750000000'

  const r = await fetch(
    `https://kaspi.kz/yml/product-view/pl/results?q=шоколад&c=${c}&page=0&categoryIds=03831`,
    { headers, signal: AbortSignal.timeout(10000) }
  )
  const data = await r.json()
  
  console.log('Top-level keys:', Object.keys(data).join(', '))
  console.log('Total:', data.total)
  console.log('Page size:', data.data?.length)
  
  if (data.pagination) console.log('Pagination:', JSON.stringify(data.pagination))
  if (data.totalPages) console.log('Total pages:', data.totalPages)
  
  const p0 = data.data?.[0]
  if (p0) console.log('\nSample product keys:', Object.keys(p0).join(', '))
  if (p0) console.log('Sample:', JSON.stringify(p0).substring(0, 500))
  
  // Try page 1
  const r2 = await fetch(
    `https://kaspi.kz/yml/product-view/pl/results?q=шоколад&c=${c}&page=1&categoryIds=03831`,
    { headers, signal: AbortSignal.timeout(10000) }
  )
  const data2 = await r2.json()
  console.log('\nPage 1: products=', data2.data?.length)
  console.log('Page 1 first:', data2.data?.[0]?.title?.substring(0, 60))
}

main()
