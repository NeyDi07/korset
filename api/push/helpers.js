import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@korset.app'
const INTERNAL_TOKEN = process.env.PUSH_INTERNAL_TOKEN || ''

let configured = false

export function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error('supabase_service_role_missing')
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
}

export function configureWebPush() {
  if (configured) return
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error('vapid_keys_missing')
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  configured = true
}

export function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-push-internal-token')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

export function requireInternalToken(req) {
  const headerToken = req.headers['x-push-internal-token'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '')
  return INTERNAL_TOKEN && headerToken === INTERNAL_TOKEN
}

export async function sendPushToSubscription(subscription, payload) {
  configureWebPush()
  return webpush.sendNotification(subscription, JSON.stringify(payload))
}

export async function getJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

export function getDeviceId(body = {}) {
  return body.deviceId || body.device_id || null
}
