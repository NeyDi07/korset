import {
  checkRateLimit,
  PROXY_RATE_LIMITS,
  getRateLimitKey,
  isValidEAN,
  fetchWithTimeout,
  captureApiError,
} from './_monitoring.js'

const CORS_ORIGINS = [
  'https://korset.app',
  'https://www.korset.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const allowOrigin = CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const ean = String(req.query?.ean || '').trim()
  if (!ean) return res.status(400).json({ error: 'ean query param is required' })
  if (!isValidEAN(ean)) {
    return res.status(400).json({ error: 'Invalid EAN format (expected 8–14 digits)' })
  }

  // ── Rate limit ──
  const rateKey = getRateLimitKey(req, { authenticated: false })
  const rateResult = checkRateLimit(rateKey, PROXY_RATE_LIMITS.anonymous)
  res.setHeader('X-RateLimit-Remaining', String(rateResult.remaining))
  if (!rateResult.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: PROXY_RATE_LIMITS.anonymous.windowMs })
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}?fields=product_name,product_name_ru,product_name_kk,product_name_en,brands,ingredients_text_ru,ingredients_text,allergens_tags,allergens_hierarchy,nutriments,image_front_url,image_ingredients_url,image_nutrition_url,labels_tags,nutriscore_grade,nova_group,quantity,additives_tags,categories_tags`
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Korset/1.0 (https://korset.app)',
        From: 'hello@korset.app',
      },
    }, 10000)

    if (!response.ok) {
      const status = response.status
      if (status === 404) {
        return res.status(404).json({ error: 'Product not found' })
      }
      // Log 4xx/5xx from OFF for monitoring but don't leak to client
      console.error(`[off] OFF API HTTP ${status} for EAN ${ean}`)
      return res.status(502).json({ error: 'External API unavailable' })
    }

    const json = await response.json()
    if (json.status !== 1 || !json.product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    return res.status(200).json({ product: json.product })
  } catch (error) {
    captureApiError(error, req, { ean })
    console.error('OFF proxy error', error)
    return res.status(500).json({ error: 'Failed to fetch product from Open Food Facts' })
  }
}
