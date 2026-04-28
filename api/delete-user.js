import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

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
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { user: null, authenticated: false }
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { data, error } = await sb.auth.getUser(token)
    if (error || !data.user) return { user: null, authenticated: false }
    return { user: data.user, authenticated: true }
  } catch {
    return { user: null, authenticated: false }
  }
}

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const headers = corsHeaders(origin)
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' })
  }

  const { user, authenticated } = await verifyJWT(req.headers.authorization)
  if (!authenticated) {
    return json(res, 401, { error: 'unauthorized' })
  }

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(res, 500, { error: 'service_role_not_configured' })
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Delete user from auth (cascade will clean profiles via FK if set)
    const { error } = await admin.auth.admin.deleteUser(user.id)

    if (error) {
      console.error('[delete-user] auth.deleteUser error', error)
      return json(res, 500, { error: 'delete_failed' })
    }

    return json(res, 200, { success: true, message: 'user_deleted' })
  } catch (err) {
    console.error('[delete-user] handler exception', err)
    return json(res, 500, { error: 'internal_error' })
  }
}
