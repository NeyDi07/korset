import { createClient } from '@supabase/supabase-js'
import { normalizeName } from '../src/domain/product/nameNormalizer.js'

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
    console.error('[ean-recovery] Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing')
    return res.status(500).set(cors).json({ error: 'Server misconfiguration' })
  }

  // Admin-only endpoint (migration 017_security_hardening.sql).
  try {
    const { data: isAdmin, error: rpcError } = await admin.rpc('is_admin_user', { p_auth_id: user.id })
    if (rpcError) {
      console.error('[ean-recovery] is_admin_user rpc error', rpcError)
      return res.status(500).set(cors).json({ error: 'Authorization check failed' })
    }
    if (isAdmin !== true) {
      console.warn('[ean-recovery] Forbidden attempt by user', user.id)
      return res.status(403).set(cors).json({ error: 'Forbidden' })
    }
  } catch (e) {
    console.error('[ean-recovery] admin check exception', e)
    return res.status(500).set(cors).json({ error: 'Authorization check failed' })
  }

  const { action, id, ean, name } = req.body || {}

  if (!id && action !== 'delete-store-products') {
    return res.status(400).set(cors).json({ error: 'Missing product id' })
  }

  try {
    if (action === 'delete') {
      await admin.from('store_products').delete().eq('global_product_id', id)
      const { error: gpError } = await admin.from('global_products').delete().eq('id', id)
      if (gpError) {
        console.error('[ean-recovery] delete error', gpError)
        return res.status(500).set(cors).json({ error: 'Delete failed' })
      }
      return res.status(200).set(cors).json({ ok: true, action: 'delete' })
    }

    if (action === 'update-ean') {
      if (!ean) return res.status(400).set(cors).json({ error: 'Missing ean' })
      const { error: gpError } = await admin.from('global_products').update({ ean }).eq('id', id)
      if (gpError) {
        if (gpError.code === '23505' || gpError.message?.includes('duplicate key')) {
          return res.status(409).set(cors).json({ error: 'duplicate', message: 'EAN already exists' })
        }
        console.error('[ean-recovery] update-ean error', gpError)
        return res.status(500).set(cors).json({ error: 'Update failed' })
      }
      await admin.from('store_products').update({ ean }).eq('global_product_id', id).eq('is_active', true)
      return res.status(200).set(cors).json({ ok: true, action: 'update-ean' })
    }

    if (action === 'update-name') {
      if (!name) return res.status(400).set(cors).json({ error: 'Missing name' })
      const { error: gpError } = await admin.from('global_products').update({ name: normalizeName(name) }).eq('id', id)
      if (gpError) {
        console.error('[ean-recovery] update-name error', gpError)
        return res.status(500).set(cors).json({ error: 'Update failed' })
      }
      return res.status(200).set(cors).json({ ok: true, action: 'update-name' })
    }

    return res.status(400).set(cors).json({ error: 'Unknown action' })
  } catch (e) {
    console.error('[ean-recovery] handler exception', e)
    return res.status(500).set(cors).json({ error: 'Internal error' })
  }
}
