const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'data', 'arbuz-debug')
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<\/p>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/,(\s*,)+/g, ',')
    .replace(/^\s*,\s*/, '')
    .trim()
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'ru-RU',
    viewport: { width: 1280, height: 800 },
  })

  const testEans = [
    { ean: '7622210694331', name: 'Milka шоколад' },
    { ean: '5449000000996', name: 'Coca-Cola' },
    { ean: '4820024790017', name: 'Ряженка' },
  ]

  const results = []

  for (const { ean, name } of testEans) {
    console.log(`\n=== ${name} (${ean}) ===`)
    const page = await context.newPage()

    try {
      await page.goto(`https://arbuz.kz/ru/almaty/?q=${ean}`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)

      console.log('Page loaded, URL:', page.url())

      // Check if search results are rendered
      const searchResults = await page.locator('[class*="search"], [class*="catalog-card"], [class*="product"]').count()
      console.log('Search result elements:', searchResults)

      // Extract product data from rendered DOM
      const products = await page.evaluate(() => {
        const results = []
        
        // Method 1: Extract from __NEXT_DATA__ or window.__NUXT__
        if (window.__NEXT_DATA__) {
          console.log('Found __NEXT_DATA__')
        }
        
        // Method 2: Extract from product card elements
        const cards = document.querySelectorAll('[class*="catalog-card"], [class*="product-card"], [data-product-id]')
        cards.forEach(card => {
          const id = card.getAttribute('data-product-id') || card.getAttribute('data-id')
          const nameEl = card.querySelector('[class*="name"], [class*="title"]')
          const priceEl = card.querySelector('[class*="price"]')
          const brandEl = card.querySelector('[class*="brand"]')
          
          results.push({
            id,
            name: nameEl?.textContent?.trim(),
            price: priceEl?.textContent?.trim(),
            brand: brandEl?.textContent?.trim(),
          })
        })

        // Method 3: Extract from Vue.js data
        // Look for product objects in the page's JavaScript context
        const vueApp = document.querySelector('#app')?.__vue_app__
        if (vueApp) {
          console.log('Found Vue app')
        }

        // Method 4: Extract from the product data embedded in the page
        // The platformConfiguration and product data are in script tags
        const scripts = document.querySelectorAll('script')
        for (const script of scripts) {
          const content = script.textContent || ''
          if (content.includes('"nutrition"') || content.includes('"ingredients"')) {
            // Find product JSON in this script
            const nutritionIdx = content.indexOf('"nutrition"')
            if (nutritionIdx > -1) {
              // Find the product block
              const blockStart = content.lastIndexOf('{"id"', nutritionIdx)
              if (blockStart > -1) {
                const blockEnd = content.indexOf(',"catalog_id"', nutritionIdx)
                if (blockEnd > -1) {
                  try {
                    const productJson = JSON.parse(content.substring(blockStart, blockEnd + 2000))
                    results.push(productJson)
                  } catch (e) {}
                }
              }
            }
          }
        }

        return results
      })

      console.log(`Products found via DOM: ${products.length}`)
      products.forEach((p, i) => console.log(`  ${i}: ${JSON.stringify(p).substring(0, 150)}`))

      // Method 5: Intercept API calls
      const apiCalls = []
      page.on('response', response => {
        const url = response.url()
        if (url.includes('/api/') || url.includes('shop/') || url.includes('catalog')) {
          apiCalls.push({ url, status: response.status() })
        }
      })

      // Trigger search by typing in search box
      const searchInput = await page.$('input[type="search"], input[placeholder*="поиск"], input[class*="search"]')
      if (searchInput) {
        console.log('Found search input, typing...')
        await searchInput.fill(ean)
        await searchInput.press('Enter')
        await page.waitForTimeout(3000)

        // Capture API calls that happened
        console.log('API calls captured:', apiCalls.length)
        apiCalls.forEach(c => console.log(`  ${c.status} ${c.url}`))
        
        // Extract API response data
        for (const call of apiCalls) {
          if (call.url.includes('search') || call.url.includes('product')) {
            try {
              const response = await page.evaluate(async (url) => {
                const r = await fetch(url)
                return { status: r.status, body: await r.text() }
              }, call.url)
              console.log(`  API response: ${response.status} | ${response.body.substring(0, 300)}`)
            } catch (e) {}
          }
        }
      } else {
        console.log('No search input found')
      }

      // Method 6: Try intercepting network requests on fresh navigation
      const newApiCalls = []
      const page2 = await context.newPage()
      
      // Set up request interception before navigating
      page2.on('response', response => {
        const url = response.url()
        if (url.includes('/api/') || url.includes('shop/') || url.includes('auth')) {
          newApiCalls.push({ url, status: response.status() })
          // Try to read the response body
          response.text().then(body => {
            if (body.includes('nutrition') || body.includes('ingredients') || body.includes('milka')) {
              console.log(`  API RESPONSE WITH DATA: ${url}`)
              console.log(`    Body: ${body.substring(0, 500)}`)
            }
          }).catch(() => {})
        }
      })

      console.log('\nNavigating with request interception...')
      await page2.goto(`https://arbuz.kz/ru/almaty/?q=milka`, { waitUntil: 'networkidle', timeout: 30000 })
      await page2.waitForTimeout(3000)

      console.log('New API calls:', newApiCalls.length)
      newApiCalls.forEach(c => console.log(`  ${c.status} ${c.url}`))

      // Screenshot for debugging
      await page2.screenshot({ path: path.join(OUT_DIR, `arbuz-search-${ean}.png`) })

      await page2.close()

      // Also try clicking on a product to see the detail page
      console.log('\nTrying product detail page...')
      const productLinks = await page.$$('[class*="catalog-card"] a, [class*="product"] a')
      if (productLinks.length > 0) {
        const firstLink = productLinks[0]
        const href = await firstLink.getAttribute('href')
        console.log('First product link:', href)
        if (href) {
          await page.goto(`https://arbuz.kz${href}`, { waitUntil: 'networkidle', timeout: 30000 })
          await page.waitForTimeout(2000)

          // Extract product detail data
          const detailData = await page.evaluate(() => {
            const composition = document.querySelector('[class*="composition"], [class*="ingredients"], [class*="состав"]')
            const nutrition = document.querySelector('[class*="nutrition"], [class*="kbju"], [class*="пищевая"]')
            
            // Look for КБЖУ table
            const tables = document.querySelectorAll('table')
            let kbjuData = null
            for (const table of tables) {
              const text = table.textContent
              if (text.includes('белки') || text.includes('жиры') || text.includes('ккал')) {
                kbjuData = text
                break
              }
            }

            return {
              url: window.location.href,
              composition: composition?.textContent?.trim()?.substring(0, 300),
              nutrition: nutrition?.textContent?.trim()?.substring(0, 300),
              kbjuTable: kbjuData?.substring(0, 300),
              pageTitle: document.title,
              bodyText: document.body?.textContent?.substring(0, 500),
            }
          })

          console.log('Product detail data:', JSON.stringify(detailData, null, 2))
          await page.screenshot({ path: path.join(OUT_DIR, `arbuz-detail-${ean}.png`) })
        }
      }

    } catch (e) {
      console.log(`Error for ${ean}:`, e.message)
    } finally {
      await page.close()
    }
  }

  await browser.close()
  console.log('\nDone!')
}

main().catch(console.error)
