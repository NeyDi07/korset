// ═══════════════════════════════════════════════════════════════════════════
// api/sentry-poll.js — Vercel Cron: poll Sentry for new issues → Telegram
// ═══════════════════════════════════════════════════════════════════════════
// Schedule: every 5 minutes (configured in vercel.json)
// Environment:
//   SENTRY_AUTH_TOKEN       — Sentry API token (User Auth Token, scope: org:read, project:read)
//   SENTRY_ORG              — org slug (from Sentry URL)
//   SENTRY_PROJECT          — project slug (e.g. javascript-react)
//   TELEGRAM_BOT_TOKEN      — from BotFather
//   TELEGRAM_ALERT_CHAT_ID  — chat/group ID
//   SENTRY_LAST_SEEN_KEY    — optional KV key (we use a simple timestamp approach)
// ═══════════════════════════════════════════════════════════════════════════

const TELEGRAM_API = 'https://api.telegram.org'
const SENTRY_API = 'https://sentry.io/api/0'

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
    throw new Error(`Telegram ${res.status}: ${err}`)
  }
}

async function fetchNewIssues(authToken, org, project, since) {
  const sinceIso = new Date(since).toISOString()
  const url = `${SENTRY_API}/projects/${org}/${project}/issues/?query=firstSeen:>${sinceIso}&limit=10&sort=date`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sentry API ${res.status}: ${err}`)
  }
  return res.json()
}

function formatIssue(issue) {
  const level = (issue.level || 'error').toUpperCase()
  const emojis = { FATAL: '💥', ERROR: '🚨', WARNING: '⚠️', INFO: 'ℹ️' }
  const emoji = emojis[level] || '🚨'
  const count = issue.count || 1
  const users = issue.userCount || 0
  const culprit = issue.culprit || '—'
  const url = `https://sentry.io/issues/${issue.id}/`

  return `${emoji} <b>Sentry ${level}</b> | korset-web

<b>${issue.title}</b>
<code>${culprit}</code>

Events: ${count} | Users: ${users}
<a href="${url}">Open in Sentry</a>`
}

export default async function handler(req) {
  // Vercel Cron sends GET with Authorization header
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const authToken = process.env.SENTRY_AUTH_TOKEN
  const org = process.env.SENTRY_ORG
  const project = process.env.SENTRY_PROJECT || 'javascript-react'
  const tgToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID

  if (!authToken || !org || !tgToken || !chatId) {
    console.warn('[sentry-poll] Missing env vars — skipping')
    return new Response(JSON.stringify({ ok: false, reason: 'not configured' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Look back 6 minutes (cron runs every 5 min — 1 min overlap to avoid missing events)
  const since = Date.now() - 6 * 60 * 1000

  try {
    const issues = await fetchNewIssues(authToken, org, project, since)

    if (!issues || issues.length === 0) {
      console.log('[sentry-poll] No new issues in last 6 minutes')
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`[sentry-poll] Found ${issues.length} new issues — sending to Telegram`)

    let sent = 0
    for (const issue of issues) {
      try {
        const text = formatIssue(issue)
        await sendTelegram(tgToken, chatId, text)
        sent++
      } catch (e) {
        console.error(`[sentry-poll] Failed to send issue ${issue.id}:`, e.message)
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, total: issues.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[sentry-poll] Error:', e.message)
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
