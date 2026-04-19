const KASPI_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ru-RU,ru;q=0.9',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Referer': 'https://kaspi.kz/',
}

const TEST_CODES = ['120746248', '101152789', '102219552']

async function testDesktopAPI(code) {
  try {
    const r = await fetch(`https://kaspi.kz/shop/rest/misc/product/specifications?productCode=${code}`, {
      headers: KASPI_HEADERS, signal: AbortSignal.timeout(10000)
    })
    if (!r.ok) return { ok: false, status: r.status }
    const data = await r.json()
    const groups = data?.data || []
    const features = {}
    for (const g of groups) {
      for (const f of (g.features || [])) {
        const val = f.featureValues?.[0]?.value || f.featureValues?.[0]?.numberValue
        if (f.name && val) features[f.name] = val
      }
    }
    return { ok: true, featureCount: Object.keys(features).length, features }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function testMobileAPI(code) {
  try {
    const r = await fetch(`https://kaspi.kz/shop/rest/misc/product/mobile/specifications?productCode=${code}`, {
      headers: KASPI_HEADERS, signal: AbortSignal.timeout(10000)
    })
    if (!r.ok) return { ok: false, status: r.status }
    const data = await r.json()
    const groups = data?.data || []
    const features = {}
    for (const g of groups) {
      for (const f of (g.features || [])) {
        const val = f.featureValues?.[0]?.value || f.featureValues?.[0]?.numberValue
        if (f.name && val) features[f.name] = val
      }
    }
    return { ok: true, featureCount: Object.keys(features).length, features }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function testHTMLParsing(code) {
  try {
    const htmlHeaders = {
      ...KASPI_HEADERS,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
    const url = `https://kaspi.kz/shop/p/-${code}/?c=750000000`
    const r = await fetch(url, { headers: htmlHeaders, signal: AbortSignal.timeout(15000) })
    if (!r.ok) return { ok: false, status: r.status }
    const text = await r.text()

    const result = { ok: true, htmlLen: text.length, found: {} }

    const jsonLdMatch = text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    if (jsonLdMatch) {
      try {
        const ld = JSON.parse(jsonLdMatch[1])
        result.jsonLd = { name: ld.name, description: ld.description?.substring(0, 200) }
      } catch {}
    }

    const specMatches = [...text.matchAll(/"specifications"\s*:\s*\{([^}]*)\}/g)]
    if (specMatches.length) result.found.specifications = specMatches.length

    const compositionMatch = text.match(/Состав[^<]*<[^>]*>([^<]+)/)
    if (compositionMatch) result.found.composition = compositionMatch[1].substring(0, 150)

    const specsBlock = text.match(/class="specifications[\s\S]{0,5000}/)
    if (specsBlock) result.found.specsBlock = specsBlock[0].substring(0, 300)

    const allSpecFields = [...text.matchAll(/data-test-id="specification[^"]*"[^>]*>([^<]+)<[^>]*>([^<]*)/g)]
    if (allSpecFields.length) {
      result.found.specFields = allSpecFields.slice(0, 10).map(m => `${m[1]}: ${m[2]}`)
    }

    const chePrice = text.match(/"price"\s*:\s*"?(\d+)"?/)
    if (chePrice) result.found.price = chePrice[1]

    return result
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function main() {
  for (const code of TEST_CODES) {
    console.log(`\n=== Product ${code} ===`)

    const [desktop, mobile, html] = await Promise.all([
      testDesktopAPI(code),
      testMobileAPI(code),
      testHTMLParsing(code),
    ])

    console.log('\nMOBILE API (current):')
    if (mobile.ok) {
      console.log(`  Features: ${mobile.featureCount}`)
      if (mobile.features['Состав']) console.log(`  Состав: ${String(mobile.features['Состав']).substring(0, 100)}`)
      else console.log(`  Состав: NULL`)
      console.log(`  All keys: ${Object.keys(mobile.features).join(', ')}`)
    } else {
      console.log(`  FAILED: ${mobile.status || mobile.error}`)
    }

    console.log('\nDESKTOP API (without /mobile/):')
    if (desktop.ok) {
      console.log(`  Features: ${desktop.featureCount}`)
      if (desktop.features['Состав']) console.log(`  Состав: ${String(desktop.features['Состав']).substring(0, 100)}`)
      else console.log(`  Состав: NULL`)
      console.log(`  All keys: ${Object.keys(desktop.features).join(', ')}`)
    } else {
      console.log(`  FAILED: ${desktop.status || desktop.error}`)
    }

    console.log('\nHTML PARSING:')
    if (html.ok) {
      console.log(`  HTML size: ${html.htmlLen}`)
      console.log(`  Found: ${JSON.stringify(html.found)}`)
      if (html.jsonLd) console.log(`  JSON-LD: ${JSON.stringify(html.jsonLd)}`)
    } else {
      console.log(`  FAILED: ${html.status || html.error}`)
    }
  }
}

main()
