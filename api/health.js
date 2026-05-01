// /api/health — health check для мониторинга и CI.
// Проверяет: env-переменные, Supabase reachability, OpenAI key configured.
// Возвращает JSON со статусом каждого компонента + общим verdict (200 ok / 503 degraded).
//
// Использовать:
//   - Uptime monitor (UptimeRobot/Better Stack): hit /api/health каждые 60s
//   - CI smoke test после деплоя: проверить status === 'ok'
//
// БЕЗ auth — статус публичный (но не выдаёт секреты, только "configured: true/false").

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

async function checkSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { status: 'misconfigured', reason: 'env_missing' }
  }
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
    // Лёгкий round-trip: считаем 1 строку из публичной таблицы
    const start = Date.now()
    const { error } = await sb
      .from('global_products')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    const latencyMs = Date.now() - start
    if (error) {
      return { status: 'unreachable', reason: error.code || 'unknown_error', latencyMs }
    }
    return { status: 'ok', latencyMs }
  } catch (err) {
    return { status: 'unreachable', reason: err?.name || 'exception' }
  }
}

function checkPush() {
  const hasPublic = !!(process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY)
  const hasPrivate = !!process.env.VAPID_PRIVATE_KEY
  return {
    configured: hasPublic && hasPrivate,
    vapidPublic: hasPublic,
    vapidPrivate: hasPrivate,
  }
}

function checkSentry() {
  return {
    configured: !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Content-Type', 'application/json')

  const startedAt = Date.now()
  const supabaseCheck = await checkSupabase()
  const checks = {
    supabase: supabaseCheck,
    openai: {
      configured: !!process.env.OPENAI_API_KEY,
    },
    rag: {
      configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    push: checkPush(),
    sentry: checkSentry(),
  }

  const criticalOk = checks.supabase.status === 'ok' && checks.openai.configured
  const isOk = criticalOk && checks.rag.configured

  const body = {
    status: isOk ? 'ok' : criticalOk ? 'degraded' : 'down',
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    region: process.env.VERCEL_REGION || 'local',
    checks,
  }

  res.status(isOk ? 200 : criticalOk ? 503 : 503).end(JSON.stringify(body))
}
