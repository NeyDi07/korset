import { createClient } from '@supabase/supabase-js'

const CORS_ORIGINS = [
  'https://korset.app',
  'https://www.korset.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

function corsHeaders(origin) {
  const allow = CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

async function verifyJWT(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return { user: null, authenticated: false }
  const token = authHeader.slice(7)
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return { user: null, authenticated: false }
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } })
    const { data, error } = await sb.auth.getUser(token)
    if (error || !data.user) return { user: null, authenticated: false }
    return { user: data.user, authenticated: true }
  } catch {
    return { user: null, authenticated: false }
  }
}

function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return res.status(200).set(cors).send('')
  }

  if (req.method !== 'POST') {
    return res.status(405).set(cors).json({ error: 'Method not allowed' })
  }

  const { user, authenticated } = await verifyJWT(req.headers.authorization)
  if (!authenticated) {
    return res.status(401).set(cors).json({ error: 'Unauthorized' })
  }

  const admin = getAdmin()
  if (!admin) {
    return res.status(500).set(cors).json({ error: 'Server misconfiguration' })
  }

  const { action, id, ean, name } = req.body || {}

  if (!id && action !== 'delete-store-products') {
    return res.status(400).set(cors).json({ error: 'Missing product id' })
  }

  try {
    if (action === 'delete') {
      await admin.from('store_products').delete().eq('global_product_id', id)
      const { error: gpError } = await admin.from('global_products').delete().eq('id', id)
      if (gpError) return res.status(500).set(cors).json({ error: gpError.message })
      return res.status(200).set(cors).json({ ok: true, action: 'delete' })
    }

    if (action === 'update-ean') {
      if (!ean) return res.status(400).set(cors).json({ error: 'Missing ean' })
      const { error: gpError } = await admin.from('global_products').update({ ean }).eq('id', id)
      if (gpError) {
        if (gpError.message.includes('duplicate key')) {
          return res.status(409).set(cors).json({ error: 'duplicate', message: 'EAN already exists' })
        }
        return res.status(500).set(cors).json({ error: gpError.message })
      }
      await admin.from('store_products').update({ ean }).eq('global_product_id', id).eq('is_active', true)
      return res.status(200).set(cors).json({ ok: true, action: 'update-ean' })
    }

    if (action === 'update-name') {
      if (!name) return res.status(400).set(cors).json({ error: 'Missing name' })
      const { error: gpError } = await admin.from('global_products').update({ name }).eq('id', id)
      if (gpError) return res.status(500).set(cors).json({ error: gpError.message })
      return res.status(200).set(cors).json({ ok: true, action: 'update-name' })
    }

    return res.status(400).set(cors).json({ error: 'Unknown action' })
  } catch (e) {
    return res.status(500).set(cors).json({ error: e.message || 'Internal error' })
  }
}
