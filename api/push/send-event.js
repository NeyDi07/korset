import { cors, getJsonBody, getSupabaseAdmin, json, requireInternalToken, sendPushToSubscription } from './helpers.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
  if (!requireInternalToken(req)) return json(res, 401, { error: 'unauthorized' })

  try {
    const body = await getJsonBody(req)
    const {
      type = 'system',
      title = 'Körset',
      message = 'Новое уведомление.',
      url = '/profile',
      authUserId = null,
      deviceId = null,
      storeSlug = null,
    } = body

    const supabase = getSupabaseAdmin()
    let query = supabase.from('push_subscriptions').select('*').eq('is_active', true)

    if (authUserId) query = query.eq('auth_user_id', authUserId)
    if (deviceId) query = query.eq('device_id', deviceId)
    if (storeSlug) query = query.or(`store_slug.eq.${storeSlug},store_slug.is.null`)

    const { data: subscriptions, error } = await query
    if (error) return json(res, 500, { error: 'subscription_lookup_failed', details: error.message })

    const eventPayload = { type, title, body: message, url, storeSlug, tag: type }
    const { data: eventRow, error: eventErr } = await supabase.from('notification_events').insert({ type, title, body: message, status: 'pending', meta: { url, authUserId, deviceId, storeSlug } }).select('id').maybeSingle()
    if (eventErr) return json(res, 500, { error: 'event_create_failed', details: eventErr.message })

    let sent = 0
    let failed = 0
    for (const sub of subscriptions || []) {
      try {
        await sendPushToSubscription({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, eventPayload)
        sent += 1
        await supabase.from('notification_deliveries').insert({ event_id: eventRow?.id || null, endpoint: sub.endpoint, status: 'sent' })
      } catch (error) {
        failed += 1
        await supabase.from('notification_deliveries').insert({ event_id: eventRow?.id || null, endpoint: sub.endpoint, status: 'failed', error_message: error.message })
      }
    }

    await supabase.from('notification_events').update({ status: failed ? (sent ? 'partial' : 'failed') : 'sent', deliveries_total: sent + failed, deliveries_success: sent, deliveries_failed: failed }).eq('id', eventRow?.id)

    return json(res, 200, { ok: true, sent, failed })
  } catch (error) {
    return json(res, 500, { error: 'send_event_failed', details: error.message })
  }
}
