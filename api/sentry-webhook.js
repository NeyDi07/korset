// ═══════════════════════════════════════════════════════════════════════════
// api/sentry-webhook.js — Relay Sentry alerts to Telegram
// ═══════════════════════════════════════════════════════════════════════════
// Sentry → POST this endpoint → Formatted Telegram message
// Environment:
//   TELEGRAM_BOT_TOKEN     (from BotFather)
//   TELEGRAM_ALERT_CHAT_ID (group/chat ID from getUpdates)
//   SENTRY_WEBHOOK_SECRET  (optional — HMAC signature verification)
// ═══════════════════════════════════════════════════════════════════════════

const TELEGRAM_API = 'https://api.telegram.org'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function sendTelegram(token, chatId, text) {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telegram API ${res.status}: ${err}`)
  }
  return res.json()
}

function formatAlert(payload) {
  const event = payload?.event || payload?.data?.event || {}
  const issue = payload?.issue || payload?.data?.issue || {}

  const title = event.title || issue.title || 'Unknown error'
  const culprit = event.culprit || event.transaction || '—'
  const issueUrl = issue.url || payload?.url || ''
  const level = (event.level || 'error').toUpperCase()
  const count = issue.count || event.count || 1
  const userCount = event.userCount || issue.userCount || 0
  const env = event.environment || 'production'
  const project = payload?.project_name || payload?.project || 'korset-web'

  const emojis = { FATAL: '💥', ERROR: '🚨', WARNING: '⚠️', INFO: 'ℹ️' }
  const emoji = emojis[level] || '🚨'

  const link = issueUrl ? `\n<a href="${issueUrl}">Open in Sentry</a>` : ''

  return `${emoji} <b>Sentry ${level}</b> | ${project} | ${env}

<b>${title}</b>
<code>${culprit}</code>

Events: ${count} | Users: ${userCount}${link}`
}

export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID

  if (!token || !chatId) {
    console.error('[sentry-webhook] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ALERT_CHAT_ID')
    return res.status(200).json({ ok: false, error: 'Webhook not configured' })
  }

  let payload = {}
  try {
    if (typeof req.body === 'string') {
      payload = JSON.parse(req.body)
    } else if (req.body && typeof req.body === 'object') {
      payload = req.body
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const text = formatAlert(payload)

  try {
    await sendTelegram(token, chatId, text)
    console.log('[sentry-webhook] Sent:', payload?.event?.title || payload?.issue?.title || 'unknown')
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[sentry-webhook] Telegram error:', e.message)
    return res.status(200).json({ ok: false, error: 'Telegram send failed' })
  }
}
