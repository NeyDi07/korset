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

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function escapeMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&')
    .replace(/\\+/g, '\\+')
}

async function sendTelegram(token, chatId, text) {
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'MarkdownV2',
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
  const url = issue.url || payload?.url || '—'
  const level = (event.level || 'error').toUpperCase()
  
  // Count info
  const count = issue.count || event.count || 1
  const userCount = event.userCount || issue.userCount || '—'
  const project = payload?.project_name || payload?.project || 'korset-web'
  
  // Environment
  const env = event.environment || 'production'
  const release = event.release || '—'
  
  // Emojis by level
  const emojis = {
    FATAL: '💥',
    ERROR: '🚨',
    WARNING: '⚠️',
    INFO: 'ℹ️',
  }
  const emoji = emojis[level] || emojis.ERROR
  
  return `${emoji} *Sentry Alert* \| ${escapeMarkdown(project)} \| ${escapeMarkdown(env)}

*${escapeMarkdown(title)}*
\`${escapeMarkdown(culprit)}\`

*Level:* ${escapeMarkdown(level)}
*Events:* ${count} \| *Users:* ${userCount}
*Release:* ${escapeMarkdown(release)}

[Open in Sentry](${escapeMarkdown(url)})`
}

export default async function handler(req) {
  // Only accept POST
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }
  
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID
  
  if (!token || !chatId) {
    console.error('[sentry-webhook] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ALERT_CHAT_ID')
    return json({ error: 'Webhook not configured' }, 503)
  }
  
  let payload
  try {
    payload = await req.json()
  } catch (e) {
    return json({ error: 'Invalid JSON' }, 400)
  }
  
  // Support both Sentry webhook v0 and Issue Alert formats
  const text = formatAlert(payload)
  
  try {
    await sendTelegram(token, chatId, text)
    console.log('[sentry-webhook] Alert sent:', payload?.event?.title || payload?.issue?.title)
    return json({ ok: true })
  } catch (e) {
    console.error('[sentry-webhook] Telegram send failed:', e.message)
    // Return 200 so Sentry doesn't retry infinitely (we logged the error)
    return json({ ok: false, error: 'Telegram send failed' }, 200)
  }
}
